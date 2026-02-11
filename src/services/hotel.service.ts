/**
 * Hotel Service
 * Handles hotel discovery and search functionality
 */

import Hotel, { IHotel, HotelType } from '../models/Hotel';
import landmarkService from './landmark.service';
import logger from '../utils/logger';
import mongoose from 'mongoose';

interface HotelSearchParams {
  query?: string;
  hotelType?: HotelType;
  province?: string;
  landmarkId?: string;
  minStars?: number;
  maxStars?: number;
  minPrice?: number;
  maxPrice?: number;
  currency?: 'LAK' | 'USD' | 'THB';
  amenities?: string[];
  isFeatured?: boolean;
  lat?: number;
  lng?: number;
  maxDistance?: number;
  skip?: number;
  limit?: number;
  sortBy?: 'rating' | 'price' | 'distance' | 'popularity';
}

class HotelService {
  /**
   * Get all hotels with optional filters
   */
  async getHotels(params: HotelSearchParams = {}): Promise<{
    hotels: IHotel[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        query,
        hotelType,
        province,
        landmarkId,
        minStars,
        maxStars,
        minPrice,
        maxPrice,
        amenities,
        isFeatured,
        lat,
        lng,
        maxDistance = 10000,
        skip = 0,
        limit = 20,
        sortBy = 'rating',
      } = params;

      // Build query
      const filter: Record<string, unknown> = { status: 'active' };

      if (hotelType) {
        filter.hotelType = hotelType;
      }

      if (province) {
        filter.province = new RegExp(province, 'i');
      }

      if (landmarkId) {
        filter.landmark = new mongoose.Types.ObjectId(landmarkId);
      }

      if (minStars !== undefined || maxStars !== undefined) {
        filter.starRating = {};
        if (minStars !== undefined) (filter.starRating as Record<string, number>).$gte = minStars;
        if (maxStars !== undefined) (filter.starRating as Record<string, number>).$lte = maxStars;
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        filter['priceRange.min'] = {};
        if (minPrice !== undefined) (filter['priceRange.min'] as Record<string, number>).$gte = minPrice;
        if (maxPrice !== undefined) (filter['priceRange.min'] as Record<string, number>).$lte = maxPrice;
      }

      if (amenities && amenities.length > 0) {
        filter.amenities = { $all: amenities };
      }

      if (isFeatured !== undefined) {
        filter.isFeatured = isFeatured;
      }

      // Text search
      if (query) {
        const regex = new RegExp(query, 'i');
        filter.$or = [
          { name: regex },
          { nameLocal: regex },
          { description: regex },
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
        case 'rating':
          sort = { ...sort, rating: -1, reviewCount: -1 };
          break;
        case 'price':
          sort = { ...sort, 'priceRange.min': 1 };
          break;
        case 'popularity':
          sort = { ...sort, viewCount: -1, bookingCount: -1 };
          break;
        default:
          sort = { ...sort, rating: -1 };
      }

      // Execute query
      const [hotels, total] = await Promise.all([
        Hotel.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('landmark', 'name nameLocal type')
          .lean(),
        Hotel.countDocuments(filter),
      ]);

      return {
        hotels: hotels as unknown as IHotel[],
        total,
        hasMore: skip + hotels.length < total,
      };
    } catch (error) {
      logger.error('[HotelService] Error getting hotels:', error);
      throw error;
    }
  }

  /**
   * Get featured hotels
   */
  async getFeaturedHotels(params: { 
    province?: string;
    limit?: number;
  } = {}): Promise<IHotel[]> {
    try {
      const { province, limit = 10 } = params;

      const filter: Record<string, unknown> = { 
        status: 'active', 
        isFeatured: true,
      };

      if (province) {
        filter.province = new RegExp(province, 'i');
      }

      const hotels = await Hotel.find(filter)
        .sort({ rating: -1, reviewCount: -1 })
        .limit(limit)
        .populate('landmark', 'name nameLocal')
        .lean();

      return hotels as unknown as IHotel[];
    } catch (error) {
      logger.error('[HotelService] Error getting featured hotels:', error);
      throw error;
    }
  }

  /**
   * Get hotels near a landmark
   */
  async getHotelsNearLandmark(landmarkId: string, limit = 10): Promise<IHotel[]> {
    try {
      // Get landmark location
      const landmarkLocation = await landmarkService.getLandmarkLocation(landmarkId);
      
      if (!landmarkLocation) {
        // Fallback to direct landmark reference
        const hotels = await Hotel.find({ 
          status: 'active',
          landmark: new mongoose.Types.ObjectId(landmarkId),
        })
          .sort({ isFeatured: -1, rating: -1 })
          .limit(limit)
          .lean();
        return hotels as unknown as IHotel[];
      }

      // Search by geolocation
      const hotels = await Hotel.find({
        status: 'active',
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [landmarkLocation.lng, landmarkLocation.lat],
            },
            $maxDistance: landmarkLocation.radius + 2000, // Landmark radius + 2km
          },
        },
      })
        .sort({ isFeatured: -1, rating: -1 })
        .limit(limit)
        .lean();

      return hotels as unknown as IHotel[];
    } catch (error) {
      logger.error('[HotelService] Error getting hotels near landmark:', error);
      throw error;
    }
  }

  /**
   * Search hotels by keyword
   */
  async searchHotels(keyword: string, limit = 10): Promise<IHotel[]> {
    try {
      const regex = new RegExp(keyword, 'i');

      const hotels = await Hotel.find({
        status: 'active',
        $or: [
          { name: regex },
          { nameLocal: regex },
          { description: regex },
          { landmarkName: regex },
          { address: regex },
        ],
      })
        .sort({ isFeatured: -1, rating: -1 })
        .limit(limit)
        .lean();

      return hotels as unknown as IHotel[];
    } catch (error) {
      logger.error('[HotelService] Error searching hotels:', error);
      throw error;
    }
  }

  /**
   * Get hotel by ID
   */
  async getHotelById(id: string): Promise<IHotel | null> {
    try {
      const hotel = await Hotel.findOne({ 
        _id: id, 
        status: 'active',
      }).populate('landmark', 'name nameLocal type location');

      if (hotel) {
        // Track view count (non-blocking)
        Hotel.updateOne(
          { _id: id },
          { $inc: { viewCount: 1 } }
        ).catch(err => logger.error('[HotelService] Error updating view count:', err));
      }

      return hotel;
    } catch (error) {
      logger.error('[HotelService] Error getting hotel by ID:', error);
      throw error;
    }
  }

  /**
   * Get hotel types with counts
   */
  async getHotelTypes(): Promise<{ type: HotelType; count: number; label: string }[]> {
    try {
      const types = await Hotel.aggregate([
        { $match: { status: 'active' } },
        { $group: { _id: '$hotelType', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]);

      const typeLabels: Record<HotelType, string> = {
        hotel: 'Hotels',
        resort: 'Resorts',
        boutique: 'Boutique Hotels',
        guesthouse: 'Guesthouses',
        hostel: 'Hostels',
        apartment: 'Apartments',
        villa: 'Villas',
      };

      return types.map(t => ({
        type: t._id as HotelType,
        count: t.count,
        label: typeLabels[t._id as HotelType] || t._id,
      }));
    } catch (error) {
      logger.error('[HotelService] Error getting hotel types:', error);
      throw error;
    }
  }

  /**
   * Get available amenities
   */
  async getAmenities(): Promise<{ amenity: string; count: number }[]> {
    try {
      const amenities = await Hotel.aggregate([
        { $match: { status: 'active' } },
        { $unwind: '$amenities' },
        { $group: { _id: '$amenities', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 50 },
      ]);

      return amenities.map(a => ({
        amenity: a._id,
        count: a.count,
      }));
    } catch (error) {
      logger.error('[HotelService] Error getting amenities:', error);
      throw error;
    }
  }

  /**
   * Track hotel inquiry (when user clicks contact)
   */
  async trackInquiry(hotelId: string): Promise<void> {
    try {
      await Hotel.updateOne(
        { _id: hotelId },
        { $inc: { inquiryCount: 1 } }
      );
    } catch (error) {
      logger.error('[HotelService] Error tracking inquiry:', error);
    }
  }

  /**
   * Admin: Create a new hotel
   */
  async createHotel(data: Partial<IHotel>): Promise<IHotel> {
    try {
      const hotel = new Hotel({
        ...data,
        status: 'pending',
        viewCount: 0,
        inquiryCount: 0,
        bookingCount: 0,
        rating: 0,
        reviewCount: 0,
      });

      await hotel.save();
      logger.info(`[HotelService] Created hotel: ${hotel.name}`);

      return hotel;
    } catch (error) {
      logger.error('[HotelService] Error creating hotel:', error);
      throw error;
    }
  }

  /**
   * Admin: Update a hotel
   */
  async updateHotel(id: string, data: Partial<IHotel>): Promise<IHotel | null> {
    try {
      const hotel = await Hotel.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      );

      if (hotel) {
        logger.info(`[HotelService] Updated hotel: ${hotel.name}`);
      }

      return hotel;
    } catch (error) {
      logger.error('[HotelService] Error updating hotel:', error);
      throw error;
    }
  }

  /**
   * Admin: Change hotel status
   */
  async updateHotelStatus(id: string, status: 'active' | 'inactive' | 'pending' | 'suspended'): Promise<boolean> {
    try {
      const result = await Hotel.updateOne(
        { _id: id },
        { $set: { status } }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('[HotelService] Error updating hotel status:', error);
      throw error;
    }
  }
}

export const hotelService = new HotelService();
export default hotelService;
