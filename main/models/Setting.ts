import { AppError } from '../error-handler';
import { Setting, SettingType } from '../types';
import { logger } from '../utils/logger';
import { getPrismaClient } from '../prisma';

export class SettingModel {
  /**
   * Get all settings
   */
  static async getAllSettings(): Promise<Setting[]> {
    try {
      const settings = await getPrismaClient().setting.findMany({
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      });

      return settings.map(this.formatSetting);
    } catch (error) {
      logger.error(
        `Failed to get all settings: ${
          error instanceof Error ? error.message : error
        }`,
        'SettingModel'
      );
      throw new AppError('Failed to retrieve settings', true);
    }
  }

  /**
   * Get setting by key
   */
  static async getSettingByKey(key: string): Promise<Setting | null> {
    try {
      const setting = await getPrismaClient().setting.findUnique({
        where: { key },
      });

      if (!setting) {
        return null;
      }

      return this.formatSetting(setting);
    } catch (error) {
      logger.error(
        `Failed to get setting by key "${key}": ${
          error instanceof Error ? error.message : error
        }`,
        'SettingModel'
      );
      throw new AppError('Failed to retrieve setting', true);
    }
  }

  /**
   * Get settings by category
   */
  static async getSettingsByCategory(category: string): Promise<Setting[]> {
    try {
      const settings = await getPrismaClient().setting.findMany({
        where: { category },
        orderBy: { key: 'asc' },
      });

      return settings.map(this.formatSetting);
    } catch (error) {
      logger.error(
        `Failed to get settings by category "${category}": ${
          error instanceof Error ? error.message : error
        }`,
        'SettingModel'
      );
      throw new AppError('Failed to retrieve settings by category', true);
    }
  }

  /**
   * Update setting value
   */
  static async updateSetting(
    key: string,
    value: string,
    type?: SettingType
  ): Promise<Setting> {
    try {
      // Validate value based on type
      if (type) {
        this.validateSettingValue(value, type);
      }

      const setting = await getPrismaClient().setting.upsert({
        where: { key },
        update: {
          value,
          ...(type && { type }),
          updatedAt: new Date().toISOString(),
        },
        create: {
          key,
          value,
          type: type || SettingType.STRING,
          category: 'general',
        },
      });

      logger.info(
        `Setting updated successfully: ${key} = ${value}`,
        'SettingModel'
      );

      return this.formatSetting(setting);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logger.error(
        `Failed to update setting "${key}": ${
          error instanceof Error ? error.message : error
        }`,
        'SettingModel'
      );
      throw new AppError('Failed to update setting', true);
    }
  }

  /**
   * Create or update multiple settings
   */
  static async updateMultipleSettings(
    settings: Array<{
      key: string;
      value: string;
      type?: SettingType;
      category?: string;
    }>
  ): Promise<Setting[]> {
    try {
      const results: Setting[] = [];

      for (const settingData of settings) {
        const setting = await getPrismaClient().setting.upsert({
          where: { key: settingData.key },
          update: {
            value: settingData.value,
            ...(settingData.type && { type: settingData.type }),
            updatedAt: new Date().toISOString(),
          },
          create: {
            key: settingData.key,
            value: settingData.value,
            type: settingData.type || SettingType.STRING,
            category: settingData.category || 'general',
          },
        });

        results.push(this.formatSetting(setting));
      }

      logger.info(
        `Multiple settings updated successfully: ${settings.length} settings`,
        'SettingModel'
      );

      return results;
    } catch (error) {
      logger.error(
        `Failed to update multiple settings: ${
          error instanceof Error ? error.message : error
        }`,
        'SettingModel'
      );
      throw new AppError('Failed to update settings', true);
    }
  }

  /**
   * Delete setting
   */
  static async deleteSetting(key: string): Promise<boolean> {
    try {
      await getPrismaClient().setting.delete({
        where: { key },
      });

      logger.info(`Setting deleted successfully: ${key}`, 'SettingModel');
      return true;
    } catch (error) {
      logger.error(
        `Failed to delete setting "${key}": ${
          error instanceof Error ? error.message : error
        }`,
        'SettingModel'
      );
      throw new AppError('Failed to delete setting', true);
    }
  }

  /**
   * Reset settings to defaults
   */
  static async resetSettings(category?: string): Promise<boolean> {
    try {
      const where = category ? { category } : {};

      await getPrismaClient().setting.deleteMany({ where });

      // Re-seed default settings
      await this.createDefaultSettings();

      logger.info(
        `Settings reset successfully${
          category ? ` for category: ${category}` : ''
        }`,
        'SettingModel'
      );
      return true;
    } catch (error) {
      logger.error(
        `Failed to reset settings${
          category ? ` for category "${category}"` : ''
        }: ${error instanceof Error ? error.message : error}`,
        'SettingModel'
      );
      throw new AppError('Failed to reset settings', true);
    }
  }

  /**
   * Get typed setting value
   */
  static async getTypedValue(key: string): Promise<any> {
    try {
      const setting = await this.getSettingByKey(key);
      if (!setting) {
        return null;
      }

      return this.parseValue(setting.value, setting.type as SettingType);
    } catch (error) {
      logger.error(
        `Failed to get typed setting value for "${key}": ${
          error instanceof Error ? error.message : error
        }`,
        'SettingModel'
      );
      throw new AppError('Failed to get setting value', true);
    }
  }

  /**
   * Validate setting value based on type
   */
  private static validateSettingValue(value: string, type: SettingType): void {
    switch (type) {
      case SettingType.NUMBER:
        if (isNaN(Number(value))) {
          throw new AppError(`Invalid number value: ${value}`, true);
        }
        break;
      case SettingType.BOOLEAN:
        if (value !== 'true' && value !== 'false') {
          throw new AppError(`Invalid boolean value: ${value}`, true);
        }
        break;
      case SettingType.JSON:
        try {
          JSON.parse(value);
        } catch {
          throw new AppError(`Invalid JSON value: ${value}`, true);
        }
        break;
    }
  }

  /**
   * Parse setting value based on type
   */
  private static parseValue(value: string, type: SettingType): any {
    switch (type) {
      case SettingType.NUMBER:
        return Number(value);
      case SettingType.BOOLEAN:
        return value === 'true';
      case SettingType.JSON:
        return JSON.parse(value);
      default:
        return value;
    }
  }

  /**
   * Create default settings
   */
  private static async createDefaultSettings(): Promise<void> {
    const defaultSettings = [
      {
        key: 'restaurant_name',
        value: 'mr5 Restaurant',
        type: SettingType.STRING,
        category: 'general',
      },
      {
        key: 'tax_rate',
        value: '0.08',
        type: SettingType.NUMBER,
        category: 'financial',
      },
      {
        key: 'service_charge',
        value: '0.18',
        type: SettingType.NUMBER,
        category: 'financial',
      },
      {
        key: 'auto_print_receipts',
        value: 'true',
        type: SettingType.BOOLEAN,
        category: 'operations',
      },
      {
        key: 'theme',
        value: 'light',
        type: SettingType.STRING,
        category: 'ui',
      },
    ];

    for (const setting of defaultSettings) {
      await getPrismaClient().setting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting,
      });
    }
  }

  /**
   * Format setting for response
   */
  private static formatSetting(setting: any): Setting {
    return {
      id: setting.id,
      key: setting.key,
      value: setting.value,
      type: setting.type as SettingType,
      category: setting.category,
      createdAt: setting.createdAt instanceof Date ? setting.createdAt : new Date(setting.createdAt),
      updatedAt: setting.updatedAt instanceof Date ? setting.updatedAt : new Date(setting.updatedAt),
    };
  }
}
