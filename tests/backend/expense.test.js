import { describe, it, expect, beforeEach } from '@jest/globals';
import { getTestDatabase } from '../setup/backend.setup';
import { Factory, DbHelper } from '../utils/test-helpers';
import Decimal from 'decimal.js';
describe('Expense Management', () => {
    let db;
    let dbHelper;
    let testData;
    beforeEach(() => {
        db = getTestDatabase();
        dbHelper = new DbHelper(db);
        testData = dbHelper.seedTestData();
    });
    describe('Expense CRUD Operations', () => {
        it('should create a new expense', () => {
            const expense = Factory.createExpense({
                description: 'Office Supplies',
                amount: 150.00,
                category: 'Supplies',
                vendor: 'Office Depot',
                status: 'PENDING'
            });
            db.prepare(`
        INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, recurringPeriod, date, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.recurringPeriod, expense.date?.toISOString() || new Date().toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
            const stored = db.prepare('SELECT * FROM Expense WHERE id = ?').get(expense.id);
            expect(stored).toBeDefined();
            expect(stored.description).toBe('Office Supplies');
            expect(stored.amount).toBe(150.00);
            expect(stored.category).toBe('Supplies');
        });
        it('should update expense details', () => {
            const expense = Factory.createExpense();
            db.prepare(`
        INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, date, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.date?.toISOString() || new Date().toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
            db.prepare('UPDATE Expense SET amount = ?, status = ? WHERE id = ?')
                .run(200.00, 'APPROVED', expense.id);
            const updated = db.prepare('SELECT * FROM Expense WHERE id = ?').get(expense.id);
            expect(updated.amount).toBe(200.00);
            expect(updated.status).toBe('APPROVED');
        });
        it('should delete expense', () => {
            const expense = Factory.createExpense();
            db.prepare(`
        INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, date, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.date?.toISOString() || new Date().toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
            db.prepare('DELETE FROM Expense WHERE id = ?').run(expense.id);
            const deleted = db.prepare('SELECT * FROM Expense WHERE id = ?').get(expense.id);
            expect(deleted).toBeUndefined();
        });
    });
    describe('Expense Status Management', () => {
        const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'PAID'];
        statuses.forEach(status => {
            it(`should handle ${status} status`, () => {
                const expense = Factory.createExpense({ status });
                db.prepare(`
          INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, date, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.date?.toISOString() || new Date().toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
                const stored = db.prepare('SELECT * FROM Expense WHERE id = ?').get(expense.id);
                expect(stored.status).toBe(status);
            });
        });
        it('should transition expense through approval workflow', () => {
            const expense = Factory.createExpense({ status: 'PENDING' });
            db.prepare(`
        INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, date, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.date?.toISOString() || new Date().toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
            // Approve
            db.prepare('UPDATE Expense SET status = ? WHERE id = ?').run('APPROVED', expense.id);
            let updated = db.prepare('SELECT * FROM Expense WHERE id = ?').get(expense.id);
            expect(updated.status).toBe('APPROVED');
            // Mark as paid
            db.prepare('UPDATE Expense SET status = ? WHERE id = ?').run('PAID', expense.id);
            updated = db.prepare('SELECT * FROM Expense WHERE id = ?').get(expense.id);
            expect(updated.status).toBe('PAID');
        });
    });
    describe('Recurring Expenses', () => {
        const periods = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
        periods.forEach(period => {
            it(`should create ${period} recurring expense`, () => {
                const expense = Factory.createExpense({
                    description: `${period} Rent`,
                    isRecurring: true,
                    recurringPeriod: period
                });
                db.prepare(`
          INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, recurringPeriod, date, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.recurringPeriod, expense.date?.toISOString() || new Date().toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
                const stored = db.prepare('SELECT * FROM Expense WHERE id = ?').get(expense.id);
                expect(stored.isRecurring).toBe(1);
                expect(stored.recurringPeriod).toBe(period);
            });
        });
        it('should filter recurring expenses', () => {
            const expenses = [
                Factory.createExpense({ isRecurring: true, recurringPeriod: 'MONTHLY' }),
                Factory.createExpense({ isRecurring: false }),
                Factory.createExpense({ isRecurring: true, recurringPeriod: 'WEEKLY' })
            ];
            expenses.forEach(expense => {
                db.prepare(`
          INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, recurringPeriod, date, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.recurringPeriod, expense.date?.toISOString() || new Date().toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
            });
            const recurring = db.prepare('SELECT * FROM Expense WHERE isRecurring = 1').all();
            expect(recurring.length).toBe(2);
        });
    });
    describe('Expense Categories', () => {
        it('should organize expenses by category', () => {
            const categories = ['Rent', 'Utilities', 'Supplies', 'Payroll', 'Marketing'];
            categories.forEach(category => {
                const expense = Factory.createExpense({ category, amount: 100 });
                db.prepare(`
          INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, date, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.date?.toISOString() || new Date().toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
            });
            const categoryStats = db.prepare(`
        SELECT category, COUNT(*) as count, SUM(amount) as total
        FROM Expense
        GROUP BY category
      `).all();
            expect(categoryStats.length).toBeGreaterThanOrEqual(5);
        });
        it('should calculate total by category', () => {
            const expenses = [
                Factory.createExpense({ category: 'Rent', amount: 1000 }),
                Factory.createExpense({ category: 'Rent', amount: 1000 }),
                Factory.createExpense({ category: 'Utilities', amount: 200 })
            ];
            expenses.forEach(expense => {
                db.prepare(`
          INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, date, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.date?.toISOString() || new Date().toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
            });
            const rentTotal = db.prepare(`
        SELECT SUM(amount) as total
        FROM Expense
        WHERE category = 'Rent'
      `).get();
            expect(rentTotal.total).toBe(2000);
        });
    });
    describe('Vendor Management', () => {
        it('should track expenses by vendor', () => {
            const expenses = [
                Factory.createExpense({ vendor: 'Vendor A', amount: 100 }),
                Factory.createExpense({ vendor: 'Vendor A', amount: 150 }),
                Factory.createExpense({ vendor: 'Vendor B', amount: 200 })
            ];
            expenses.forEach(expense => {
                db.prepare(`
          INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, date, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.date?.toISOString() || new Date().toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
            });
            const vendorStats = db.prepare(`
        SELECT vendor, COUNT(*) as count, SUM(amount) as total
        FROM Expense
        GROUP BY vendor
      `).all();
            const vendorA = vendorStats.find((v) => v.vendor === 'Vendor A');
            expect(vendorA.total).toBe(250);
        });
    });
    describe('Expense Reporting', () => {
        beforeEach(() => {
            const expenses = [
                Factory.createExpense({ amount: 100, date: new Date('2024-01-15'), status: 'PAID' }),
                Factory.createExpense({ amount: 200, date: new Date('2024-02-15'), status: 'PAID' }),
                Factory.createExpense({ amount: 150, date: new Date('2024-03-15'), status: 'PENDING' })
            ];
            expenses.forEach(expense => {
                db.prepare(`
          INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, date, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.date.toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
            });
        });
        it('should generate monthly expense report', () => {
            const monthlyReport = db.prepare(`
        SELECT
          strftime('%Y-%m', date) as month,
          SUM(amount) as total,
          COUNT(*) as count
        FROM Expense
        GROUP BY month
        ORDER BY month
      `).all();
            expect(monthlyReport.length).toBeGreaterThanOrEqual(3);
        });
        it('should calculate total expenses for period', () => {
            const startDate = '2024-01-01';
            const endDate = '2024-03-31';
            const periodTotal = db.prepare(`
        SELECT SUM(amount) as total
        FROM Expense
        WHERE DATE(date) >= DATE(?) AND DATE(date) <= DATE(?)
      `).get(startDate, endDate);
            expect(periodTotal.total).toBe(450);
        });
        it('should filter expenses by status', () => {
            const paidExpenses = db.prepare('SELECT * FROM Expense WHERE status = ?').all('PAID');
            const pendingExpenses = db.prepare('SELECT * FROM Expense WHERE status = ?').all('PENDING');
            expect(paidExpenses.length).toBe(2);
            expect(pendingExpenses.length).toBe(1);
        });
    });
    describe('Expense Validation', () => {
        it('should validate expense amount is positive', () => {
            const validExpense = Factory.createExpense({ amount: 100 });
            expect(validExpense.amount > 0).toBe(true);
            const invalidAmount = -50;
            expect(isValidExpenseAmount(invalidAmount)).toBe(false);
        });
        it('should use Decimal for precise amounts', () => {
            const amount1 = new Decimal(123.45);
            const amount2 = new Decimal(67.89);
            const total = amount1.plus(amount2);
            expect(total.toNumber()).toBe(191.34);
        });
    });
    describe('Budget Tracking', () => {
        it('should compare expenses against budget', () => {
            const monthlyBudget = 1000;
            const expenses = [
                Factory.createExpense({ amount: 300, category: 'Rent' }),
                Factory.createExpense({ amount: 200, category: 'Utilities' }),
                Factory.createExpense({ amount: 400, category: 'Supplies' })
            ];
            expenses.forEach(expense => {
                db.prepare(`
          INSERT INTO Expense (id, description, amount, category, vendor, status, isRecurring, date, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(expense.id, expense.description, expense.amount, expense.category, expense.vendor, expense.status, expense.isRecurring ? 1 : 0, expense.date?.toISOString() || new Date().toISOString(), expense.createdAt.toISOString(), expense.updatedAt.toISOString());
            });
            const totalExpenses = db.prepare('SELECT SUM(amount) as total FROM Expense').get();
            const remainingBudget = monthlyBudget - totalExpenses.total;
            const budgetUtilization = (totalExpenses.total / monthlyBudget) * 100;
            expect(remainingBudget).toBe(100);
            expect(budgetUtilization).toBe(90);
        });
    });
});
// Helper functions
function isValidExpenseAmount(amount) {
    return amount > 0 && isFinite(amount);
}
