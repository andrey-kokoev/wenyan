import type { MiddlewareHandler } from 'hono';
import type { Bindings, Variables } from '../types/env';

/**
 * Simple CORS middleware
 */
export const corsMiddleware: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  const origin = c.req.header('origin') || '*'
  c.header('Access-Control-Allow-Origin', origin)
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  c.header('Access-Control-Allow-Credentials', 'true')
  
  if (c.req.method === 'OPTIONS') {
    return c.body(null, 204)
  }
  
  await next()
};

/**
 * Simple logger middleware
 */
export const loggerMiddleware: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const url = c.req.url;
  
  await next();
  
  const duration = Date.now() - start;
  const status = c.res.status;
  
  // Simple logging - in production you might want structured logging
  if (c.env.ENVIRONMENT === 'development') {
    console.log(`${method} ${url} ${status} - ${duration}ms`);
  }
};

/**
 * Request ID middleware for tracing
 */
export const requestIdMiddleware: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  const requestId = Math.random().toString(36).substring(2, 15);
  c.set('requestId', requestId);
  c.header('X-Request-ID', requestId);
  await next();
};

/**
 * Error handling middleware
 */
export const errorHandlerMiddleware: MiddlewareHandler<{ Bindings: Bindings; Variables: Variables }> = async (c, next) => {
  try {
    await next();
  } catch (error) {
    const requestId = c.get('requestId');
    const isDev = c.env.ENVIRONMENT === 'development';
    
    // Simple error logging
    if (c.env.ENVIRONMENT === 'development') {
      console.error('Error:', error);
    }
    
    return c.json({
      error: {
        message: error instanceof Error ? error.message : 'Internal Server Error',
        ...(isDev && { stack: error instanceof Error ? error.stack : undefined }),
        requestId,
      },
      timestamp: new Date().toISOString(),
    }, 500);
  }
};

/**
 * Common middleware stack
 */
export const commonMiddleware = [
  corsMiddleware,
  loggerMiddleware,
  requestIdMiddleware,
  errorHandlerMiddleware,
];
