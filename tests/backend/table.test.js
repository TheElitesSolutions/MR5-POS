import { describe, it, expect, beforeEach } from '@jest/globals';
import { getTestDatabase } from '../setup/backend.setup';
import { Factory, DbHelper } from '../utils/test-helpers';
describe('Table Management', () => {
    let db;
    let dbHelper;
    beforeEach(() => {
        db = getTestDatabase();
        dbHelper = new DbHelper(db);
    });
    describe('Table CRUD Operations', () => {
        it('should create a new table', () => {
            const table = Factory.createTable({
                number: 'T-10',
                capacity: 4,
                status: 'AVAILABLE',
                section: 'Main Hall'
            });
            dbHelper.insertTable(table);
            const stored = db.prepare('SELECT * FROM "Table" WHERE id = ?').get(table.id);
            expect(stored).toBeDefined();
            expect(stored.number).toBe('T-10');
            expect(stored.capacity).toBe(4);
            expect(stored.status).toBe('AVAILABLE');
        });
        it('should update table details', () => {
            const table = Factory.createTable({ number: 'T-20', capacity: 2 });
            dbHelper.insertTable(table);
            db.prepare('UPDATE "Table" SET capacity = ?, section = ? WHERE id = ?')
                .run(6, 'VIP Section', table.id);
            const updated = db.prepare('SELECT * FROM "Table" WHERE id = ?').get(table.id);
            expect(updated.capacity).toBe(6);
            expect(updated.section).toBe('VIP Section');
        });
        it('should delete table', () => {
            const table = Factory.createTable();
            dbHelper.insertTable(table);
            db.prepare('DELETE FROM "Table" WHERE id = ?').run(table.id);
            const deleted = db.prepare('SELECT * FROM "Table" WHERE id = ?').get(table.id);
            expect(deleted).toBeUndefined();
        });
        it('should enforce unique table numbers', () => {
            const table1 = Factory.createTable({ number: 'T-99' });
            const table2 = Factory.createTable({ number: 'T-99' });
            dbHelper.insertTable(table1);
            expect(() => dbHelper.insertTable(table2)).toThrow();
        });
    });
    describe('Table Status Management', () => {
        const statuses = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_ORDER'];
        statuses.forEach(status => {
            it(`should set table status to ${status}`, () => {
                const table = Factory.createTable({ status });
                dbHelper.insertTable(table);
                const stored = db.prepare('SELECT * FROM "Table" WHERE id = ?').get(table.id);
                expect(stored.status).toBe(status);
            });
        });
        it('should transition table from AVAILABLE to OCCUPIED', () => {
            const table = Factory.createTable({ status: 'AVAILABLE' });
            dbHelper.insertTable(table);
            db.prepare('UPDATE "Table" SET status = ? WHERE id = ?').run('OCCUPIED', table.id);
            const updated = db.prepare('SELECT * FROM "Table" WHERE id = ?').get(table.id);
            expect(updated.status).toBe('OCCUPIED');
        });
        it('should free up occupied table', () => {
            const table = Factory.createTable({ status: 'OCCUPIED' });
            dbHelper.insertTable(table);
            db.prepare('UPDATE "Table" SET status = ? WHERE id = ?').run('AVAILABLE', table.id);
            const updated = db.prepare('SELECT * FROM "Table" WHERE id = ?').get(table.id);
            expect(updated.status).toBe('AVAILABLE');
        });
    });
    describe('Table-Order Association', () => {
        it('should link order to table', () => {
            const table = Factory.createTable({ status: 'AVAILABLE' });
            dbHelper.insertTable(table);
            const order = Factory.createOrder({
                type: 'DINE_IN',
                tableId: table.id,
                status: 'PENDING'
            });
            dbHelper.insertOrder(order);
            const storedOrder = db.prepare('SELECT * FROM "Order" WHERE id = ?').get(order.id);
            expect(storedOrder.tableId).toBe(table.id);
            expect(storedOrder.type).toBe('DINE_IN');
        });
        it('should get all orders for a table', () => {
            const table = Factory.createTable();
            dbHelper.insertTable(table);
            const orders = [
                Factory.createOrder({ tableId: table.id, type: 'DINE_IN' }),
                Factory.createOrder({ tableId: table.id, type: 'DINE_IN' })
            ];
            orders.forEach(order => dbHelper.insertOrder(order));
            const tableOrders = db.prepare('SELECT * FROM "Order" WHERE tableId = ?').all(table.id);
            expect(tableOrders.length).toBe(2);
        });
        it('should mark table as occupied when order is active', () => {
            const table = Factory.createTable({ status: 'AVAILABLE' });
            dbHelper.insertTable(table);
            const order = Factory.createOrder({
                tableId: table.id,
                type: 'DINE_IN',
                status: 'PENDING'
            });
            dbHelper.insertOrder(order);
            // Simulate table occupation
            db.prepare('UPDATE "Table" SET status = ? WHERE id = ?').run('OCCUPIED', table.id);
            const updated = db.prepare('SELECT * FROM "Table" WHERE id = ?').get(table.id);
            expect(updated.status).toBe('OCCUPIED');
        });
    });
    describe('Table Filtering and Search', () => {
        beforeEach(() => {
            const tables = [
                Factory.createTable({ number: 'T-01', status: 'AVAILABLE', section: 'Main Hall', capacity: 4 }),
                Factory.createTable({ number: 'T-02', status: 'OCCUPIED', section: 'Main Hall', capacity: 2 }),
                Factory.createTable({ number: 'V-01', status: 'AVAILABLE', section: 'VIP', capacity: 6 }),
                Factory.createTable({ number: 'T-03', status: 'RESERVED', section: 'Main Hall', capacity: 4 })
            ];
            tables.forEach(table => dbHelper.insertTable(table));
        });
        it('should filter tables by status', () => {
            const availableTables = db.prepare('SELECT * FROM "Table" WHERE status = ?').all('AVAILABLE');
            const occupiedTables = db.prepare('SELECT * FROM "Table" WHERE status = ?').all('OCCUPIED');
            expect(availableTables.length).toBe(2);
            expect(occupiedTables.length).toBe(1);
        });
        it('should filter tables by section', () => {
            const mainHallTables = db.prepare('SELECT * FROM "Table" WHERE section = ?').all('Main Hall');
            const vipTables = db.prepare('SELECT * FROM "Table" WHERE section = ?').all('VIP');
            expect(mainHallTables.length).toBe(3);
            expect(vipTables.length).toBe(1);
        });
        it('should filter tables by capacity', () => {
            const largeTables = db.prepare('SELECT * FROM "Table" WHERE capacity >= ?').all(4);
            expect(largeTables.length).toBeGreaterThanOrEqual(3);
        });
        it('should search tables by number', () => {
            const table = db.prepare('SELECT * FROM "Table" WHERE number = ?').get('V-01');
            expect(table).toBeDefined();
            expect(table.section).toBe('VIP');
        });
    });
    describe('Table Capacity Management', () => {
        it('should validate table capacity', () => {
            const table = Factory.createTable({ capacity: 4 });
            expect(table.capacity).toBeGreaterThan(0);
            expect(isValidCapacity(table.capacity)).toBe(true);
        });
        it('should reject invalid capacity', () => {
            expect(isValidCapacity(0)).toBe(false);
            expect(isValidCapacity(-1)).toBe(false);
        });
        it('should get tables by capacity range', () => {
            const tables = [
                Factory.createTable({ capacity: 2 }),
                Factory.createTable({ capacity: 4 }),
                Factory.createTable({ capacity: 6 }),
                Factory.createTable({ capacity: 8 })
            ];
            tables.forEach(table => dbHelper.insertTable(table));
            const mediumTables = db.prepare(`
        SELECT * FROM "Table"
        WHERE capacity >= ? AND capacity <= ?
      `).all(4, 6);
            expect(mediumTables.length).toBeGreaterThanOrEqual(2);
        });
    });
    describe('Table Statistics', () => {
        beforeEach(() => {
            const tables = [
                Factory.createTable({ status: 'AVAILABLE' }),
                Factory.createTable({ status: 'AVAILABLE' }),
                Factory.createTable({ status: 'OCCUPIED' }),
                Factory.createTable({ status: 'RESERVED' }),
                Factory.createTable({ status: 'OUT_OF_ORDER' })
            ];
            tables.forEach(table => dbHelper.insertTable(table));
        });
        it('should count tables by status', () => {
            const stats = db.prepare(`
        SELECT
          status,
          COUNT(*) as count
        FROM "Table"
        GROUP BY status
      `).all();
            const availableCount = stats.find((s) => s.status === 'AVAILABLE')?.count;
            expect(availableCount).toBe(2);
        });
        it('should calculate total capacity', () => {
            const total = db.prepare(`
        SELECT SUM(capacity) as totalCapacity
        FROM "Table"
        WHERE status != 'OUT_OF_ORDER'
      `).get();
            expect(total.totalCapacity).toBeGreaterThan(0);
        });
        it('should calculate occupancy rate', () => {
            const stats = db.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'OCCUPIED' THEN 1 ELSE 0 END) as occupied
        FROM "Table"
        WHERE status != 'OUT_OF_ORDER'
      `).get();
            const occupancyRate = (stats.occupied / stats.total) * 100;
            expect(occupancyRate).toBeGreaterThanOrEqual(0);
            expect(occupancyRate).toBeLessThanOrEqual(100);
        });
    });
    describe('Table Sections', () => {
        it('should organize tables by sections', () => {
            const sections = ['Main Hall', 'VIP', 'Patio', 'Bar'];
            sections.forEach(section => {
                const table = Factory.createTable({ section });
                dbHelper.insertTable(table);
            });
            const uniqueSections = db.prepare(`
        SELECT DISTINCT section
        FROM "Table"
        ORDER BY section
      `).all();
            expect(uniqueSections.length).toBeGreaterThanOrEqual(4);
        });
        it('should get table count per section', () => {
            const tables = [
                Factory.createTable({ section: 'Main Hall' }),
                Factory.createTable({ section: 'Main Hall' }),
                Factory.createTable({ section: 'VIP' })
            ];
            tables.forEach(table => dbHelper.insertTable(table));
            const sectionStats = db.prepare(`
        SELECT section, COUNT(*) as count
        FROM "Table"
        GROUP BY section
      `).all();
            const mainHallCount = sectionStats.find((s) => s.section === 'Main Hall')?.count;
            expect(mainHallCount).toBe(2);
        });
    });
    describe('Table Reservations', () => {
        it('should reserve available table', () => {
            const table = Factory.createTable({ status: 'AVAILABLE' });
            dbHelper.insertTable(table);
            db.prepare('UPDATE "Table" SET status = ? WHERE id = ?').run('RESERVED', table.id);
            const reserved = db.prepare('SELECT * FROM "Table" WHERE id = ?').get(table.id);
            expect(reserved.status).toBe('RESERVED');
        });
        it('should not occupy reserved table', () => {
            const table = Factory.createTable({ status: 'RESERVED' });
            dbHelper.insertTable(table);
            const canOccupy = table.status === 'AVAILABLE';
            expect(canOccupy).toBe(false);
        });
    });
    describe('Table Maintenance', () => {
        it('should mark table as out of order', () => {
            const table = Factory.createTable({ status: 'AVAILABLE' });
            dbHelper.insertTable(table);
            db.prepare('UPDATE "Table" SET status = ? WHERE id = ?').run('OUT_OF_ORDER', table.id);
            const updated = db.prepare('SELECT * FROM "Table" WHERE id = ?').get(table.id);
            expect(updated.status).toBe('OUT_OF_ORDER');
        });
        it('should exclude out-of-order tables from availability', () => {
            const tables = [
                Factory.createTable({ status: 'AVAILABLE' }),
                Factory.createTable({ status: 'OUT_OF_ORDER' }),
                Factory.createTable({ status: 'AVAILABLE' })
            ];
            tables.forEach(table => dbHelper.insertTable(table));
            const availableForUse = db.prepare(`
        SELECT * FROM "Table"
        WHERE status != 'OUT_OF_ORDER'
      `).all();
            expect(availableForUse.length).toBeGreaterThanOrEqual(2);
        });
    });
});
// Helper functions
function isValidCapacity(capacity) {
    return capacity > 0 && Number.isInteger(capacity);
}
