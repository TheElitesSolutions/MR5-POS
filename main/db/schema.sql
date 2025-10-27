-- MR5 POS SQLite Database Schema
-- Converted from PostgreSQL + Prisma
-- Date: 2025-01-16

-- Note: PRAGMA statements are executed in index.ts, not in this schema file

-- =============================================
-- USERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'ADMIN')),
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  phone TEXT,
  isActive INTEGER DEFAULT 1,
  lastLogin TEXT,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- =============================================
-- TABLES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS tables (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'AVAILABLE' CHECK(status IN ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_ORDER')),
  location TEXT,
  notes TEXT,
  currentOrderId TEXT,
  lastStatusChange TEXT,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_tables_status ON tables(status);
CREATE INDEX idx_tables_currentOrderId ON tables(currentOrderId);

-- =============================================
-- CATEGORIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  sortOrder INTEGER DEFAULT 0,
  isActive INTEGER DEFAULT 1,
  parentId TEXT,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (parentId) REFERENCES categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_categories_parentId ON categories(parentId);
CREATE INDEX idx_categories_isActive ON categories(isActive);

-- =============================================
-- MENU ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS menu_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  categoryId TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  isCustomizable INTEGER DEFAULT 0,
  isPrintableInKitchen INTEGER DEFAULT 1,
  imageUrl TEXT,
  preparationTime INTEGER,
  ingredients TEXT DEFAULT '[]', -- JSON array
  allergens TEXT DEFAULT '[]', -- JSON array
  nutritionalInfo TEXT, -- JSON object
  sortOrder INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX idx_menu_items_categoryId ON menu_items(categoryId);
CREATE INDEX idx_menu_items_isActive ON menu_items(isActive);
-- Composite indexes for common query patterns
CREATE INDEX idx_menu_items_categoryId_isActive_sortOrder ON menu_items(categoryId, isActive, sortOrder, name);
CREATE INDEX idx_menu_items_isActive_sortOrder ON menu_items(isActive, sortOrder) WHERE isActive = 1;

-- =============================================
-- CUSTOMERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  firstName TEXT NOT NULL,
  lastName TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  address TEXT,
  birthday TEXT,
  notes TEXT,
  totalSpent REAL DEFAULT 0,
  visitCount INTEGER DEFAULT 0,
  lastVisit TEXT,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);

-- =============================================
-- ORDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  orderNumber TEXT UNIQUE NOT NULL,
  tableId TEXT,
  tableName TEXT,
  customerId TEXT,
  userId TEXT NOT NULL,
  status TEXT DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED')),
  type TEXT DEFAULT 'DINE_IN' CHECK(type IN ('DINE_IN', 'TAKEOUT', 'DELIVERY')),
  subtotal REAL NOT NULL,
  tax REAL NOT NULL,
  discount REAL DEFAULT 0,
  deliveryFee REAL DEFAULT 0,
  total REAL NOT NULL,
  notes TEXT,
  customerName TEXT,
  customerPhone TEXT,
  deliveryAddress TEXT,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime')),
  completedAt TEXT,
  FOREIGN KEY (tableId) REFERENCES tables(id) ON DELETE SET NULL,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX idx_orders_orderNumber ON orders(orderNumber);
CREATE INDEX idx_orders_tableId ON orders(tableId);
CREATE INDEX idx_orders_tableName ON orders(tableName);
CREATE INDEX idx_orders_customerId ON orders(customerId);
CREATE INDEX idx_orders_userId ON orders(userId);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_type ON orders(type);
-- Composite indexes for common query patterns
CREATE INDEX idx_orders_createdAt_status ON orders(createdAt DESC, status);
CREATE INDEX idx_orders_completedAt ON orders(completedAt) WHERE completedAt IS NOT NULL;
CREATE INDEX idx_orders_type_createdAt ON orders(type, createdAt DESC);
CREATE INDEX idx_orders_status_createdAt ON orders(status, createdAt DESC);

-- =============================================
-- ORDER ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  orderId TEXT NOT NULL,
  menuItemId TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unitPrice REAL NOT NULL,
  totalPrice REAL NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'PREPARING', 'READY', 'SERVED', 'CANCELLED')),
  printed INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menuItemId) REFERENCES menu_items(id) ON DELETE RESTRICT
);

CREATE INDEX idx_order_items_orderId ON order_items(orderId);
CREATE INDEX idx_order_items_menuItemId ON order_items(menuItemId);
CREATE INDEX idx_order_items_status ON order_items(status);
-- Composite indexes for common query patterns
CREATE INDEX idx_order_items_orderId_status ON order_items(orderId, status);
CREATE INDEX idx_order_items_menuItemId_orderId ON order_items(menuItemId, orderId);

-- =============================================
-- PAYMENTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  orderId TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('CASH', 'CARD', 'DIGITAL_WALLET', 'CHECK', 'OTHER')),
  status TEXT DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
  reference TEXT,
  processedAt TEXT,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_payments_orderId ON payments(orderId);
CREATE INDEX idx_payments_status ON payments(status);

-- =============================================
-- INVENTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  itemName TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL,
  currentStock REAL NOT NULL,
  minimumStock REAL NOT NULL,
  unit TEXT NOT NULL,
  costPerUnit REAL NOT NULL,
  supplier TEXT,
  lastRestocked TEXT,
  expiryDate TEXT,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_itemName ON inventory(itemName);

-- =============================================
-- MENU ITEM INVENTORY TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS menu_item_inventory (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  menuItemId TEXT NOT NULL,
  inventoryId TEXT NOT NULL,
  quantity REAL NOT NULL,
  FOREIGN KEY (menuItemId) REFERENCES menu_items(id) ON DELETE CASCADE,
  FOREIGN KEY (inventoryId) REFERENCES inventory(id) ON DELETE CASCADE,
  UNIQUE (menuItemId, inventoryId)
);

CREATE INDEX idx_menu_item_inventory_menuItemId ON menu_item_inventory(menuItemId);
CREATE INDEX idx_menu_item_inventory_inventoryId ON menu_item_inventory(inventoryId);

-- =============================================
-- EXPENSES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  date TEXT NOT NULL,
  receipt TEXT,
  notes TEXT,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_date ON expenses(date);

-- =============================================
-- SETTINGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  type TEXT DEFAULT 'string',
  category TEXT DEFAULT 'general',
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_settings_key ON settings(key);
CREATE INDEX idx_settings_category ON settings(category);

-- =============================================
-- AUDIT LOGS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  userId TEXT,
  action TEXT NOT NULL,
  tableName TEXT NOT NULL,
  recordId TEXT,
  oldValues TEXT, -- JSON object
  newValues TEXT, -- JSON object
  ipAddress TEXT,
  userAgent TEXT,
  createdAt TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_audit_logs_userId ON audit_logs(userId);
CREATE INDEX idx_audit_logs_tableName ON audit_logs(tableName);
CREATE INDEX idx_audit_logs_createdAt ON audit_logs(createdAt);

-- =============================================
-- ADDON GROUPS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS addon_groups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  description TEXT,
  minSelections INTEGER DEFAULT 0,
  maxSelections INTEGER,
  isActive INTEGER DEFAULT 1,
  sortOrder INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX idx_addon_groups_isActive ON addon_groups(isActive);

-- =============================================
-- ADDONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS addons (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  addonGroupId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  imageUrl TEXT,
  isActive INTEGER DEFAULT 1,
  isPrintableInKitchen INTEGER DEFAULT 1,
  sortOrder INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (addonGroupId) REFERENCES addon_groups(id) ON DELETE CASCADE
);

CREATE INDEX idx_addons_addonGroupId ON addons(addonGroupId, isActive);

-- =============================================
-- ADDON INVENTORY ITEMS TABLE (Many-to-Many)
-- =============================================
CREATE TABLE IF NOT EXISTS addon_inventory_items (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  addonId TEXT NOT NULL,
  inventoryId TEXT NOT NULL,
  quantity REAL DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (addonId) REFERENCES addons(id) ON DELETE CASCADE,
  FOREIGN KEY (inventoryId) REFERENCES inventory(id) ON DELETE CASCADE,
  UNIQUE (addonId, inventoryId)
);

CREATE INDEX idx_addon_inventory_items_addonId ON addon_inventory_items(addonId);
CREATE INDEX idx_addon_inventory_items_inventoryId ON addon_inventory_items(inventoryId);

-- =============================================
-- CATEGORY ADDON GROUPS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS category_addon_groups (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  categoryId TEXT NOT NULL,
  addonGroupId TEXT NOT NULL,
  isActive INTEGER DEFAULT 1,
  sortOrder INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE,
  FOREIGN KEY (addonGroupId) REFERENCES addon_groups(id) ON DELETE CASCADE,
  UNIQUE (categoryId, addonGroupId)
);

CREATE INDEX idx_category_addon_groups_categoryId ON category_addon_groups(categoryId);

-- =============================================
-- ORDER ITEM ADDONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS order_item_addons (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  orderItemId TEXT NOT NULL,
  addonId TEXT NOT NULL,
  addonName TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unitPrice REAL NOT NULL,
  totalPrice REAL NOT NULL,
  createdAt TEXT DEFAULT (datetime('now', 'localtime')),
  updatedAt TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (orderItemId) REFERENCES order_items(id) ON DELETE CASCADE,
  FOREIGN KEY (addonId) REFERENCES addons(id) ON DELETE RESTRICT
);

CREATE INDEX idx_order_item_addons_orderItemId ON order_item_addons(orderItemId);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
CREATE TRIGGER update_users_timestamp
  AFTER UPDATE ON users
  FOR EACH ROW
  BEGIN
    UPDATE users SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_tables_timestamp
  AFTER UPDATE ON tables
  FOR EACH ROW
  BEGIN
    UPDATE tables SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_categories_timestamp
  AFTER UPDATE ON categories
  FOR EACH ROW
  BEGIN
    UPDATE categories SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_menu_items_timestamp
  AFTER UPDATE ON menu_items
  FOR EACH ROW
  BEGIN
    UPDATE menu_items SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_customers_timestamp
  AFTER UPDATE ON customers
  FOR EACH ROW
  BEGIN
    UPDATE customers SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_orders_timestamp
  AFTER UPDATE ON orders
  FOR EACH ROW
  BEGIN
    UPDATE orders SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_order_items_timestamp
  AFTER UPDATE ON order_items
  FOR EACH ROW
  BEGIN
    UPDATE order_items SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_payments_timestamp
  AFTER UPDATE ON payments
  FOR EACH ROW
  BEGIN
    UPDATE payments SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_inventory_timestamp
  AFTER UPDATE ON inventory
  FOR EACH ROW
  BEGIN
    UPDATE inventory SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_expenses_timestamp
  AFTER UPDATE ON expenses
  FOR EACH ROW
  BEGIN
    UPDATE expenses SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_settings_timestamp
  AFTER UPDATE ON settings
  FOR EACH ROW
  BEGIN
    UPDATE settings SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_addon_groups_timestamp
  AFTER UPDATE ON addon_groups
  FOR EACH ROW
  BEGIN
    UPDATE addon_groups SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_addons_timestamp
  AFTER UPDATE ON addons
  FOR EACH ROW
  BEGIN
    UPDATE addons SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_addon_inventory_items_timestamp
  AFTER UPDATE ON addon_inventory_items
  FOR EACH ROW
  BEGIN
    UPDATE addon_inventory_items SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_category_addon_groups_timestamp
  AFTER UPDATE ON category_addon_groups
  FOR EACH ROW
  BEGIN
    UPDATE category_addon_groups SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;

CREATE TRIGGER update_order_item_addons_timestamp
  AFTER UPDATE ON order_item_addons
  FOR EACH ROW
  BEGIN
    UPDATE order_item_addons SET updatedAt = datetime('now', 'localtime') WHERE id = NEW.id;
  END;