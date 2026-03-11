import { Request, Response } from 'express';
// In a real production scenario, this would be fetched from MongoDB (e.g. ConfigModel)
// For Phase 1 startup, we are establishing the routing and default payload payload constraints.
let runtimeConfig = {
    ios_latest_version: '5.2.18',
    ios_minimum_required_version: '5.0.0',
    android_latest_version: '5.2.18',
    android_minimum_required_version: '5.0.0',
    isMaintenanceMode: false
};

/**
 * Handle GET /api/v1/config/boot
 * Executed < 50ms upon mobile app launch to gatekeep outdated apps and trigger emergency maintenance mode.
 * @route GET /api/v1/config/boot
 * @access Public
 */
export const getBootConfig = async (req: Request, res: Response) => {
    // Return the runtime configuration directly for ultra-fast response
    res.status(200).json({
        success: true,
        data: runtimeConfig
    });
};

/**
 * Handle PUT /api/v1/config/boot
 * Admin Dashboard updates the boot configuration directly.
 * @route PUT /api/v1/config/boot
 * @access Private (Admin Only) - assuming auth.middleware wraps this route
 */
export const updateBootConfig = async (req: Request, res: Response) => {
    const { ios_latest_version, ios_minimum_required_version, android_latest_version, android_minimum_required_version, isMaintenanceMode } = req.body;

    if (ios_latest_version !== undefined) runtimeConfig.ios_latest_version = ios_latest_version;
    if (ios_minimum_required_version !== undefined) runtimeConfig.ios_minimum_required_version = ios_minimum_required_version;
    if (android_latest_version !== undefined) runtimeConfig.android_latest_version = android_latest_version;
    if (android_minimum_required_version !== undefined) runtimeConfig.android_minimum_required_version = android_minimum_required_version;
    if (isMaintenanceMode !== undefined) runtimeConfig.isMaintenanceMode = typeof isMaintenanceMode === 'string' ? isMaintenanceMode === 'true' : isMaintenanceMode;

    // Ideally persist this to MongoDB `Config` document right here

    res.status(200).json({
        success: true,
        data: runtimeConfig,
        message: 'Boot configuration updated successfully'
    });
};
