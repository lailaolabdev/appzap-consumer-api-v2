import { Request, Response } from 'express';
import DeliveryAddress from '../models/DeliveryAddress';
import logger from '../utils/logger';
import { ValidationError, NotFoundError } from '../utils/errors';

// ============================================================================
// DELIVERY ADDRESS MANAGEMENT
// ============================================================================

/**
 * Get User Delivery Addresses
 * GET /api/v1/market/addresses
 */
export const getUserAddresses = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const addresses = await DeliveryAddress.find({ userId: req.user._id })
      .sort({ isDefault: -1, createdAt: -1 })
      .lean();

    res.json({
      data: addresses,
      total: addresses.length,
    });
  } catch (error: any) {
    logger.error('Failed to get user addresses', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_ADDRESSES_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Get Address Details
 * GET /api/v1/market/addresses/:addressId
 */
export const getAddressById = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { addressId } = req.params;

    const address = await DeliveryAddress.findById(addressId);

    if (!address) {
      throw new NotFoundError('DeliveryAddress', addressId);
    }

    if (address.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Address does not belong to user');
    }

    res.json(address);
  } catch (error: any) {
    logger.error('Failed to get address details', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'GET_ADDRESS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Create Delivery Address
 * POST /api/v1/market/addresses
 */
export const createAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const {
      label,
      recipientName,
      phone,
      addressLine1,
      addressLine2,
      district,
      city,
      province,
      postalCode,
      latitude,
      longitude,
      notes,
      isDefault,
    } = req.body;

    if (!label || !recipientName || !phone || !addressLine1 || !district || !city || !province) {
      throw new ValidationError('Required fields: label, recipientName, phone, addressLine1, district, city, province');
    }

    const address = await DeliveryAddress.create({
      userId: req.user._id,
      label,
      recipientName,
      phone,
      addressLine1,
      addressLine2,
      district,
      city,
      province,
      postalCode,
      latitude,
      longitude,
      notes,
      isDefault: isDefault || false,
    });

    logger.info('Delivery address created', {
      addressId: address._id.toString(),
      userId: req.user._id.toString(),
      label,
    });

    res.json({
      addressId: address._id,
      message: 'Address created successfully',
      address,
    });
  } catch (error: any) {
    logger.error('Failed to create address', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'CREATE_ADDRESS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Update Delivery Address
 * PUT /api/v1/market/addresses/:addressId
 */
export const updateAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { addressId } = req.params;

    const address = await DeliveryAddress.findById(addressId);

    if (!address) {
      throw new NotFoundError('DeliveryAddress', addressId);
    }

    if (address.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Address does not belong to user');
    }

    // Update fields
    const updateFields = [
      'label', 'recipientName', 'phone', 'addressLine1', 'addressLine2',
      'district', 'city', 'province', 'postalCode', 'latitude', 'longitude',
      'notes', 'isDefault',
    ];

    updateFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        (address as any)[field] = req.body[field];
      }
    });

    await address.save();

    logger.info('Delivery address updated', {
      addressId: address._id.toString(),
      userId: req.user._id.toString(),
    });

    res.json({
      message: 'Address updated successfully',
      address,
    });
  } catch (error: any) {
    logger.error('Failed to update address', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'UPDATE_ADDRESS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Delete Delivery Address
 * DELETE /api/v1/market/addresses/:addressId
 */
export const deleteAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { addressId } = req.params;

    const address = await DeliveryAddress.findById(addressId);

    if (!address) {
      throw new NotFoundError('DeliveryAddress', addressId);
    }

    if (address.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Address does not belong to user');
    }

    await address.deleteOne();

    logger.info('Delivery address deleted', {
      addressId,
      userId: req.user._id.toString(),
    });

    res.json({
      message: 'Address deleted successfully',
      addressId,
    });
  } catch (error: any) {
    logger.error('Failed to delete address', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'DELETE_ADDRESS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

/**
 * Set Default Address
 * POST /api/v1/market/addresses/:addressId/set-default
 */
export const setDefaultAddress = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      throw new ValidationError('User not authenticated');
    }

    const { addressId } = req.params;

    const address = await DeliveryAddress.findById(addressId);

    if (!address) {
      throw new NotFoundError('DeliveryAddress', addressId);
    }

    if (address.userId.toString() !== req.user._id.toString()) {
      throw new ValidationError('Address does not belong to user');
    }

    address.isDefault = true;
    await address.save();

    logger.info('Default address set', {
      addressId,
      userId: req.user._id.toString(),
    });

    res.json({
      message: 'Default address set successfully',
      addressId,
    });
  } catch (error: any) {
    logger.error('Failed to set default address', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'SET_DEFAULT_ADDRESS_FAILED',
        message: error.message,
        statusCode: error.statusCode || 500,
      },
    });
  }
};

