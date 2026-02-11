/**
 * Activity Service
 * Handles activity and event discovery
 */

import Activity, { IActivity, ActivityCategory, EventType } from '../models/Activity';
import landmarkService from './landmark.service';
import logger from '../utils/logger';
import mongoose from 'mongoose';

interface ActivitySearchParams {
  query?: string;
  category?: ActivityCategory;
  province?: string;
  landmarkId?: string;
  eventType?: EventType;
  isFree?: boolean;
  isFeatured?: boolean;
  targetAudience?: string;
  difficulty?: 'easy' | 'moderate' | 'challenging';
  startDate?: Date;
  endDate?: Date;
  lat?: number;
  lng?: number;
  maxDistance?: number;
  skip?: number;
  limit?: number;
  sortBy?: 'date' | 'rating' | 'popularity' | 'price';
}

class ActivityService {
  /**
   * Get all activities with optional filters
   */
  async getActivities(params: ActivitySearchParams = {}): Promise<{
    activities: IActivity[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        query,
        category,
        province,
        landmarkId,
        eventType,
        isFree,
        isFeatured,
        targetAudience,
        difficulty,
        startDate,
        endDate,
        lat,
        lng,
        maxDistance = 10000,
        skip = 0,
        limit = 20,
        sortBy = 'date',
      } = params;

      // Build query
      const filter: Record<string, unknown> = { 
        status: { $in: ['active', 'upcoming'] },
      };

      if (category) filter.category = category;
      if (province) filter.province = new RegExp(province, 'i');
      if (landmarkId) filter.landmark = new mongoose.Types.ObjectId(landmarkId);
      if (eventType) filter.eventType = eventType;
      if (isFree !== undefined) filter['pricing.isFree'] = isFree;
      if (isFeatured !== undefined) filter.isFeatured = isFeatured;
      if (targetAudience) filter.targetAudience = targetAudience;
      if (difficulty) filter.difficulty = difficulty;

      // Date range filter
      if (startDate || endDate) {
        if (startDate && endDate) {
          filter.$or = [
            // One-time events in date range
            {
              eventType: 'one_time',
              'schedule.startDate': { $lte: endDate },
              'schedule.endDate': { $gte: startDate },
            },
            // Permanent or recurring
            { eventType: { $in: ['permanent', 'recurring'] } },
          ];
        } else if (startDate) {
          filter.$or = [
            { eventType: 'one_time', 'schedule.endDate': { $gte: startDate } },
            { eventType: { $in: ['permanent', 'recurring'] } },
          ];
        }
      }

      // Text search
      if (query) {
        const regex = new RegExp(query, 'i');
        filter.$or = [
          { title: regex },
          { titleLocal: regex },
          { description: regex },
          { tags: regex },
          { landmarkName: regex },
        ];
      }

      // Geospatial search
      if (lat !== undefined && lng !== undefined) {
        filter.location = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            $maxDistance: maxDistance,
          },
        };
      }

      // Build sort
      let sort: Record<string, 1 | -1> = { isFeatured: -1 };
      switch (sortBy) {
        case 'date':
          sort = { ...sort, 'schedule.startDate': 1 };
          break;
        case 'rating':
          sort = { ...sort, rating: -1 };
          break;
        case 'popularity':
          sort = { ...sort, viewCount: -1 };
          break;
        case 'price':
          sort = { ...sort, 'pricing.amount': 1 };
          break;
      }

      const [activities, total] = await Promise.all([
        Activity.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('landmark', 'name nameLocal type')
          .lean(),
        Activity.countDocuments(filter),
      ]);

      return {
        activities: activities as unknown as IActivity[],
        total,
        hasMore: skip + activities.length < total,
      };
    } catch (error) {
      logger.error('[ActivityService] Error getting activities:', error);
      throw error;
    }
  }

  /**
   * Get upcoming events
   */
  async getUpcomingActivities(params: { 
    province?: string;
    category?: string;
    limit?: number;
    daysAhead?: number;
  } = {}): Promise<IActivity[]> {
    try {
      const { province, category, limit = 10, daysAhead = 30 } = params;

      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + daysAhead);

      const filter: Record<string, unknown> = {
        status: { $in: ['active', 'upcoming'] },
        eventType: 'one_time',
        'schedule.startDate': { $gte: now, $lte: futureDate },
      };

      if (province) filter.province = new RegExp(province, 'i');
      if (category) filter.category = category;

      const activities = await Activity.find(filter)
        .sort({ 'schedule.startDate': 1, isFeatured: -1 })
        .limit(limit)
        .lean();

      return activities as unknown as IActivity[];
    } catch (error) {
      logger.error('[ActivityService] Error getting upcoming activities:', error);
      throw error;
    }
  }

  /**
   * Get featured activities
   */
  async getFeaturedActivities(params: { 
    province?: string;
    limit?: number;
  } = {}): Promise<IActivity[]> {
    try {
      const { province, limit = 10 } = params;

      const filter: Record<string, unknown> = {
        status: { $in: ['active', 'upcoming'] },
        isFeatured: true,
      };

      if (province) filter.province = new RegExp(province, 'i');

      const activities = await Activity.find(filter)
        .sort({ rating: -1, viewCount: -1 })
        .limit(limit)
        .lean();

      return activities as unknown as IActivity[];
    } catch (error) {
      logger.error('[ActivityService] Error getting featured activities:', error);
      throw error;
    }
  }

  /**
   * Get activities by category
   */
  async getActivitiesByCategory(category: ActivityCategory, limit = 20): Promise<IActivity[]> {
    try {
      const activities = await Activity.find({
        status: { $in: ['active', 'upcoming'] },
        category,
      })
        .sort({ isFeatured: -1, rating: -1 })
        .limit(limit)
        .lean();

      return activities as unknown as IActivity[];
    } catch (error) {
      logger.error('[ActivityService] Error getting activities by category:', error);
      throw error;
    }
  }

  /**
   * Get activities near a landmark
   */
  async getActivitiesNearLandmark(landmarkId: string, limit = 10): Promise<IActivity[]> {
    try {
      const landmarkLocation = await landmarkService.getLandmarkLocation(landmarkId);

      if (!landmarkLocation) {
        const activities = await Activity.find({
          status: { $in: ['active', 'upcoming'] },
          landmark: new mongoose.Types.ObjectId(landmarkId),
        })
          .sort({ isFeatured: -1, rating: -1 })
          .limit(limit)
          .lean();
        return activities as unknown as IActivity[];
      }

      const activities = await Activity.find({
        status: { $in: ['active', 'upcoming'] },
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [landmarkLocation.lng, landmarkLocation.lat],
            },
            $maxDistance: landmarkLocation.radius + 3000,
          },
        },
      })
        .sort({ isFeatured: -1, rating: -1 })
        .limit(limit)
        .lean();

      return activities as unknown as IActivity[];
    } catch (error) {
      logger.error('[ActivityService] Error getting activities near landmark:', error);
      throw error;
    }
  }

  /**
   * Get activity by ID
   */
  async getActivityById(id: string): Promise<IActivity | null> {
    try {
      const activity = await Activity.findOne({
        _id: id,
        status: { $in: ['active', 'upcoming'] },
      }).populate('landmark', 'name nameLocal type location');

      if (activity) {
        Activity.updateOne(
          { _id: id },
          { $inc: { viewCount: 1 } }
        ).catch(err => logger.error('[ActivityService] Error updating view count:', err));
      }

      return activity;
    } catch (error) {
      logger.error('[ActivityService] Error getting activity by ID:', error);
      throw error;
    }
  }

  /**
   * Search activities
   */
  async searchActivities(keyword: string, limit = 10): Promise<IActivity[]> {
    try {
      const regex = new RegExp(keyword, 'i');

      const activities = await Activity.find({
        status: { $in: ['active', 'upcoming'] },
        $or: [
          { title: regex },
          { titleLocal: regex },
          { description: regex },
          { tags: regex },
          { landmarkName: regex },
        ],
      })
        .sort({ isFeatured: -1, rating: -1 })
        .limit(limit)
        .lean();

      return activities as unknown as IActivity[];
    } catch (error) {
      logger.error('[ActivityService] Error searching activities:', error);
      throw error;
    }
  }

  /**
   * Get activity categories with counts
   */
  async getCategories(): Promise<{ category: ActivityCategory; count: number; label: string }[]> {
    try {
      const categories = await Activity.aggregate([
        { $match: { status: { $in: ['active', 'upcoming'] } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      const categoryLabels: Record<ActivityCategory, string> = {
        festival: 'Festivals',
        tour: 'Tours',
        class: 'Classes',
        nightlife: 'Nightlife',
        sports: 'Sports',
        nature: 'Nature',
        cultural: 'Cultural',
        entertainment: 'Entertainment',
        wellness: 'Wellness',
        food_drink: 'Food & Drink',
        shopping: 'Shopping',
        other: 'Other',
      };

      return categories.map(c => ({
        category: c._id as ActivityCategory,
        count: c.count,
        label: categoryLabels[c._id as ActivityCategory] || c._id,
      }));
    } catch (error) {
      logger.error('[ActivityService] Error getting categories:', error);
      throw error;
    }
  }

  /**
   * Save/bookmark activity
   */
  async saveActivity(activityId: string): Promise<void> {
    try {
      await Activity.updateOne(
        { _id: activityId },
        { $inc: { saveCount: 1 } }
      );
    } catch (error) {
      logger.error('[ActivityService] Error saving activity:', error);
    }
  }

  /**
   * Admin: Create activity
   */
  async createActivity(data: Partial<IActivity>): Promise<IActivity> {
    try {
      const activity = new Activity({
        ...data,
        viewCount: 0,
        saveCount: 0,
        rating: 0,
        reviewCount: 0,
      });

      await activity.save();
      logger.info(`[ActivityService] Created activity: ${activity.title}`);

      return activity;
    } catch (error) {
      logger.error('[ActivityService] Error creating activity:', error);
      throw error;
    }
  }

  /**
   * Admin: Update activity
   */
  async updateActivity(id: string, data: Partial<IActivity>): Promise<IActivity | null> {
    try {
      const activity = await Activity.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      );

      if (activity) {
        logger.info(`[ActivityService] Updated activity: ${activity.title}`);
      }

      return activity;
    } catch (error) {
      logger.error('[ActivityService] Error updating activity:', error);
      throw error;
    }
  }

  /**
   * Admin: Change activity status
   */
  async updateActivityStatus(id: string, status: string): Promise<boolean> {
    try {
      const result = await Activity.updateOne(
        { _id: id },
        { $set: { status } }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('[ActivityService] Error updating activity status:', error);
      throw error;
    }
  }
}

export const activityService = new ActivityService();
export default activityService;
