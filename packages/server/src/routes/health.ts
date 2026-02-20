import { Hono } from 'hono';
import type { Bindings, Variables } from '../types/env';

/**
 * Health check router
 */
const healthRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

/**
 * Basic health check
 */
healthRoutes.get('/', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    version: '0.1.0',
  });
});

/**
 * Detailed health check with system info
 */
healthRoutes.get('/detailed', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
    version: '0.1.0',
    uptime: Date.now(), // In Workers, this is just current time
    memory: {
      // Cloudflare Workers memory info
      available: '128MB', // Standard Worker limit
    },
    services: {
      // Add status of external services here
      database: 'not_configured',
      storage: 'not_configured',
      cache: 'not_configured',
    },
  });
});

/**
 * Readiness check (for Kubernetes/K8s style deployments)
 */
healthRoutes.get('/ready', (c) => {
  return c.json({
    status: 'ready',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
  });
});

/**
 * Liveness check (for Kubernetes/K8s style deployments)
 */
healthRoutes.get('/live', (c) => {
  return c.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT,
  });
});

/**
 * Ping endpoint for simple connectivity tests
 */
healthRoutes.get('/ping', (c) => {
  return c.text('pong');
});

export { healthRoutes };
