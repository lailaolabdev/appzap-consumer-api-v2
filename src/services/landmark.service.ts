/**
 * Landmark Service
 * Handles landmark discovery and search functionality
 */

import Landmark, { ILandmark, LandmarkType } from '../models/Landmark';
import logger from '../utils/logger';

interface LandmarkSearchParams {
  query?: string;
  type?: LandmarkType;
  province?: string;
  isPopular?: boolean;
  lat?: number;
  lng?: number;
  maxDistance?: number; // in meters
  skip?: number;
  limit?: number;
}

interface NearbySearchParams {
  landmarkId: string;
  entityType: 'restaurant' | 'hotel' | 'activity' | 'all';
  maxDistance?: number;
  limit?: number;
}

class LandmarkService {
  /**
   * Get all landmarks with optional filters
   */
  async getLandmarks(params: LandmarkSearchParams = {}): Promise<{
    landmarks: ILandmark[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        query,
        type,
        province,
        isPopular,
        lat,
        lng,
        maxDistance = 10000, // 10km default
        skip = 0,
        limit = 20,
      } = params;

      // Build query
      const filter: Record<string, unknown> = { isActive: true };

      if (type) {
        filter.type = type;
      }

      if (province) {
        filter.province = new RegExp(province, 'i');
      }

      if (isPopular !== undefined) {
        filter.isPopular = isPopular;
      }

      // Text search
      if (query) {
        const regex = new RegExp(query, 'i');
        filter.$or = [
          { name: regex },
          { nameLocal: regex },
          { searchKeywords: regex },
          { description: regex },
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

      // Execute query
      const [landmarks, total] = await Promise.all([
        Landmark.find(filter)
          .sort({ isPopular: -1, sortOrder: 1, viewCount: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        Landmark.countDocuments(filter),
      ]);

      return {
        landmarks: landmarks as unknown as ILandmark[],
        total,
        hasMore: skip + landmarks.length < total,
      };
    } catch (error) {
      logger.error('[LandmarkService] Error getting landmarks:', error);
      throw error;
    }
  }

  /**
   * Get popular landmarks for quick selection
   */
  async getPopularLandmarks(params: { 
    province?: string; 
    limit?: number;
  } = {}): Promise<ILandmark[]> {
    try {
      const { province, limit = 10 } = params;

      const filter: Record<string, unknown> = { 
        isActive: true, 
        isPopular: true,
      };

      if (province) {
        filter.province = new RegExp(province, 'i');
      }

      const landmarks = await Landmark.find(filter)
        .sort({ sortOrder: 1, viewCount: -1 })
        .limit(limit)
        .lean();

      return landmarks as unknown as ILandmark[];
    } catch (error) {
      logger.error('[LandmarkService] Error getting popular landmarks:', error);
      throw error;
    }
  }

  /**
   * Search landmarks by keyword
   */
  async searchLandmarks(keyword: string, limit = 10): Promise<ILandmark[]> {
    try {
      const regex = new RegExp(keyword, 'i');

      const landmarks = await Landmark.find({
        isActive: true,
        $or: [
          { name: regex },
          { nameLocal: regex },
          { nameThai: regex },
          { nameChinese: regex },
          { searchKeywords: regex },
        ],
      })
        .sort({ isPopular: -1, sortOrder: 1 })
        .limit(limit)
        .lean();

      // Track search count (non-blocking)
      const landmarkIds = landmarks.map(l => l._id);
      Landmark.updateMany(
        { _id: { $in: landmarkIds } },
        { $inc: { searchCount: 1 } }
      ).catch(err => logger.error('[LandmarkService] Error updating search count:', err));

      return landmarks as unknown as ILandmark[];
    } catch (error) {
      logger.error('[LandmarkService] Error searching landmarks:', error);
      throw error;
    }
  }

  /**
   * Get landmark by ID
   */
  async getLandmarkById(id: string): Promise<ILandmark | null> {
    try {
      const landmark = await Landmark.findOne({ 
        _id: id, 
        isActive: true,
      });

      if (landmark) {
        // Track view count (non-blocking)
        Landmark.updateOne(
          { _id: id },
          { $inc: { viewCount: 1 } }
        ).catch(err => logger.error('[LandmarkService] Error updating view count:', err));
      }

      return landmark;
    } catch (error) {
      logger.error('[LandmarkService] Error getting landmark by ID:', error);
      throw error;
    }
  }

  /**
   * Get landmarks by type
   */
  async getLandmarksByType(type: LandmarkType, limit = 20): Promise<ILandmark[]> {
    try {
      const landmarks = await Landmark.find({ 
        isActive: true, 
        type,
      })
        .sort({ isPopular: -1, sortOrder: 1 })
        .limit(limit)
        .lean();

      return landmarks as unknown as ILandmark[];
    } catch (error) {
      logger.error('[LandmarkService] Error getting landmarks by type:', error);
      throw error;
    }
  }

  /**
   * Get all landmark types with counts
   */
  async getLandmarkTypes(): Promise<{ type: LandmarkType; count: number; label: string }[]> {
    try {
      const types = await Landmark.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      const typeLabels: Record<LandmarkType, string> = {
        district: 'Districts',
        attraction: 'Attractions',
        mall: 'Shopping',
        university: 'Universities',
        transport: 'Transport',
        market: 'Markets',
        hospital: 'Hospitals',
        hotel_area: 'Hotel Areas',
        embassy: 'Embassies',
        other: 'Other',
      };

      return types.map(t => ({
        type: t._id as LandmarkType,
        count: t.count,
        label: typeLabels[t._id as LandmarkType] || t._id,
      }));
    } catch (error) {
      logger.error('[LandmarkService] Error getting landmark types:', error);
      throw error;
    }
  }

  /**
   * Get all provinces with landmark counts
   */
  async getProvinces(): Promise<{ province: string; count: number }[]> {
    try {
      const provinces = await Landmark.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$province', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      return provinces.map(p => ({
        province: p._id,
        count: p.count,
      }));
    } catch (error) {
      logger.error('[LandmarkService] Error getting provinces:', error);
      throw error;
    }
  }

  /**
   * Get landmarks near a specific location
   */
  async getNearbyLandmarks(
    lng: number, 
    lat: number, 
    maxDistance = 5000, // 5km default
    limit = 10
  ): Promise<ILandmark[]> {
    try {
      const landmarks = await Landmark.find({
        isActive: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [lng, lat],
            },
            $maxDistance: maxDistance,
          },
        },
      })
        .limit(limit)
        .lean();

      return landmarks as unknown as ILandmark[];
    } catch (error) {
      logger.error('[LandmarkService] Error getting nearby landmarks:', error);
      throw error;
    }
  }

  /**
   * Get landmark coordinates for other services
   */
  async getLandmarkLocation(landmarkId: string): Promise<{
    lng: number;
    lat: number;
    radius: number;
  } | null> {
    try {
      const landmark = await Landmark.findById(landmarkId)
        .select('location radius')
        .lean();

      if (!landmark) return null;

      return {
        lng: landmark.location.coordinates[0],
        lat: landmark.location.coordinates[1],
        radius: landmark.radius,
      };
    } catch (error) {
      logger.error('[LandmarkService] Error getting landmark location:', error);
      throw error;
    }
  }

  /**
   * Admin: Create a new landmark
   */
  async createLandmark(data: Partial<ILandmark>): Promise<ILandmark> {
    try {
      const landmark = new Landmark({
        ...data,
        isActive: true,
        viewCount: 0,
        searchCount: 0,
      });

      await landmark.save();
      logger.info(`[LandmarkService] Created landmark: ${landmark.name}`);

      return landmark;
    } catch (error) {
      logger.error('[LandmarkService] Error creating landmark:', error);
      throw error;
    }
  }

  /**
   * Admin: Update a landmark
   */
  async updateLandmark(id: string, data: Partial<ILandmark>): Promise<ILandmark | null> {
    try {
      const landmark = await Landmark.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      );

      if (landmark) {
        logger.info(`[LandmarkService] Updated landmark: ${landmark.name}`);
      }

      return landmark;
    } catch (error) {
      logger.error('[LandmarkService] Error updating landmark:', error);
      throw error;
    }
  }

  /**
   * Admin: Deactivate a landmark (soft delete)
   */
  async deactivateLandmark(id: string): Promise<boolean> {
    try {
      const result = await Landmark.updateOne(
        { _id: id },
        { $set: { isActive: false } }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('[LandmarkService] Error deactivating landmark:', error);
      throw error;
    }
  }
}

export const landmarkService = new LandmarkService();
export default landmarkService;
