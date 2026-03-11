import { Router } from 'express';
import * as configController from '../controllers/config.controller';
import { authenticate } from '../middleware/auth.middleware';

const router: Router = Router();

// Public: Super fast boot gateway check
router.get('/boot', configController.getBootConfig);

// Private: Admin UI updates boot constraints
router.put('/boot', authenticate, configController.updateBootConfig);

export default router;
