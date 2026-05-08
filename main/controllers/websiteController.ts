/**
 * websiteController.ts — IPC bridge for the Website Manager UI.
 * All handlers delegate to WebsiteManagerService, which writes directly to
 * Supabase. The local SQLite database is not involved in any of these calls.
 */

import { IpcMainInvokeEvent } from 'electron';
import { WEBSITE_CHANNELS } from '../../shared/ipc-channels';
import { logInfo, logError } from '../error-handler';
import { getCurrentLocalDateTime } from '../utils/dateTime';
import { IPCResponse } from '../types/index';
import { BaseController } from './baseController';
import {
  WebsiteManagerService,
  getWebsiteManagerService,
  WebsiteSettingsPatch,
  ConcurrencyError,
} from '../services/websiteManagerService';

function ok<T>(data: T, message?: string): IPCResponse<T> {
  return { success: true, data, message, timestamp: getCurrentLocalDateTime() };
}

function fail(error: unknown): IPCResponse<never> {
  const msg = error instanceof Error ? error.message : String(error);
  return { success: false, error: msg, timestamp: getCurrentLocalDateTime() };
}

export class WebsiteController extends BaseController {
  private service: WebsiteManagerService;

  constructor() {
    super();
    this.service = getWebsiteManagerService();
    logInfo('WebsiteController: service dependency initialized');
  }

  protected registerHandlers(): void {
    this.registerHandler(WEBSITE_CHANNELS.LIST_ITEMS, this.handleListItems.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.LIST_CATEGORIES, this.handleListCategories.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.LIST_ADDONS, this.handleListAddOns.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.GET_SETTINGS, this.handleGetSettings.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.UPDATE_SETTINGS, this.handleUpdateSettings.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.REORDER_ITEMS, this.handleReorderItems.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.SET_FEATURED, this.handleSetFeatured.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.SET_VISIBILITY, this.handleSetVisibility.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.SET_CATEGORY_VISIBILITY, this.handleSetCategoryVisibility.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.BULK_SET_VISIBILITY, this.handleBulkSetVisibility.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.UPDATE_ITEM_CONTENT, this.handleUpdateItemContent.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.UPLOAD_ITEM_IMAGE, this.handleUploadItemImage.bind(this));
    this.registerHandler(WEBSITE_CHANNELS.RESET_WEBSITE, this.handleResetWebsite.bind(this));
  }

  // -------- read handlers --------

  private async handleListItems(_event: IpcMainInvokeEvent): Promise<IPCResponse<unknown>> {
    try {
      return ok(await this.service.listItems());
    } catch (e) {
      logError(e as Error, 'WebsiteController.listItems');
      return fail(e);
    }
  }

  private async handleListCategories(_event: IpcMainInvokeEvent): Promise<IPCResponse<unknown>> {
    try {
      return ok(await this.service.listCategories());
    } catch (e) {
      logError(e as Error, 'WebsiteController.listCategories');
      return fail(e);
    }
  }

  private async handleListAddOns(_event: IpcMainInvokeEvent): Promise<IPCResponse<unknown>> {
    try {
      return ok(await this.service.listAddOns());
    } catch (e) {
      logError(e as Error, 'WebsiteController.listAddOns');
      return fail(e);
    }
  }

  private async handleSetCategoryVisibility(
    _event: IpcMainInvokeEvent,
    payload: { categoryUuid: string; visible: boolean; actor: string },
  ): Promise<IPCResponse<unknown>> {
    try {
      return ok(
        await this.service.setCategoryVisibility(
          payload.categoryUuid,
          payload.visible,
          payload.actor || 'unknown',
        ),
      );
    } catch (e) {
      logError(e as Error, 'WebsiteController.setCategoryVisibility');
      return fail(e);
    }
  }

  private async handleGetSettings(_event: IpcMainInvokeEvent): Promise<IPCResponse<unknown>> {
    try {
      return ok(await this.service.getSettings());
    } catch (e) {
      logError(e as Error, 'WebsiteController.getSettings');
      return fail(e);
    }
  }

  // -------- write handlers --------

  private async handleUpdateSettings(
    _event: IpcMainInvokeEvent,
    payload: { patch: WebsiteSettingsPatch; actor: string },
  ): Promise<IPCResponse<unknown>> {
    try {
      return ok(await this.service.updateSettings(payload.patch, payload.actor || 'unknown'));
    } catch (e) {
      logError(e as Error, 'WebsiteController.updateSettings');
      return fail(e);
    }
  }

  private async handleReorderItems(
    _event: IpcMainInvokeEvent,
    payload: { categoryUuid: string; orderedUuids: string[]; actor: string },
  ): Promise<IPCResponse<unknown>> {
    try {
      await this.service.reorderItems(payload.categoryUuid, payload.orderedUuids, payload.actor || 'unknown');
      return ok({ ok: true });
    } catch (e) {
      logError(e as Error, 'WebsiteController.reorderItems');
      return fail(e);
    }
  }

  private async handleSetFeatured(
    _event: IpcMainInvokeEvent,
    payload: { itemUuid: string; value: boolean; actor: string; expectedUpdatedAt?: string },
  ): Promise<IPCResponse<unknown>> {
    try {
      const updated = await this.service.setFeatured(
        payload.itemUuid,
        payload.value,
        payload.actor || 'unknown',
        payload.expectedUpdatedAt,
      );
      return ok(updated);
    } catch (e) {
      logError(e as Error, 'WebsiteController.setFeatured');
      const concurrency = e as ConcurrencyError;
      if (concurrency?.code === 'STALE_WRITE') {
        return { success: false, error: 'STALE_WRITE', timestamp: getCurrentLocalDateTime() };
      }
      return fail(e);
    }
  }

  private async handleSetVisibility(
    _event: IpcMainInvokeEvent,
    payload: { itemUuid: string; visible: boolean; actor: string; expectedUpdatedAt?: string },
  ): Promise<IPCResponse<unknown>> {
    try {
      const updated = await this.service.setVisibility(
        payload.itemUuid,
        payload.visible,
        payload.actor || 'unknown',
        payload.expectedUpdatedAt,
      );
      return ok(updated);
    } catch (e) {
      logError(e as Error, 'WebsiteController.setVisibility');
      const concurrency = e as ConcurrencyError;
      if (concurrency?.code === 'STALE_WRITE') {
        return { success: false, error: 'STALE_WRITE', timestamp: getCurrentLocalDateTime() };
      }
      return fail(e);
    }
  }

  private async handleBulkSetVisibility(
    _event: IpcMainInvokeEvent,
    payload: { itemUuids: string[]; visible: boolean; actor: string },
  ): Promise<IPCResponse<unknown>> {
    try {
      const count = await this.service.bulkSetVisibility(
        payload.itemUuids,
        payload.visible,
        payload.actor || 'unknown',
      );
      return ok({ count });
    } catch (e) {
      logError(e as Error, 'WebsiteController.bulkSetVisibility');
      return fail(e);
    }
  }

  private async handleUpdateItemContent(
    _event: IpcMainInvokeEvent,
    payload: { itemUuid: string; patch: { description?: string | null }; actor: string },
  ): Promise<IPCResponse<unknown>> {
    try {
      return ok(
        await this.service.updateItemContent(payload.itemUuid, payload.patch, payload.actor || 'unknown'),
      );
    } catch (e) {
      logError(e as Error, 'WebsiteController.updateItemContent');
      return fail(e);
    }
  }

  private async handleUploadItemImage(
    _event: IpcMainInvokeEvent,
    payload: { itemUuid: string; bytes: ArrayBuffer | Uint8Array; mime: string; actor: string },
  ): Promise<IPCResponse<unknown>> {
    try {
      const buf = Buffer.from(payload.bytes as any);
      const result = await this.service.uploadItemImage(
        payload.itemUuid,
        buf,
        payload.mime,
        payload.actor || 'unknown',
      );
      return ok(result);
    } catch (e) {
      logError(e as Error, 'WebsiteController.uploadItemImage');
      return fail(e);
    }
  }

  private async handleResetWebsite(
    _event: IpcMainInvokeEvent,
    payload: { actor: string },
  ): Promise<IPCResponse<unknown>> {
    try {
      const result = await this.service.resetWebsite(payload?.actor || 'unknown');
      return ok(result);
    } catch (e) {
      logError(e as Error, 'WebsiteController.resetWebsite');
      return fail(e);
    }
  }
}
