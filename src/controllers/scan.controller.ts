import { Request, Response } from 'express';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';
import { redisHelpers } from '../config/redis';
import { unifiedRestaurantService } from '../services/unifiedRestaurant.service';

type ScanResolveResult = {
  restaurantId: string;
  tableId?: string;
  tableNumber?: string;
};

const tryParseV1 = (raw: string): ScanResolveResult | null => {
  const uri = UriTryParse(raw);
  if (!uri) return null;

  const host = (uri.host || '').toLowerCase();
  const path = (uri.pathname || '').toLowerCase();

  // POS V1 Self-ordering QR pattern:
  // https://client.appzap.la/store/self-ordering/{storeId}?token=JWT
  const v1HostMatch = host === 'client.appzap.la';
  const v1PathMatch = path.startsWith('/store/self-ordering/');
  if (!v1HostMatch || !v1PathMatch) return null;

  const segments = uri.pathname.split('/').filter(Boolean);
  const storeId = segments.length >= 3 ? segments[2] : null;
  if (!storeId) return null;

  // Table information is encoded inside the JWT `token` query param.
  const token = uri.searchParams.get('token');
  let tableId: string | undefined;
  let tableNumber: string | undefined;

  if (token) {
    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson) as any;
        const data = payload.data || {};
        tableId = data.tableId || data.tableID || undefined;
        tableNumber = data.code || data.tableCode || tableId || undefined;
      } catch {
        // If decoding fails, we still resolve restaurantId and let table be optional.
      }
    }
  }

  return { restaurantId: `v1_${storeId}`, tableId, tableNumber };
};

const tryParseV2 = (raw: string): ScanResolveResult | null => {
  const uri = UriTryParse(raw);

  let id: string | null = null;
  let tableId: string | undefined;
  let tableNumber: string | undefined;

  if (uri) {
    const host = (uri.host || '').toLowerCase();
    const path = (uri.pathname || '').toLowerCase();

    // Primary POS V2 QR pattern:
    // https://mobile-order-v2.appzap.la/qr/{uuid}
    const v2HostMatch = host === 'mobile-order-v2.appzap.la';
    const v2PathMatch = path.startsWith('/qr/');

    if (!v2HostMatch || !v2PathMatch) {
      return null;
    }

    const segs = uri.pathname.split('/').filter(Boolean);
    if (segs.length >= 2) {
      id = segs[1]; // "qr/{uuid}"
    }

    tableId =
      uri.searchParams.get('tableId') ||
      uri.searchParams.get('table') ||
      uri.searchParams.get('t') ||
      undefined;
    tableNumber = uri.searchParams.get('tableNumber') || tableId || undefined;
  } else {
    return null;
  }

  if (!id) return null;
  if (id.startsWith('v1_')) return null;

  // Normalize unified id
  const restaurantId = id.startsWith('v2_') ? id : `v2_${id}`;

  // Very loose UUID-ish check: allow mongo-like ids too
  const candidate = restaurantId.substring(3);
  if (!/^[a-zA-Z0-9-_]{6,64}$/.test(candidate)) return null;

  return { restaurantId, tableId, tableNumber };
};

const UriTryParse = (raw: string): URL | null => {
  try {
    // URL requires scheme; handle appzap:// and http(s)://
    if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(raw)) return new URL(raw);
    return null;
  } catch {
    return null;
  }
};

export const resolveScanPayload = async (req: Request, res: Response): Promise<void> => {
  const started = Date.now();
  try {
    const { rawString } = req.body || {};
    if (!rawString || typeof rawString !== 'string' || rawString.trim().length < 3) {
      throw new ValidationError('rawString is required', { field: 'rawString' });
    }

    const raw = rawString.trim();
    const parsed = tryParseV1(raw) || tryParseV2(raw);
    if (!parsed) {
      res.status(400).json({
        error: {
          code: 'INVALID_APPZAP_QR',
          message: 'Invalid AppZap QR Code',
          statusCode: 400,
        },
      });
      return;
    }

    // Hydrate menu categories using Redis cache first (fast path).
    const cacheKey = `scan:menuCategories:${parsed.restaurantId}`;
    let menuCategories: any[] | null = null;
    const cached = await redisHelpers.get(cacheKey);
    if (cached) {
      try {
        menuCategories = JSON.parse(cached);
      } catch {
        menuCategories = null;
      }
    }

    if (!menuCategories) {
      const { posVersion, posRestaurantId } = unifiedRestaurantService.parseRestaurantId(parsed.restaurantId);
      const menu = await unifiedRestaurantService.getMenu(posRestaurantId, posVersion, { limit: 200 });
      menuCategories = menu.categories || [];
      await redisHelpers.setWithTTL(cacheKey, JSON.stringify(menuCategories), 900); // 15 minutes
    }

    res.json({
      success: true,
      restaurantId: parsed.restaurantId,
      tableId: parsed.tableId,
      tableNumber: parsed.tableNumber,
      menuCategories,
      latencyMs: Date.now() - started,
    });
  } catch (error: any) {
    logger.error('[Scan] resolve failed', { error: error.message });
    res.status(error.statusCode || 500).json({
      error: {
        code: error.code || 'SCAN_RESOLVE_FAILED',
        message: error.message || 'Failed to resolve QR payload',
        statusCode: error.statusCode || 500,
      },
    });
  }
};

