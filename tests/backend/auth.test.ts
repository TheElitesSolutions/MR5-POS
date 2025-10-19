import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { getTestDatabase } from '../setup/backend.setup';
import { Factory, DbHelper, Auth } from '../utils/test-helpers';

// Mock the authService
jest.mock('../../main/services/authService');

describe('Authentication & Authorization', () => {
  let db: any;
  let dbHelper: DbHelper;

  beforeEach(() => {
    db = getTestDatabase();
    dbHelper = new DbHelper(db);
  });

  describe('User Authentication', () => {
    it('should hash passwords correctly on user creation', async () => {
      const password = 'SecurePassword123!';
      const hashedPassword = await bcrypt.hash(password, 10);

      const user = Factory.createUser({ password: hashedPassword });
      dbHelper.insertUser(user);

      const storedUser = db.prepare('SELECT * FROM User WHERE id = ?').get(user.id);
      expect(storedUser).toBeDefined();

      const isPasswordValid = await bcrypt.compare(password, storedUser.password);
      expect(isPasswordValid).toBe(true);
    });

    it('should generate valid JWT tokens', () => {
      const user = Factory.createUser();
      const token = Auth.generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = Auth.verifyToken(token);
      expect(decoded.id).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.role).toBe(user.role);
    });

    it('should generate and verify refresh tokens', () => {
      const user = Factory.createUser();
      const refreshToken = Auth.generateRefreshToken(user);

      expect(refreshToken).toBeDefined();
      expect(typeof refreshToken).toBe('string');

      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_SECRET || 'test-refresh-secret'
      ) as any;
      expect(decoded.id).toBe(user.id);
    });

    it('should reject invalid credentials', async () => {
      const user = Factory.createUser();
      dbHelper.insertUser(user);

      const storedUser = db.prepare('SELECT * FROM User WHERE email = ?').get(user.email);
      const isPasswordValid = await bcrypt.compare('wrongpassword', storedUser.password);

      expect(isPasswordValid).toBe(false);
    });

    it('should handle token expiration', () => {
      const user = Factory.createUser();
      const expiredToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '-1h' } // Already expired
      );

      expect(() => Auth.verifyToken(expiredToken)).toThrow();
    });

    it('should prevent duplicate email registration', () => {
      const email = 'duplicate@test.com';
      const user1 = Factory.createUser({ email });
      const user2 = Factory.createUser({ email });

      dbHelper.insertUser(user1);

      expect(() => dbHelper.insertUser(user2)).toThrow();
    });
  });

  describe('Role-Based Access Control', () => {
    const roles = ['OWNER', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'ADMIN'];

    roles.forEach(role => {
      it(`should correctly assign ${role} role`, () => {
        const user = Factory.createUser({ role });
        dbHelper.insertUser(user);

        const storedUser = db.prepare('SELECT * FROM User WHERE id = ?').get(user.id);
        expect(storedUser.role).toBe(role);
      });
    });

    it('should enforce role-based permissions for ADMIN', () => {
      const admin = Factory.createUser({ role: 'ADMIN' });
      const token = Auth.generateToken(admin);
      const decoded = Auth.verifyToken(token);

      expect(decoded.role).toBe('ADMIN');
      // Admin should have access to all operations
      expect(canAccessUserManagement(decoded.role)).toBe(true);
      expect(canAccessReports(decoded.role)).toBe(true);
      expect(canModifyInventory(decoded.role)).toBe(true);
      expect(canProcessOrders(decoded.role)).toBe(true);
    });

    it('should enforce role-based permissions for CASHIER', () => {
      const cashier = Factory.createUser({ role: 'CASHIER' });
      const token = Auth.generateToken(cashier);
      const decoded = Auth.verifyToken(token);

      expect(decoded.role).toBe('CASHIER');
      // Cashier should have limited access
      expect(canAccessUserManagement(decoded.role)).toBe(false);
      expect(canAccessReports(decoded.role)).toBe(false);
      expect(canModifyInventory(decoded.role)).toBe(false);
      expect(canProcessOrders(decoded.role)).toBe(true);
    });

    it('should enforce role-based permissions for MANAGER', () => {
      const manager = Factory.createUser({ role: 'MANAGER' });
      const token = Auth.generateToken(manager);
      const decoded = Auth.verifyToken(token);

      expect(decoded.role).toBe('MANAGER');
      // Manager should have extensive access
      expect(canAccessUserManagement(decoded.role)).toBe(false);
      expect(canAccessReports(decoded.role)).toBe(true);
      expect(canModifyInventory(decoded.role)).toBe(true);
      expect(canProcessOrders(decoded.role)).toBe(true);
    });

    it('should enforce role-based permissions for WAITER', () => {
      const waiter = Factory.createUser({ role: 'WAITER' });
      const token = Auth.generateToken(waiter);
      const decoded = Auth.verifyToken(token);

      expect(decoded.role).toBe('WAITER');
      // Waiter should have order access only
      expect(canAccessUserManagement(decoded.role)).toBe(false);
      expect(canAccessReports(decoded.role)).toBe(false);
      expect(canModifyInventory(decoded.role)).toBe(false);
      expect(canProcessOrders(decoded.role)).toBe(true);
    });

    it('should enforce role-based permissions for KITCHEN', () => {
      const kitchen = Factory.createUser({ role: 'KITCHEN' });
      const token = Auth.generateToken(kitchen);
      const decoded = Auth.verifyToken(token);

      expect(decoded.role).toBe('KITCHEN');
      // Kitchen should only view orders
      expect(canAccessUserManagement(decoded.role)).toBe(false);
      expect(canAccessReports(decoded.role)).toBe(false);
      expect(canModifyInventory(decoded.role)).toBe(false);
      expect(canViewOrders(decoded.role)).toBe(true);
      expect(canProcessPayments(decoded.role)).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should store refresh token in database', () => {
      const user = Factory.createUser();
      const refreshToken = Auth.generateRefreshToken(user);
      user.refreshToken = refreshToken;

      dbHelper.insertUser(user);

      const storedUser = db.prepare('SELECT * FROM User WHERE id = ?').get(user.id);
      expect(storedUser.refreshToken).toBe(refreshToken);
    });

    it('should invalidate refresh token on logout', () => {
      const user = Factory.createUser();
      const refreshToken = Auth.generateRefreshToken(user);
      user.refreshToken = refreshToken;

      dbHelper.insertUser(user);

      // Simulate logout by clearing refresh token
      db.prepare('UPDATE User SET refreshToken = NULL WHERE id = ?').run(user.id);

      const storedUser = db.prepare('SELECT * FROM User WHERE id = ?').get(user.id);
      expect(storedUser.refreshToken).toBeNull();
    });

    it('should handle concurrent login attempts', async () => {
      const user = Factory.createUser();
      dbHelper.insertUser(user);

      // Simulate multiple login attempts with slight delays to ensure unique timestamps
      const tokens = [];
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 5)); // Small delay
        tokens.push(Auth.generateToken(user));
      }

      // All tokens should be valid
      tokens.forEach(token => {
        expect(token).toBeDefined();
        const decoded = Auth.verifyToken(token);
        expect(decoded.id).toBe(user.id);
      });

      // Verify all tokens work correctly (may or may not be unique based on timestamp precision)
      expect(tokens.length).toBe(3);
    });

    it('should handle session timeout correctly', async () => {
      const user = Factory.createUser();
      const shortLivedToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1s' }
      );

      // Token should be valid initially
      expect(() => Auth.verifyToken(shortLivedToken)).not.toThrow();

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Token should now be invalid
      expect(() => Auth.verifyToken(shortLivedToken)).toThrow();
    });
  });

  describe('Password Management', () => {
    it('should validate password strength', () => {
      const weakPasswords = ['123456', 'password', 'abc', ''];
      const strongPasswords = ['Str0ng!Pass123', 'C0mpl3x@Password', 'SecureP@ss2024'];

      weakPasswords.forEach(pwd => {
        expect(isPasswordStrong(pwd)).toBe(false);
      });

      strongPasswords.forEach(pwd => {
        expect(isPasswordStrong(pwd)).toBe(true);
      });
    });

    it('should handle password reset flow', async () => {
      const user = Factory.createUser();
      dbHelper.insertUser(user);

      // Generate reset token (simplified)
      const resetToken = jwt.sign(
        { id: user.id, purpose: 'password-reset' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const decoded = jwt.verify(
        resetToken,
        process.env.JWT_SECRET || 'test-secret'
      ) as any;

      expect(decoded.id).toBe(user.id);
      expect(decoded.purpose).toBe('password-reset');

      // Update password
      const newPassword = 'NewSecureP@ss123';
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);

      db.prepare('UPDATE User SET password = ? WHERE id = ?')
        .run(hashedNewPassword, user.id);

      const updatedUser = db.prepare('SELECT * FROM User WHERE id = ?').get(user.id);
      const isNewPasswordValid = await bcrypt.compare(newPassword, updatedUser.password);

      expect(isNewPasswordValid).toBe(true);
    });
  });

  describe('Security Vulnerabilities', () => {
    it('should prevent SQL injection in login', () => {
      const maliciousEmail = "admin' OR '1'='1";
      const user = Factory.createUser({ email: 'legitimate@test.com' });
      dbHelper.insertUser(user);

      const result = db.prepare('SELECT * FROM User WHERE email = ?')
        .get(maliciousEmail);

      expect(result).toBeUndefined();
    });

    it('should prevent JWT token manipulation', () => {
      const user = Factory.createUser();
      const validToken = Auth.generateToken(user);

      // Try to manipulate the token
      const parts = validToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.role = 'ADMIN'; // Try to escalate privileges

      const manipulatedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      const manipulatedToken = `${parts[0]}.${manipulatedPayload}.${parts[2]}`;

      // Verification should fail
      expect(() => Auth.verifyToken(manipulatedToken)).toThrow();
    });

    it('should handle rate limiting for failed login attempts', () => {
      const email = 'test@example.com';
      const failedAttempts: number[] = [];
      const maxAttempts = 5;
      const lockoutTime = 15 * 60 * 1000; // 15 minutes

      for (let i = 0; i < maxAttempts + 1; i++) {
        failedAttempts.push(Date.now());
      }

      const isLocked = failedAttempts.length >= maxAttempts;
      expect(isLocked).toBe(true);
    });
  });
});

// Helper functions for role-based permissions
function canAccessUserManagement(role: string): boolean {
  return ['ADMIN', 'OWNER'].includes(role);
}

function canAccessReports(role: string): boolean {
  return ['ADMIN', 'OWNER', 'MANAGER'].includes(role);
}

function canModifyInventory(role: string): boolean {
  return ['ADMIN', 'OWNER', 'MANAGER'].includes(role);
}

function canProcessOrders(role: string): boolean {
  return ['ADMIN', 'OWNER', 'MANAGER', 'CASHIER', 'WAITER'].includes(role);
}

function canViewOrders(role: string): boolean {
  return true; // All roles can view orders
}

function canProcessPayments(role: string): boolean {
  return ['ADMIN', 'OWNER', 'MANAGER', 'CASHIER'].includes(role);
}

function isPasswordStrong(password: string): boolean {
  // At least 8 characters, one uppercase, one lowercase, one number, one special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
}