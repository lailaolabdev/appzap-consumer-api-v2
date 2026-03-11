import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { hydrateCart, clearCart } from '../controllers/cart.controller';
import { syncCart, getAbandonedCartStats } from '../controllers/cartSync.controller';

const router: Router = Router();

/**
 * Feature 03: Web-to-Native cart hydration
 * GET  /api/v1/cart/hydrate — pull existing web cart into native app
 * DELETE /api/v1/cart/hydrate — mark cart as converted on checkout
 */
router.get('/hydrate', authenticate, hydrateCart);
router.delete('/hydrate', authenticate, clearCart);

/**
 * Feature 12: Cart Sync & Server-Side Price Math
 *
 * POST /api/v1/cart/sync
 *   Continuously called by the mobile app as the user modifies their bag.
 *   - Validates orderType (DINE_IN | TAKEAWAY | DELIVERY)
 *   - Enforces deliveryAddressId when orderType === DELIVERY
 *   - Checks required modifier group selections
 *   - Calculates server-side total from trusted POS menu prices
 *   - Upserts the CartSession document
 */
router.post('/sync', authenticate, syncCart);

/**
 * GET /api/v1/cart/abandoned-stats — Admin: unchecked-out cart volume (last 24h)
 */
router.get('/abandoned-stats', authenticate, getAbandonedCartStats);

export default router;
