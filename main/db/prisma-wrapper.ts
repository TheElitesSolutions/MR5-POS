/**
 * Prisma-Compatible Wrapper for better-sqlite3
 *
 * This wrapper provides a Prisma-like API interface to ensure
 * zero code changes in existing business logic when migrating
 * from Prisma + PostgreSQL to better-sqlite3 + SQLite
 */

import { getDatabase, generateId, transaction as dbTransaction } from './index';
import type { Database } from 'better-sqlite3';

// Types to match Prisma's API
interface WhereClause {
  [key: string]: any;
}

interface SelectClause {
  [key: string]: boolean | {
    select?: SelectClause;
    where?: WhereClause;
    include?: IncludeClause;
    orderBy?: OrderByClause | OrderByClause[];
  };
}

interface IncludeClause {
  [key: string]: boolean | {
    select?: SelectClause;
    where?: WhereClause;
    include?: IncludeClause;
    orderBy?: OrderByClause | OrderByClause[];
    take?: number;
    skip?: number;
  };
}

interface OrderByClause {
  [key: string]: 'asc' | 'desc';
}

interface FindUniqueArgs {
  where: WhereClause;
  select?: SelectClause;
  include?: IncludeClause;
}

interface FindManyArgs {
  where?: WhereClause;
  select?: SelectClause;
  include?: IncludeClause;
  orderBy?: OrderByClause | OrderByClause[];
  take?: number;
  skip?: number;
}

interface CreateArgs {
  data: any;
  select?: SelectClause;
  include?: IncludeClause;
}

interface UpdateArgs {
  where: WhereClause;
  data: any;
  select?: SelectClause;
  include?: IncludeClause;
}

interface DeleteArgs {
  where: WhereClause;
}

interface UpsertArgs {
  where: WhereClause;
  create: any;
  update: any;
  select?: SelectClause;
  include?: IncludeClause;
}

// Helper function to convert Prisma where clause to SQL
function buildWhereClause(where: WhereClause): { sql: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];

  for (const [key, value] of Object.entries(where)) {
    // Handle OR operator
    if (key === 'OR' && Array.isArray(value)) {
      const orConditions: string[] = [];
      const orParams: any[] = [];
      for (const orClause of value) {
        const result = buildWhereClause(orClause);
        if (result.sql) {
          // Remove "WHERE" prefix if present
          const cleanSql = result.sql.replace(/^WHERE\s+/i, '');
          orConditions.push(cleanSql);
          orParams.push(...result.params);
        }
      }
      if (orConditions.length > 0) {
        conditions.push(`(${orConditions.join(' OR ')})`);
        params.push(...orParams);
      }
      continue;
    }

    // Handle AND operator
    if (key === 'AND' && Array.isArray(value)) {
      const andConditions: string[] = [];
      const andParams: any[] = [];
      for (const andClause of value) {
        const result = buildWhereClause(andClause);
        if (result.sql) {
          // Remove "WHERE" prefix if present
          const cleanSql = result.sql.replace(/^WHERE\s+/i, '');
          andConditions.push(cleanSql);
          andParams.push(...result.params);
        }
      }
      if (andConditions.length > 0) {
        conditions.push(`(${andConditions.join(' AND ')})`);
        params.push(...andParams);
      }
      continue;
    }

    // Handle null values
    if (value === null) {
      conditions.push(`${key} IS NULL`);
    } else if (value === undefined) {
      // Skip undefined values
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Handle Prisma operators
      for (const [op, val] of Object.entries(value)) {
        switch (op) {
          case 'equals':
            conditions.push(`${key} = ?`);
            params.push(val);
            break;
          case 'not':
            conditions.push(`${key} != ?`);
            params.push(val);
            break;
          case 'in':
            const placeholders = (val as any[]).map(() => '?').join(',');
            conditions.push(`${key} IN (${placeholders})`);
            params.push(...(val as any[]));
            break;
          case 'notIn':
            const notInPlaceholders = (val as any[]).map(() => '?').join(',');
            conditions.push(`${key} NOT IN (${notInPlaceholders})`);
            params.push(...(val as any[]));
            break;
          case 'lt':
            conditions.push(`${key} < ?`);
            params.push(val);
            break;
          case 'lte':
            conditions.push(`${key} <= ?`);
            params.push(val);
            break;
          case 'gt':
            conditions.push(`${key} > ?`);
            params.push(val);
            break;
          case 'gte':
            conditions.push(`${key} >= ?`);
            params.push(val);
            break;
          case 'contains':
            conditions.push(`${key} LIKE ?`);
            params.push(`%${val}%`);
            break;
          case 'startsWith':
            conditions.push(`${key} LIKE ?`);
            params.push(`${val}%`);
            break;
          case 'endsWith':
            conditions.push(`${key} LIKE ?`);
            params.push(`%${val}`);
            break;
        }
      }
    } else {
      // Handle primitive values (including booleans)
      conditions.push(`${key} = ?`);
      // Convert boolean to integer for SQLite (0 or 1)
      if (typeof value === 'boolean') {
        params.push(value ? 1 : 0);
      } else {
        params.push(value);
      }
    }
  }

  // Validate all parameters are SQLite-compatible types
  for (let i = 0; i < params.length; i++) {
    const param = params[i];
    const paramType = typeof param;
    if (param !== null &&
        paramType !== 'string' &&
        paramType !== 'number' &&
        paramType !== 'bigint' &&
        paramType !== 'boolean' &&
        !Buffer.isBuffer(param)) {
      console.error(`Invalid parameter type at index ${i}:`, param, `(type: ${paramType})`);
      throw new Error(`SQLite can only bind numbers, strings, bigints, buffers, and null. Got ${paramType} at parameter ${i}`);
    }
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

// Helper function to build ORDER BY clause
function buildOrderByClause(orderBy?: OrderByClause | OrderByClause[]): string {
  if (!orderBy) return '';

  const orderArray = Array.isArray(orderBy) ? orderBy : [orderBy];
  const orderClauses = orderArray.map(order => {
    return Object.entries(order)
      .map(([key, direction]) => `${key} ${direction.toUpperCase()}`)
      .join(', ');
  });

  return orderClauses.length > 0 ? `ORDER BY ${orderClauses.join(', ')}` : '';
}

// Helper function to sanitize values for SQLite binding
function sanitizeValueForSQLite(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }

  // Convert Decimal objects to numbers
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber();
  }

  // Convert booleans to 0/1 for SQLite
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  // Convert Date objects to ISO strings
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Return primitive types as-is
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint' || Buffer.isBuffer(value)) {
    return value;
  }

  // For arrays and objects, attempt string conversion as fallback
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  // Warn about unexpected types
  console.warn(`Unexpected value type for SQLite:`, typeof value, value);
  return String(value);
}

// Relationship configuration for the database schema
const RELATIONSHIPS = {
  orders: {
    items: { type: 'one-to-many', foreignTable: 'order_items', foreignKey: 'orderId', localKey: 'id' },
    table: { type: 'many-to-one', foreignTable: 'tables', foreignKey: 'tableId', localKey: 'id' },
    customer: { type: 'many-to-one', foreignTable: 'customers', foreignKey: 'customerId', localKey: 'id' },
    user: { type: 'many-to-one', foreignTable: 'users', foreignKey: 'userId', localKey: 'id' },
    payments: { type: 'one-to-many', foreignTable: 'payments', foreignKey: 'orderId', localKey: 'id' },
  },
  order_items: {
    order: { type: 'many-to-one', foreignTable: 'orders', foreignKey: 'orderId', localKey: 'id' },
    menuItem: { type: 'many-to-one', foreignTable: 'menu_items', foreignKey: 'menuItemId', localKey: 'id' },
    addons: { type: 'one-to-many', foreignTable: 'order_item_addons', foreignKey: 'orderItemId', localKey: 'id' },
  },
  order_item_addons: {
    orderItem: { type: 'many-to-one', foreignTable: 'order_items', foreignKey: 'orderItemId', localKey: 'id' },
    addon: { type: 'many-to-one', foreignTable: 'addons', foreignKey: 'addonId', localKey: 'id' },
  },
  menu_items: {
    category: { type: 'many-to-one', foreignTable: 'categories', foreignKey: 'categoryId', localKey: 'id' },
    inventoryItems: { type: 'one-to-many', foreignTable: 'menu_item_inventory', foreignKey: 'menuItemId', localKey: 'id' },
    orderItems: { type: 'one-to-many', foreignTable: 'order_items', foreignKey: 'menuItemId', localKey: 'id' },
  },
  menu_item_inventory: {
    menuItem: { type: 'many-to-one', foreignTable: 'menu_items', foreignKey: 'menuItemId', localKey: 'id' },
    inventory: { type: 'many-to-one', foreignTable: 'inventory', foreignKey: 'inventoryId', localKey: 'id' },
  },
  categories: {
    menuItems: { type: 'one-to-many', foreignTable: 'menu_items', foreignKey: 'categoryId', localKey: 'id' },
    addonCategoryAssignments: { type: 'one-to-many', foreignTable: 'category_addon_groups', foreignKey: 'categoryId', localKey: 'id' },
  },
  category_addon_groups: {
    category: { type: 'many-to-one', foreignTable: 'categories', foreignKey: 'categoryId', localKey: 'id' },
    addonGroup: { type: 'many-to-one', foreignTable: 'addon_groups', foreignKey: 'addonGroupId', localKey: 'id' },
  },
  addon_groups: {
    addons: { type: 'one-to-many', foreignTable: 'addons', foreignKey: 'addonGroupId', localKey: 'id' },
    categoryAssignments: { type: 'one-to-many', foreignTable: 'category_addon_groups', foreignKey: 'addonGroupId', localKey: 'id' },
  },
  addons: {
    addonGroup: { type: 'many-to-one', foreignTable: 'addon_groups', foreignKey: 'addonGroupId', localKey: 'id' },
    orderItemAddons: { type: 'one-to-many', foreignTable: 'order_item_addons', foreignKey: 'addonId', localKey: 'id' },
  },
  users: {
    orders: { type: 'one-to-many', foreignTable: 'orders', foreignKey: 'userId', localKey: 'id' },
  },
  tables: {
    orders: { type: 'one-to-many', foreignTable: 'orders', foreignKey: 'tableId', localKey: 'id' },
  },
  customers: {
    orders: { type: 'one-to-many', foreignTable: 'orders', foreignKey: 'customerId', localKey: 'id' },
  },
  payments: {
    order: { type: 'many-to-one', foreignTable: 'orders', foreignKey: 'orderId', localKey: 'id' },
  },
  inventory: {
    menuItemInventory: { type: 'one-to-many', foreignTable: 'menu_item_inventory', foreignKey: 'inventoryId', localKey: 'id' },
  },
};

// Base model class
class BaseModel {
  constructor(protected tableName: string, protected db: Database) {}

  /**
   * Process include clauses to fetch related data
   * @param records - The main record(s) to attach relationships to
   * @param include - The include clause from Prisma query
   * @returns The records with included relationships
   */
  private async processIncludes(records: any | any[], include?: IncludeClause): Promise<any | any[]> {
    if (!include || !records) return records;

    const isArray = Array.isArray(records);
    const recordsArray = isArray ? records : [records];

    // Get relationship configuration for this table
    const tableRelations = (RELATIONSHIPS as any)[this.tableName];
    if (!tableRelations) {
      console.debug(`No relationships defined for table: ${this.tableName}`);
      return records;
    }

    // Process each include field
    for (const [fieldName, includeValue] of Object.entries(include)) {
      const relation = tableRelations[fieldName];
      if (!relation) {
        console.debug(`No relationship defined for ${this.tableName}.${fieldName}`);
        continue;
      }

      // Handle different include formats
      let nestedInclude: IncludeClause | undefined;
      let selectClause: SelectClause | undefined;
      let whereClause: WhereClause | undefined;
      let orderByClause: OrderByClause | OrderByClause[] | undefined;
      let take: number | undefined;
      let skip: number | undefined;

      if (typeof includeValue === 'object' && includeValue !== true) {
        nestedInclude = includeValue.include;
        selectClause = includeValue.select;
        whereClause = includeValue.where;
        orderByClause = includeValue.orderBy;
        take = includeValue.take;
        skip = includeValue.skip;
      }

      if (relation.type === 'one-to-many') {
        // Fetch related records for one-to-many relationships
        await this.fetchOneToMany(recordsArray, fieldName, relation, nestedInclude, whereClause, orderByClause, take, skip);
      } else if (relation.type === 'many-to-one') {
        // Fetch related records for many-to-one relationships
        await this.fetchManyToOne(recordsArray, fieldName, relation, nestedInclude, selectClause);
      }
    }

    return isArray ? recordsArray : recordsArray[0];
  }

  /**
   * Fetch one-to-many related records
   */
  private async fetchOneToMany(
    records: any[],
    fieldName: string,
    relation: any,
    nestedInclude?: IncludeClause,
    whereClause?: WhereClause,
    orderBy?: OrderByClause | OrderByClause[],
    take?: number,
    skip?: number
  ): Promise<void> {
    if (records.length === 0) return;

    // Collect all parent IDs
    const parentIds = records.map(r => r[relation.localKey]).filter(id => id != null);
    if (parentIds.length === 0) return;

    // Build the where clause for fetching related records
    const combinedWhere: WhereClause = {
      [relation.foreignKey]: { in: parentIds },
      ...(whereClause || {})
    };

    // Fetch all related records in one query (avoiding N+1 problem)
    const relatedModel = new BaseModel(relation.foreignTable, this.db);
    const allRelated = await relatedModel.findMany({
      where: combinedWhere,
      orderBy,
      take: take ? take * records.length : undefined, // Adjust take for batch query
      skip
    });

    // Process nested includes if present
    const processedRelated = nestedInclude
      ? await relatedModel.processIncludes(allRelated, nestedInclude)
      : allRelated;

    // Group related records by parent ID
    const relatedByParent = new Map<any, any[]>();
    for (const related of processedRelated) {
      const parentId = related[relation.foreignKey];
      if (!relatedByParent.has(parentId)) {
        relatedByParent.set(parentId, []);
      }
      relatedByParent.get(parentId)!.push(related);
    }

    // Attach related records to parent records
    for (const record of records) {
      const parentId = record[relation.localKey];
      record[fieldName] = relatedByParent.get(parentId) || [];
    }
  }

  /**
   * Fetch many-to-one related records
   */
  private async fetchManyToOne(
    records: any[],
    fieldName: string,
    relation: any,
    nestedInclude?: IncludeClause,
    selectClause?: SelectClause
  ): Promise<void> {
    if (records.length === 0) return;

    // Collect all foreign keys
    const foreignIds = [...new Set(records.map(r => r[relation.foreignKey]).filter(id => id != null))];
    if (foreignIds.length === 0) return;

    // Fetch all related records in one query
    const relatedModel = new BaseModel(relation.foreignTable, this.db);
    const allRelated = await relatedModel.findMany({
      where: { [relation.localKey]: { in: foreignIds } }
    });

    // Process nested includes if present
    const processedRelated = nestedInclude
      ? await relatedModel.processIncludes(allRelated, nestedInclude)
      : allRelated;

    // Create a map for quick lookup
    const relatedById = new Map<any, any>();
    for (const related of processedRelated) {
      relatedById.set(related[relation.localKey], related);
    }

    // Attach related records to parent records
    for (const record of records) {
      const foreignId = record[relation.foreignKey];
      if (foreignId != null) {
        let relatedRecord = relatedById.get(foreignId) || null;

        // Apply select clause if present
        if (relatedRecord && selectClause) {
          relatedRecord = this.applySelect(relatedRecord, selectClause);
        }

        record[fieldName] = relatedRecord;
      } else {
        record[fieldName] = null;
      }
    }
  }

  /**
   * Apply select clause to filter fields
   */
  private applySelect(record: any, selectClause: SelectClause): any {
    const selected: any = {};
    for (const [field, value] of Object.entries(selectClause)) {
      if (value === true) {
        selected[field] = record[field];
      } else if (typeof value === 'object' && record[field]) {
        // Handle nested select
        selected[field] = this.applySelect(record[field], value.select || {});
      }
    }
    return selected;
  }

  async findUnique(args: FindUniqueArgs): Promise<any | null> {
    const { where, include } = args;
    const { sql: whereClause, params } = buildWhereClause(where);

    const query = `SELECT * FROM ${this.tableName} ${whereClause} LIMIT 1`;
    const stmt = this.db.prepare(query);
    const result = stmt.get(...params);

    if (!result) return null;

    // Process includes if present
    return include ? await this.processIncludes(result, include) : result;
  }

  async findFirst(args: FindManyArgs): Promise<any | null> {
    const results = await this.findMany({ ...args, take: 1 });
    return results[0] || null;
  }

  async findMany(args: FindManyArgs = {}): Promise<any[]> {
    const { where = {}, orderBy, take, skip, include } = args;
    const { sql: whereClause, params } = buildWhereClause(where);
    const orderByClause = buildOrderByClause(orderBy);

    let query = `SELECT * FROM ${this.tableName} ${whereClause} ${orderByClause}`;

    if (take !== undefined) {
      query += ` LIMIT ${take}`;
    }
    if (skip !== undefined) {
      query += ` OFFSET ${skip}`;
    }

    const stmt = this.db.prepare(query);
    const results = stmt.all(...params);

    // Process includes if present
    return include ? await this.processIncludes(results, include) : results;
  }

  async create(args: CreateArgs): Promise<any> {
    const { data, include } = args;
    const id = data.id || generateId();
    const finalData = { ...data, id };

    const keys = Object.keys(finalData);
    const values = Object.values(finalData).map(sanitizeValueForSQLite);
    const placeholders = keys.map(() => '?').join(', ');

    const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    const stmt = this.db.prepare(query);

    const result = stmt.run(...values);

    // Return the created record with includes if specified
    return this.findUnique({ where: { id }, include });
  }

  async createMany(args: { data: any[] }): Promise<{ count: number }> {
    const { data } = args;
    let count = 0;

    const transaction = this.db.transaction(() => {
      for (const item of data) {
        const id = item.id || generateId();
        const finalData = { ...item, id };

        const keys = Object.keys(finalData);
        const values = Object.values(finalData).map(sanitizeValueForSQLite);
        const placeholders = keys.map(() => '?').join(', ');

        const query = `INSERT INTO ${this.tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
        const stmt = this.db.prepare(query);
        stmt.run(...values);
        count++;
      }
    });

    transaction();
    return { count };
  }

  async update(args: UpdateArgs): Promise<any> {
    const { where, data, include } = args;
    const { sql: whereClause, params: whereParams } = buildWhereClause(where);

    // Build SET clause
    const setClauses: string[] = [];
    const setParams: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        setClauses.push(`${key} = ?`);
        setParams.push(sanitizeValueForSQLite(value));
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `UPDATE ${this.tableName} SET ${setClauses.join(', ')} ${whereClause}`;
    const stmt = this.db.prepare(query);
    stmt.run(...setParams, ...whereParams);

    // Return the updated record with includes if specified
    return this.findUnique({ where, include });
  }

  async updateMany(args: { where?: WhereClause; data: any }): Promise<{ count: number }> {
    const { where = {}, data } = args;
    const { sql: whereClause, params: whereParams } = buildWhereClause(where);

    // Build SET clause
    const setClauses: string[] = [];
    const setParams: any[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key !== 'id') {
        setClauses.push(`${key} = ?`);
        setParams.push(sanitizeValueForSQLite(value));
      }
    }

    if (setClauses.length === 0) {
      return { count: 0 };
    }

    const query = `UPDATE ${this.tableName} SET ${setClauses.join(', ')} ${whereClause}`;
    const stmt = this.db.prepare(query);
    const result = stmt.run(...setParams, ...whereParams);

    return { count: result.changes };
  }

  async delete(args: DeleteArgs): Promise<any> {
    const { where } = args;

    // First get the record to return it
    const record = await this.findUnique({ where });

    const { sql: whereClause, params } = buildWhereClause(where);
    const query = `DELETE FROM ${this.tableName} ${whereClause}`;
    const stmt = this.db.prepare(query);
    stmt.run(...params);

    return record;
  }

  async deleteMany(args: { where?: WhereClause } = {}): Promise<{ count: number }> {
    const { where = {} } = args;
    const { sql: whereClause, params } = buildWhereClause(where);

    const query = `DELETE FROM ${this.tableName} ${whereClause}`;
    const stmt = this.db.prepare(query);
    const result = stmt.run(...params);

    return { count: result.changes };
  }

  async upsert(args: UpsertArgs): Promise<any> {
    const { where, create, update, include } = args;

    // Try to find existing record
    const existing = await this.findUnique({ where });

    if (existing) {
      return this.update({ where, data: update, include });
    } else {
      return this.create({ data: { ...create, ...where }, include });
    }
  }

  async count(args: { where?: WhereClause } = {}): Promise<number> {
    const { where = {} } = args;
    const { sql: whereClause, params } = buildWhereClause(where);

    const query = `SELECT COUNT(*) as count FROM ${this.tableName} ${whereClause}`;
    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };

    return result.count;
  }

  async aggregate(args: {
    where?: WhereClause;
    _count?: boolean | { [key: string]: boolean };
    _sum?: { [key: string]: boolean };
    _avg?: { [key: string]: boolean };
    _min?: { [key: string]: boolean };
    _max?: { [key: string]: boolean };
  }): Promise<any> {
    const { where = {} } = args;
    const { sql: whereClause, params } = buildWhereClause(where);

    const aggregations: string[] = [];
    const result: any = {};

    if (args._count) {
      aggregations.push('COUNT(*) as _count');
    }

    if (args._sum) {
      for (const field of Object.keys(args._sum)) {
        aggregations.push(`SUM(${field}) as sum_${field}`);
      }
    }

    if (args._avg) {
      for (const field of Object.keys(args._avg)) {
        aggregations.push(`AVG(${field}) as avg_${field}`);
      }
    }

    if (args._min) {
      for (const field of Object.keys(args._min)) {
        aggregations.push(`MIN(${field}) as min_${field}`);
      }
    }

    if (args._max) {
      for (const field of Object.keys(args._max)) {
        aggregations.push(`MAX(${field}) as max_${field}`);
      }
    }

    if (aggregations.length === 0) {
      return {};
    }

    const query = `SELECT ${aggregations.join(', ')} FROM ${this.tableName} ${whereClause}`;
    const stmt = this.db.prepare(query);
    const dbResult = stmt.get(...params) as any;

    // Format the result to match Prisma's structure
    if (args._count) result._count = dbResult._count;
    if (args._sum) {
      result._sum = {};
      for (const field of Object.keys(args._sum)) {
        result._sum[field] = dbResult[`sum_${field}`];
      }
    }
    if (args._avg) {
      result._avg = {};
      for (const field of Object.keys(args._avg)) {
        result._avg[field] = dbResult[`avg_${field}`];
      }
    }
    if (args._min) {
      result._min = {};
      for (const field of Object.keys(args._min)) {
        result._min[field] = dbResult[`min_${field}`];
      }
    }
    if (args._max) {
      result._max = {};
      for (const field of Object.keys(args._max)) {
        result._max[field] = dbResult[`max_${field}`];
      }
    }

    return result;
  }
}

// Create Prisma-compatible client
export class PrismaClient {
  private _db: Database | null = null;
  private _initialized: boolean = false;

  // Model instances
  public user!: BaseModel;
  public table!: BaseModel;
  public category!: BaseModel;
  public menuItem!: BaseModel;
  public customer!: BaseModel;
  public order!: BaseModel;
  public orderItem!: BaseModel;
  public payment!: BaseModel;
  public inventory!: BaseModel;
  public menuItemInventory!: BaseModel;
  public expense!: BaseModel;
  public setting!: BaseModel;
  public auditLog!: BaseModel;
  public addonGroup!: BaseModel;
  public addon!: BaseModel;
  public addonInventoryItem!: BaseModel;
  public categoryAddonGroup!: BaseModel;
  public orderItemAddon!: BaseModel;

  private get db(): Database {
    if (!this._initialized) {
      this._db = getDatabase();
      // Initialize all models
      this.user = new BaseModel('users', this._db);
      this.table = new BaseModel('tables', this._db);
      this.category = new BaseModel('categories', this._db);
      this.menuItem = new BaseModel('menu_items', this._db);
      this.customer = new BaseModel('customers', this._db);
      this.order = new BaseModel('orders', this._db);
      this.orderItem = new BaseModel('order_items', this._db);
      this.payment = new BaseModel('payments', this._db);
      this.inventory = new BaseModel('inventory', this._db);
      this.menuItemInventory = new BaseModel('menu_item_inventory', this._db);
      this.expense = new BaseModel('expenses', this._db);
      this.setting = new BaseModel('settings', this._db);
      this.auditLog = new BaseModel('audit_logs', this._db);
      this.addonGroup = new BaseModel('addon_groups', this._db);
      this.addon = new BaseModel('addons', this._db);
      this.addonInventoryItem = new BaseModel('addon_inventory_items', this._db);
      this.categoryAddonGroup = new BaseModel('category_addon_groups', this._db);
      this.orderItemAddon = new BaseModel('order_item_addons', this._db);
      this._initialized = true;
    }
    return this._db!;
  }

  constructor() {
    // Don't initialize database in constructor - wait until first access
  }

  /**
   * Ensures the PrismaClient is fully initialized by triggering the lazy db getter.
   * This must be called before accessing model properties (user, table, etc.)
   * to ensure they are not undefined.
   */
  public ensureInitialized(): void {
    // Access the db getter to trigger initialization
    const _ = this.db;
    // Now all model properties are initialized
  }

  /**
   * Check if the client has been initialized
   */
  public isInitialized(): boolean {
    return this._initialized;
  }

  // Transaction support
  async $transaction<T>(fn: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return dbTransaction(async () => {
      // The function will run within a database transaction
      // Execute the function and await its result
      const result = await fn(this);
      return result;
    });
  }

  // Connect (no-op for SQLite, but we can use it to ensure initialization)
  async $connect(): Promise<void> {
    // Ensure the client is initialized
    this.ensureInitialized();
    console.log('Prisma-compatible wrapper connected to SQLite');
  }

  // Disconnect
  async $disconnect(): Promise<void> {
    // We don't close the database here as it's managed by the main process
    console.log('Prisma-compatible wrapper disconnect called');
  }

  // Raw query execution
  // Support both tagged template literals (like real Prisma) and string queries
  async $queryRaw<T = any>(
    queryOrStrings: string | TemplateStringsArray,
    ...params: any[]
  ): Promise<T[]> {
    let query: string;
    let queryParams: any[];

    // Check if this is a tagged template literal call
    if (Array.isArray(queryOrStrings) && 'raw' in queryOrStrings) {
      // Tagged template literal: $queryRaw`SELECT * FROM users WHERE id = ${id}`
      // queryOrStrings is the array of string parts, params are the interpolated values
      const strings = queryOrStrings as TemplateStringsArray;

      // Build the query by interleaving strings and placeholders
      query = strings.reduce((acc, str, i) => {
        return acc + str + (i < params.length ? '?' : '');
      }, '');

      queryParams = params;
    } else {
      // Regular string query: $queryRaw('SELECT * FROM users WHERE id = ?', id)
      query = queryOrStrings as string;
      queryParams = params;
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...queryParams) as T[];
  }

  async $executeRaw(query: string, ...params: any[]): Promise<number> {
    const stmt = this.db.prepare(query);
    const result = stmt.run(...params);
    return result.changes;
  }

  // Raw query with unsafe string (no tagged template)
  async $queryRawUnsafe<T = any>(query: string, ...params: any[]): Promise<T[]> {
    const stmt = this.db.prepare(query);
    return stmt.all(...params) as T[];
  }

  async $executeRawUnsafe(query: string, ...params: any[]): Promise<number> {
    const stmt = this.db.prepare(query);
    const result = stmt.run(...params);
    return result.changes;
  }
}

// Create singleton instance
let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient();
  }
  return prismaClient;
}

// Create a Proxy that lazily initializes prisma on first property access
// This prevents initialization at module load time (before app.whenReady())
const prismaProxy = new Proxy({} as PrismaClient, {
  get(target, prop) {
    const client = getPrismaClient();
    return (client as any)[prop];
  }
});

// Export as default for compatibility AND named export
export { prismaProxy as prisma };
export default prismaProxy;