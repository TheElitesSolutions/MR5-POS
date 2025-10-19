import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { logError } from '../error-handler';

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    logError(
      `Failed to hash password: ${error instanceof Error ? error.message : String(error)}`
    );
    throw new Error('Password hashing failed');
  }
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logError(
      `Failed to compare password: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * Generate a JWT token
 */
export function generateToken(
  payload: Record<string, any>,
  secret: string,
  expiresIn: string | number
): string {
  try {
    // Direct approach with proper typing for jwt.sign
    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  } catch (error) {
    logError(
      `Token generation failed: ${error instanceof Error ? error.message : String(error)}`
    );
    throw new Error('Failed to generate authentication token');
  }
}

/**
 * Verify a JWT token
 */
export function verifyToken(
  token: string,
  secret: string
): Record<string, any> | null {
  try {
    return jwt.verify(token, secret) as Record<string, any>;
  } catch (error) {
    logError(
      `Token verification failed: ${error instanceof Error ? error.message : String(error)}`
    );
    return null;
  }
}
