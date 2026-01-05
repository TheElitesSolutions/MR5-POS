import { SETTINGS_CHANNELS } from '../../shared/ipc-channels';
import { AppError, logInfo } from '../error-handler';
import { SettingModel } from '../models/Setting';
import { BaseController } from './baseController';
// import { prisma } from '../db/prisma-wrapper'; // Available if needed
export class SettingsController extends BaseController {
    // private prisma = prisma; // Available if needed
    constructor() {
        super();
        // this.initialize(); // Removed: StartupManager calls initialize() explicitly
    }
    registerHandlers() {
        // Get all settings
        this.registerHandler(SETTINGS_CHANNELS.GET_ALL, async (_event) => {
            try {
                const settings = await SettingModel.getAllSettings();
                logInfo(`Retrieved ${settings.length} settings`);
                return this.createSuccessResponse(settings);
            }
            catch (error) {
                return this.createErrorResponse(error instanceof Error ? error : String(error));
            }
        });
        // Get setting by key
        this.registerHandler(SETTINGS_CHANNELS.GET_BY_KEY, async (_event, key) => {
            try {
                if (!key) {
                    throw new AppError('Setting key is required', true);
                }
                const setting = await SettingModel.getSettingByKey(key);
                return this.createSuccessResponse(setting);
            }
            catch (error) {
                return this.createErrorResponse(error instanceof Error ? error : String(error));
            }
        });
        // Update setting
        this.registerHandler(SETTINGS_CHANNELS.UPDATE, async (_event, params) => {
            try {
                const { key, value, type } = params;
                if (!key || value === undefined) {
                    throw new AppError('Setting key and value are required', true);
                }
                const setting = await SettingModel.updateSetting(key, value, type);
                logInfo(`Setting updated successfully: ${key}`);
                return this.createSuccessResponse(setting);
            }
            catch (error) {
                return this.createErrorResponse(error instanceof Error ? error : String(error));
            }
        });
        // Update multiple settings
        this.registerHandler(SETTINGS_CHANNELS.UPDATE_MULTIPLE, async (_event, settings) => {
            try {
                if (!settings || settings.length === 0) {
                    throw new AppError('Settings array is required', true);
                }
                const updatedSettings = await SettingModel.updateMultipleSettings(settings);
                logInfo(`Updated ${updatedSettings.length} settings`);
                return this.createSuccessResponse(updatedSettings);
            }
            catch (error) {
                return this.createErrorResponse(error instanceof Error ? error : String(error));
            }
        });
        // Get settings by category
        this.registerHandler(SETTINGS_CHANNELS.GET_BY_CATEGORY, async (_event, category) => {
            try {
                if (!category) {
                    throw new AppError('Category is required', true);
                }
                const settings = await SettingModel.getSettingsByCategory(category);
                logInfo(`Retrieved ${settings.length} settings for category: ${category}`);
                return this.createSuccessResponse(settings);
            }
            catch (error) {
                return this.createErrorResponse(error instanceof Error ? error : String(error));
            }
        });
        // Reset settings
        this.registerHandler(SETTINGS_CHANNELS.RESET, async (_event, category) => {
            try {
                const success = await SettingModel.resetSettings(category);
                logInfo(`Settings reset successfully${category ? ` for category: ${category}` : ''}`);
                return this.createSuccessResponse(success);
            }
            catch (error) {
                return this.createErrorResponse(error instanceof Error ? error : String(error));
            }
        });
        // Get typed setting value
        this.registerHandler(SETTINGS_CHANNELS.GET_TYPED_VALUE, async (_event, key) => {
            try {
                if (!key) {
                    throw new AppError('Setting key is required', true);
                }
                const value = await SettingModel.getTypedValue(key);
                return this.createSuccessResponse(value);
            }
            catch (error) {
                return this.createErrorResponse(error instanceof Error ? error : String(error));
            }
        });
        logInfo('Settings IPC handlers registered');
    }
    unregisterHandlers() {
        const handlers = [
            SETTINGS_CHANNELS.GET_ALL,
            SETTINGS_CHANNELS.GET_BY_KEY,
            SETTINGS_CHANNELS.UPDATE,
            SETTINGS_CHANNELS.RESET,
            SETTINGS_CHANNELS.UPDATE_MULTIPLE,
            SETTINGS_CHANNELS.GET_BY_CATEGORY,
            SETTINGS_CHANNELS.GET_TYPED_VALUE,
        ];
        handlers.forEach(handler => {
            this.unregisterHandler(handler);
        });
        logInfo('Settings IPC handlers unregistered');
    }
}
