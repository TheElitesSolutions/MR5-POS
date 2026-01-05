/**
 * NOTE: This file contains Express middleware but is not currently used in this Electron app.
 * This file is kept for future reference if a backend Express server is added.
 *
 * The content has been commented out to avoid TypeScript errors from missing Express dependencies.
 *
 * To use this file:
 * 1. Install: npm install express express-rate-limit helmet
 * 2. Install types: npm install --save-dev @types/express
 * 3. Uncomment the code below
 */
// Uncomment below if Express server is added:
/*
import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Rate limiting configuration
export const createRateLimiter = (
  windowMs: number = 15 * 60 * 1000,
  max: number = 100
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      if (process.env.NODE_ENV === 'development') {
        return req.ip === '127.0.0.1' || req.ip === '::1';
      }
      return false;
    },
  });
};

export const apiLimiter = createRateLimiter(15 * 60 * 1000, 100);
export const authLimiter = createRateLimiter(15 * 60 * 1000, 5);

export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'http://localhost:*', 'ws://localhost:*', 'wss://localhost:*'],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'no-referrer' },
});

export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
};

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
};

function sanitizeObject(obj: any): void {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      obj[key] = obj[key]
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

export const securityErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.name === 'UnauthorizedError' || err.status === 401) {
    console.warn(`Security: Unauthorized access attempt from ${req.ip} to ${req.path}`);
    return res.status(401).json({ error: 'Authentication required', timestamp: new Date().toISOString() });
  }
  if (err.name === 'ForbiddenError' || err.status === 403) {
    console.warn(`Security: Forbidden access attempt from ${req.ip} to ${req.path}`);
    return res.status(403).json({ error: 'Access forbidden', timestamp: new Date().toISOString() });
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('Security: Internal error:', err);
    return res.status(500).json({ error: 'Internal server error', timestamp: new Date().toISOString() });
  }
  return next(err);
};

export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      timestamp: new Date().toISOString(),
      ip: req.ip,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      userAgent: req.get('User-Agent') || 'Unknown',
    };
    if (res.statusCode >= 400) console.warn('Security: Suspicious request:', logData);
    if (duration > 5000) console.warn('Security: Slow request detected:', logData);
  });
  next();
};

export function corsMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
}

export function cspMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:*;");
  next();
}
*/
// Export empty objects to prevent import errors
export const createRateLimiter = () => ({});
export const apiLimiter = {};
export const authLimiter = {};
export const securityHeaders = {};
export const corsOptions = {};
export const validateRequest = () => { };
export const securityErrorHandler = () => { };
export const securityLogger = () => { };
export const corsMiddleware = () => { };
export const cspMiddleware = () => { };
