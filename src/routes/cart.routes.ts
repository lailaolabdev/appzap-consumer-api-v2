import { Router } from 'express';
import * as cartController from '../controllers/cart.controller';
import { authenticate } from '../middleware/auth.middleware';

const router: Router = Router();

// Secure hydration logic
router.get('/hydrate', authenticate, cartController.hydrateCart);
router.delete('/hydrate', authenticate, cartController.clearCart);

export default router;
