import { NextResponse } from 'next/server';
// Authentication completely removed - all routes are now public
// Keeping this as reference for potential future re-implementation
/*
const publicRoutes = ["/login", "/register"];
const roleProtectedRoutes = {
  "/dashboard": ["OWNER", "MANAGER"],
  "/menu": ["OWNER", "MANAGER"],
  "/stock": ["OWNER", "MANAGER"],
  "/expenses": ["OWNER", "MANAGER", "EMPLOYEE"], // All roles can view expenses
} as const;
*/
export function middleware(request) {
    const { pathname } = request.nextUrl;
    // Skip middleware for static files, API routes, and Next.js internals
    if (pathname.startsWith('/_next/') ||
        pathname.startsWith('/api/') ||
        pathname.startsWith('/favicon.ico') ||
        pathname.includes('.') ||
        pathname.startsWith('/_vercel')) {
        return NextResponse.next();
    }
    // Create response with enhanced security headers (authentication removed)
    const response = NextResponse.next();
    // Set comprehensive security headers
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    // Content Security Policy optimized for Electron
    response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:*; frame-ancestors 'none';");
    return response;
}
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - _vercel (Vercel internals)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|_vercel).*)',
    ],
};
