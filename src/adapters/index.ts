/**
 * POS Adapters Index
 * 
 * Central export point for all POS adapter functionality.
 * This provides a clean API for the rest of the application to use.
 */

// Types
export * from '../types/unified.types';
export * from './pos.interface';

// Adapters
export { POSV1Adapter, posV1Adapter, createPOSV1Adapter } from './posV1.adapter';
export { POSV2Adapter, posV2Adapter, createPOSV2Adapter } from './posV2.adapter';

// Router
export { POSRouter, posRouter, createPOSRouter } from './pos.router';
export type { ParsedRestaurantId, RouterConfig } from './pos.router';

// Default export is the router (most commonly used)
export { posRouter as default } from './pos.router';
