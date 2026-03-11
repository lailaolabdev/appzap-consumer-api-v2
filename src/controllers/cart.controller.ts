import { Request, Response } from 'express';
import CartSession from '../models/CartSession';
import User from '../models/User';
import logger from '../utils/logger';

/**
 * @desc    Hydrate Active Cart (Feature 03 Web-to-Native Sync)
 * @route   GET /api/v1/cart/hydrate
 * @access  Private
 */
export const hydrateCart = async (req: Request, res: Response) => {
    try {
        const user = req.user as any; // Rehydrate from protect middleware

        // Safety check - should be authenticated
        if (!user || !user.phone) {
            return res.status(401).json({ success: false, error: 'Unauthorized payload exception' });
        }

        // Attempt to locate an active cart matching the user's phone number
        // This allows a cart built on order.appzap.la unauthenticated table QR scanner to seamlessly teleport to native app when they log in
        const activeCart = await CartSession.findOne({
            phone: user.phone,
            status: 'active'
        });

        if (!activeCart) {
            return res.status(200).json({
                success: true,
                data: null,
                message: 'No dangling web carts found for hydration'
            });
        }

        // Standardize identity
        if (!activeCart.userId) {
            activeCart.userId = user._id;
            await activeCart.save();
        }

        return res.status(200).json({
            success: true,
            data: activeCart,
            message: 'Cart payload hydrated successfully from Web Session'
        });

    } catch (error: any) {
        logger.error('Failed to hydrate cart session', { error: error.message });
        return res.status(500).json({ success: false, error: 'Server disruption resolving cart hydration' });
    }
};

/**
 * @desc    Clear active cart on checkout
 * @route   DELETE /api/v1/cart/hydrate
 * @access  Private
 */
export const clearCart = async (req: Request, res: Response) => {
    try {
        const user = req.user as any;
        if (!user || !user.phone) return res.status(401).json({ success: false });

        await CartSession.updateMany(
            { phone: user.phone, status: 'active' },
            { $set: { status: 'converted' } }
        );

        return res.status(200).json({ success: true, message: 'Cart cleaned securely' });
    } catch (err: any) {
        return res.status(500).json({ success: false });
    }
};
