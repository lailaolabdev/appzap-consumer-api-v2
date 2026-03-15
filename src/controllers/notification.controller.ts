import { Request, Response } from 'express';
import DeviceToken from '../models/DeviceToken';
import User from '../models/User';
import { Notification, NotificationPreferences } from '../models/Notification';
import Broadcast from '../models/Broadcast';
import { addBroadcastJob } from '../config/queue';
import logger from '../utils/logger';

/**
 * @desc    Register FCM Device Token for Push Notifications
 * @route   POST /api/v1/notifications/device/register
 * @access  Private
 */
export const registerDeviceToken = async (req: Request, res: Response) => {
    try {
        const user = req.user as any;
        const { fcmToken, deviceOS, appVersion } = req.body;

        if (!fcmToken) {
            return res.status(400).json({ success: false, error: 'fcmToken is required' });
        }

        const device = await DeviceToken.findOneAndUpdate(
            { fcmToken },
            {
                user: user._id,
                deviceOS,
                appVersion,
                lastActive: new Date(),
                isActive: true
            },
            { upsert: true, new: true }
        );

        return res.status(200).json({
            success: true,
            data: device,
            message: 'FCM Device Token registered successfully'
        });
    } catch (error: any) {
        logger.error('Failed to register device token', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to register device token' });
    }
};

/**
 * @desc    Admin Broadcast Dispatch (Targeted Audience)
 * @route   POST /api/v1/notifications/admin/broadcast/dispatch
 * @access  Private (Admin Only)
 */
export const dispatchBroadcast = async (req: Request, res: Response) => {
    try {
        const user = req.user as any;
        const { title, body, deepLinkUrl, minAge, sex } = req.body;

        if (!title || !body) {
            return res.status(400).json({ success: false, error: 'title and body are required' });
        }

        // 1. Build demographic query
        const userQuery: any = {};
        if (sex) userQuery.sex = sex;
        if (minAge) {
            const targetBirthYearLimit = new Date().getFullYear() - minAge;
            userQuery.yearOfBirth = { $lte: targetBirthYearLimit };
        }

        // 2. Resolve target users
        const matchedUsers = await User.find(userQuery).select('_id');
        const userIds = matchedUsers.map(u => u._id);

        // 3. Resolve active FCM tokens
        const tokens = await DeviceToken.find({
            user: { $in: userIds },
            isActive: true
        }).select('fcmToken');

        const fcmTokens = tokens.map(t => t.fcmToken);

        if (fcmTokens.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No active devices matched targeting criteria. 0 notifications dispatched.'
            });
        }

        // 4. Create broadcast record
        const broadcast = await Broadcast.create({
            title,
            body,
            deepLinkUrl,
            targeting: { minAge, sex },
            status: 'queued',
            stats: { totalTokens: fcmTokens.length, sent: 0, failed: 0 },
            createdBy: user._id,
        });

        // 5. Queue broadcast job for async processing
        await addBroadcastJob({
            title,
            body,
            deepLinkUrl,
            fcmTokens,
            broadcastId: broadcast._id.toString(),
        });

        return res.status(202).json({
            success: true,
            message: 'Broadcast queued for delivery',
            data: {
                broadcastId: broadcast._id,
                totalTargetAudience: fcmTokens.length,
            }
        });

    } catch (error: any) {
        logger.error('Failed to dispatch broadcast', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to dispatch broadcast' });
    }
};

/**
 * @desc    Get broadcast history (admin)
 * @route   GET /api/v1/notifications/admin/broadcasts
 * @access  Private (Admin)
 */
export const getBroadcasts = async (req: Request, res: Response) => {
    try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [broadcasts, total] = await Promise.all([
            Broadcast.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Broadcast.countDocuments(),
        ]);

        return res.status(200).json({
            success: true,
            data: broadcasts,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        logger.error('Failed to get broadcasts', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to get broadcasts' });
    }
};

/**
 * @desc    Get single broadcast detail (admin)
 * @route   GET /api/v1/notifications/admin/broadcasts/:id
 * @access  Private (Admin)
 */
export const getBroadcastById = async (req: Request, res: Response) => {
    try {
        const broadcast = await Broadcast.findById(req.params.id).lean();
        if (!broadcast) {
            return res.status(404).json({ success: false, error: 'Broadcast not found' });
        }

        return res.status(200).json({ success: true, data: broadcast });
    } catch (error: any) {
        logger.error('Failed to get broadcast', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to get broadcast' });
    }
};

/**
 * @desc    Get user's notification history
 * @route   GET /api/v1/notifications/history
 * @access  Private
 */
export const getNotificationHistory = async (req: Request, res: Response) => {
    try {
        const user = req.user as any;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 20;
        const skip = (page - 1) * limit;

        const [notifications, total] = await Promise.all([
            Notification.find({ userId: user._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Notification.countDocuments({ userId: user._id }),
        ]);

        return res.status(200).json({
            success: true,
            data: notifications,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error: any) {
        logger.error('Failed to get notification history', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to get notification history' });
    }
};

/**
 * @desc    Get unread notification count
 * @route   GET /api/v1/notifications/unread-count
 * @access  Private
 */
export const getUnreadCount = async (req: Request, res: Response) => {
    try {
        const user = req.user as any;
        const count = await Notification.countDocuments({ userId: user._id, isRead: false });

        return res.status(200).json({ success: true, data: { count } });
    } catch (error: any) {
        logger.error('Failed to get unread count', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to get unread count' });
    }
};

/**
 * @desc    Mark notification as read
 * @route   PUT /api/v1/notifications/:notificationId/read
 * @access  Private
 */
export const markAsRead = async (req: Request, res: Response) => {
    try {
        const user = req.user as any;
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.notificationId, userId: user._id },
            { isRead: true, readAt: new Date() },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }

        return res.status(200).json({ success: true, data: notification });
    } catch (error: any) {
        logger.error('Failed to mark notification as read', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
    }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/v1/notifications/read-all
 * @access  Private
 */
export const markAllAsRead = async (req: Request, res: Response) => {
    try {
        const user = req.user as any;
        const result = await Notification.updateMany(
            { userId: user._id, isRead: false },
            { isRead: true, readAt: new Date() }
        );

        return res.status(200).json({
            success: true,
            data: { modifiedCount: result.modifiedCount },
        });
    } catch (error: any) {
        logger.error('Failed to mark all as read', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to mark all as read' });
    }
};

/**
 * @desc    Get user notification preferences
 * @route   GET /api/v1/notifications/preferences
 * @access  Private
 */
export const getPreferences = async (req: Request, res: Response) => {
    try {
        const user = req.user as any;
        let preferences = await NotificationPreferences.findOne({ userId: user._id }).lean();

        if (!preferences) {
            // Return defaults
            preferences = {
                promotions: true,
                orders: true,
                newRestaurants: true,
                dailyDeals: true,
                events: true,
                sponsorMessages: true,
            } as any;
        }

        return res.status(200).json({ success: true, data: preferences });
    } catch (error: any) {
        logger.error('Failed to get preferences', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to get preferences' });
    }
};

/**
 * @desc    Update user notification preferences
 * @route   PUT /api/v1/notifications/preferences
 * @access  Private
 */
export const updatePreferences = async (req: Request, res: Response) => {
    try {
        const user = req.user as any;
        const { promotions, orders, newRestaurants, dailyDeals, events, sponsorMessages } = req.body;

        const update: any = {};
        if (promotions !== undefined) update.promotions = promotions;
        if (orders !== undefined) update.orders = orders;
        if (newRestaurants !== undefined) update.newRestaurants = newRestaurants;
        if (dailyDeals !== undefined) update.dailyDeals = dailyDeals;
        if (events !== undefined) update.events = events;
        if (sponsorMessages !== undefined) update.sponsorMessages = sponsorMessages;

        const preferences = await NotificationPreferences.findOneAndUpdate(
            { userId: user._id },
            { $set: update },
            { upsert: true, new: true }
        );

        return res.status(200).json({ success: true, data: preferences });
    } catch (error: any) {
        logger.error('Failed to update preferences', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to update preferences' });
    }
};
