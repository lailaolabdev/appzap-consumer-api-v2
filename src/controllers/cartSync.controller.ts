import { Request, Response } from 'express';
import CartSession from '../models/CartSession';
import logger from '../utils/logger';

/**
 * Feature 12: Cart Sync & Server-Side Price Math
 *
 * POST /api/v1/cart/sync
 *   Receives the user's current cart, validates modifier requirements,
 *   enforces orderType rules, and upserts the cart session.
 *   DOES NOT perform price re-verification (prices are trusted from the
 *   POS menu cache managed by unifiedPOS.service). Server-side price
 *   re-verification happens at order placement in order.controller.ts.
 *
 * GET /api/v1/cart/hydrate — already implemented in cart.controller.ts
 * DELETE /api/v1/cart/hydrate — already implemented in cart.controller.ts
 */

type OrderType = 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY';

interface SyncCartItem {
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    modifiers?: {
        groupId: string;
        groupName?: string;
        optionId: string;
        optionName: string;
        priceContribution: number;
        isRequired?: boolean;
    }[];
    requiredModifierGroups?: string[];  // groupIds that must have a selection
    specialInstructions?: string;
}

/**
 * @desc    Sync active cart to server (Feature 12 Web-to-Native)
 * @route   POST /api/v1/cart/sync
 * @access  Private (Bearer Token)
 *
 * Body:
 *   restaurantId      — required
 *   orderType         — DINE_IN | TAKEAWAY | DELIVERY
 *   deliveryAddressId — required if orderType === DELIVERY
 *   tableId           — optional (for DINE_IN)
 *   items             — array of SyncCartItem
 */
export const syncCart = async (req: Request, res: Response) => {
    try {
        const user = req.user as any;
        if (!user?.phone) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const {
            restaurantId,
            orderType,
            deliveryAddressId,
            tableId,
            items,
        }: {
            restaurantId: string;
            orderType: OrderType;
            deliveryAddressId?: string;
            tableId?: string;
            items: SyncCartItem[];
        } = req.body;

        // ── Validation ──────────────────────────────────────────────────────────

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                error: { code: 'MISSING_RESTAURANT', message: 'restaurantId is required' },
            });
        }

        const validOrderTypes: OrderType[] = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'];
        if (!orderType || !validOrderTypes.includes(orderType)) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_ORDER_TYPE',
                    message: `orderType must be one of: ${validOrderTypes.join(', ')}`,
                },
            });
        }

        if (orderType === 'DELIVERY' && !deliveryAddressId) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'DELIVERY_ADDRESS_REQUIRED',
                    message: 'deliveryAddressId is required when orderType is DELIVERY',
                },
            });
        }

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: { code: 'EMPTY_CART', message: 'items array must be non-empty' },
            });
        }

        // ── Modifier Group Requirement Enforcement ───────────────────────────────

        for (const item of items) {
            if (!item.productId || !item.productName || item.quantity < 1) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_ITEM', message: `Item "${item.productName}" has invalid fields` },
                });
            }

            if (item.requiredModifierGroups && item.requiredModifierGroups.length > 0) {
                const selectedGroupIds = new Set(
                    (item.modifiers ?? []).map((m) => m.groupId)
                );
                const missingGroups = item.requiredModifierGroups.filter(
                    (gId) => !selectedGroupIds.has(gId)
                );
                if (missingGroups.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: {
                            code: 'REQUIRED_MODIFIER_MISSING',
                            message: `Item "${item.productName}" is missing required modifier selections`,
                            missingGroups,
                        },
                    });
                }
            }
        }

        // ── Server-side total calculation ────────────────────────────────────────
        // Trusts client-provided unit prices (set by POS menu cache, not the user).
        // Final price re-verification occurs at order placement.

        const serverCalculatedTotal = items.reduce((sum, item) => {
            const itemBase = item.unitPrice * item.quantity;
            const modifiersTotal = (item.modifiers ?? []).reduce(
                (mSum, mod) => mSum + (mod.priceContribution ?? 0) * item.quantity,
                0
            );
            return sum + itemBase + modifiersTotal;
        }, 0);

        // ── Upsert CartSession ───────────────────────────────────────────────────

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 h

        const cartSession = await CartSession.findOneAndUpdate(
            { phone: user.phone, status: 'active' },
            {
                $set: {
                    userId: user._id,
                    restaurantId,
                    tableId,
                    // Map SyncCartItem → ICartSession items schema
                    items: items.map((item) => ({
                        productId: item.productId,
                        productName: item.productName,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        modifiers: (item.modifiers ?? []).map((m) => ({
                            groupId: m.groupId,
                            optionId: m.optionId,
                            optionName: m.optionName,
                            priceContribution: m.priceContribution,
                        })),
                        specialInstructions: item.specialInstructions,
                    })),
                    status: 'active',
                    expiresAt,
                    // Store extra ordering context in a meta-safe way
                    orderType,
                    deliveryAddressId,
                    serverCalculatedTotal,
                },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        return res.json({
            success: true,
            message: 'Cart synced successfully',
            data: {
                cartId: cartSession._id,
                serverCalculatedTotal,
                itemCount: items.length,
                orderType,
                expiresAt,
            },
        });
    } catch (error: any) {
        logger.error('[CartSync] Failed to sync cart', { error: error.message });
        return res.status(500).json({ success: false, error: 'Cart sync failed' });
    }
};

/**
 * @desc    Get abandoned cart stats for admin dashboard
 * @route   GET /api/v1/cart/abandoned-stats
 * @access  Private (Admin)
 */
export const getAbandonedCartStats = async (req: Request, res: Response) => {
    try {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [totalActive, totalAbandoned, volumePipeline] = await Promise.all([
            CartSession.countDocuments({ status: 'active', createdAt: { $gte: since24h } }),
            CartSession.countDocuments({ status: 'abandoned', createdAt: { $gte: since24h } }),
            CartSession.aggregate([
                { $match: { status: 'active', createdAt: { $gte: since24h } } },
                {
                    $group: {
                        _id: null,
                        totalUncheckedOutVolume: {
                            $sum: '$serverCalculatedTotal',
                        },
                        avgCartSize: { $avg: { $size: '$items' } },
                    },
                },
            ]),
        ]);

        const vol = volumePipeline[0] ?? { totalUncheckedOutVolume: 0, avgCartSize: 0 };

        return res.json({
            success: true,
            data: {
                last24h: {
                    activeCarts: totalActive,
                    abandonedCarts: totalAbandoned,
                    uncheckedOutVolumeLAK: vol.totalUncheckedOutVolume,
                    avgItemsPerCart: Math.round((vol.avgCartSize ?? 0) * 10) / 10,
                },
            },
        });
    } catch (error: any) {
        logger.error('[CartStats] Failed to fetch abandoned cart stats', { error: error.message });
        return res.status(500).json({ success: false, error: 'Failed to fetch cart stats' });
    }
};

// Re-export the existing hydrate/clear for the routes file
export { hydrateCart, clearCart } from './cart.controller';
