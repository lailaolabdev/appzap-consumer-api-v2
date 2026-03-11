import { Router } from 'express';
import * as scanController from '../controllers/scan.controller';

const router = Router();

/**
 * POST /api/v1/scan/resolve
 * Public endpoint: resolve QR raw payload into restaurant + table + menu categories
 */
router.post('/resolve', scanController.resolveScanPayload);

export default router;

