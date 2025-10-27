import { IpcMainInvokeEvent } from 'electron';
import { TABLE_CHANNELS } from '../../shared/ipc-channels';
import {
  CreateTableSchema,
  UpdateTableStatusSchema,
} from '../../shared/validation-schemas';
import { validateWithSchema } from '../utils/validation-helpers';
import { logInfo } from '../error-handler';
import { TableModel } from '../models/Table';
import {
  CreateTableRequest,
  IPCResponse,
  Table,
  TableStatus,
  UpdateTableRequest,
} from '../types/index';
import { BaseController } from './baseController';
import { prisma } from '../db/prisma-wrapper';

/**
 * Controller for table-related operations
 */
export class TableController extends BaseController {
  private tableModel: TableModel;

  constructor() {
    super();
    this.tableModel = new TableModel(prisma as any);
    // this.initialize(); // Removed: StartupManager calls initialize() explicitly
    logInfo('TableController initialized');
  }

  protected override registerHandlers(): void {
    // Register table-related handlers
    this.registerHandler(TABLE_CHANNELS.GET_ALL, this.getAllTables.bind(this));
    this.registerHandler(
      TABLE_CHANNELS.GET_BY_ID,
      this.getTableById.bind(this)
    );
    this.registerHandler(TABLE_CHANNELS.CREATE, this.createTable.bind(this));
    this.registerHandler(TABLE_CHANNELS.UPDATE, this.updateTable.bind(this));
    this.registerHandler(TABLE_CHANNELS.DELETE, this.deleteTable.bind(this));
    this.registerHandler(
      TABLE_CHANNELS.UPDATE_STATUS,
      this.updateTableStatus.bind(this)
    );
    this.registerHandler(
      TABLE_CHANNELS.TOGGLE_PAY_LATER,
      this.togglePayLater.bind(this)
    );

    logInfo('Table IPC handlers registered');
  }

  public override initialize(): void {
    this.registerHandlers();
  }

  public override unregisterHandlers(): void {
    const handlers = [
      TABLE_CHANNELS.GET_ALL,
      TABLE_CHANNELS.GET_BY_ID,
      TABLE_CHANNELS.CREATE,
      TABLE_CHANNELS.UPDATE,
      TABLE_CHANNELS.DELETE,
      TABLE_CHANNELS.UPDATE_STATUS,
      TABLE_CHANNELS.TOGGLE_PAY_LATER,
    ];

    handlers.forEach(handler => {
      this.unregisterHandler(handler);
    });

    logInfo('Table IPC handlers unregistered');
  }

  /**
   * Get all tables
   */
  private async getAllTables(
    _event: IpcMainInvokeEvent
  ): Promise<IPCResponse<Table[]>> {
    try {
      const result = await this.tableModel.getAllTables();
      if (result.success && result.data) {
        logInfo(`Retrieved ${result.data.length} tables`);
        return this.createSuccessResponse(result.data);
      }
      return this.createErrorResponse(
        new Error(result.error || 'Failed to retrieve tables')
      );
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Get table by ID
   */
  private async getTableById(
    _event: IpcMainInvokeEvent,
    id: string
  ): Promise<IPCResponse<Table | null>> {
    try {
      const result = await this.tableModel.getTableById(id);
      if (result.success) {
        return this.createSuccessResponse(result.data || null);
      }
      return this.createErrorResponse(
        new Error(result.error || 'Failed to retrieve table')
      );
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Create a new table
   */
  private async createTable(
    _event: IpcMainInvokeEvent,
    data: unknown
  ): Promise<IPCResponse<Table>> {
    try {
      // Runtime validation with Zod
      const validation = validateWithSchema(
        CreateTableSchema,
        data,
        'CreateTable'
      );

      if (!validation.success) {
        logInfo(`CreateTable: Validation failed - ${validation.error}`);
        return this.createErrorResponse(new Error(validation.error));
      }

      const validatedData = validation.data!;
      const result = await this.tableModel.createTable(validatedData as CreateTableRequest);
      if (result.success && result.data) {
        return this.createSuccessResponse(result.data);
      }
      return this.createErrorResponse(
        new Error(result.error || 'Failed to create table')
      );
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Update an existing table
   */
  private async updateTable(
    _event: IpcMainInvokeEvent,
    { id, updates }: UpdateTableRequest
  ): Promise<IPCResponse<Table>> {
    try {
      const result = await this.tableModel.updateTable(id, updates);
      if (result.success && result.data) {
        return this.createSuccessResponse(result.data);
      }
      return this.createErrorResponse(
        new Error(result.error || 'Failed to update table')
      );
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Update table status
   */
  private async updateTableStatus(
    _event: IpcMainInvokeEvent,
    data: unknown
  ): Promise<IPCResponse<Table>> {
    try {
      // Runtime validation with Zod
      const validation = validateWithSchema(
        UpdateTableStatusSchema,
        data,
        'UpdateTableStatus'
      );

      if (!validation.success) {
        logInfo(`UpdateTableStatus: Validation failed - ${validation.error}`);
        return this.createErrorResponse(new Error(validation.error));
      }

      const validatedData = validation.data!;
      const result = await this.tableModel.updateTableStatus(
        validatedData.id,
        validatedData.status as TableStatus
      );

      if (result.success && result.data) {
        return this.createSuccessResponse(result.data);
      }
      return this.createErrorResponse(
        new Error(result.error || 'Failed to update table status')
      );
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Delete a table
   */
  private async deleteTable(
    _event: IpcMainInvokeEvent,
    id: string
  ): Promise<IPCResponse<boolean>> {
    try {
      const result = await this.tableModel.deleteTable(id);
      if (result.success) {
        return this.createSuccessResponse(true);
      }
      return this.createErrorResponse(
        new Error(result.error || 'Failed to delete table')
      );
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }

  /**
   * Toggle the pay later status of a table
   */
  private async togglePayLater(
    _event: IpcMainInvokeEvent,
    id: string
  ): Promise<IPCResponse<Table>> {
    try {
      const result = await this.tableModel.togglePayLater(id);
      if (result.success && result.data) {
        logInfo(`Toggled pay later status for table ${id}`);
        return this.createSuccessResponse(result.data);
      }
      return this.createErrorResponse(
        new Error(result.error || 'Failed to toggle pay later status')
      );
    } catch (error) {
      return this.createErrorResponse(
        error instanceof Error ? error : String(error)
      );
    }
  }
}
