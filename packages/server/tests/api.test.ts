import { describe, it, expect } from 'vitest';
import { app } from '../src/index';

const testEnv = {
  ENVIRONMENT: 'test',
  WENYAN_GENESIS_KEY: 'AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA=',
  WENYAN_AUTH_JWT_SECRET: 'test-jwt-secret',
} as const;

function request(path: string, init?: RequestInit) {
  return app.request(path, init, testEnv);
}

describe('Wenyan Server API', () => {
  it('should respond to root endpoint', async () => {
    const res = await request('/');
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json.message).toBe('Wenyan Server API');
    expect(json.version).toBe('1.0.1');
  });

  it('should respond to health check', async () => {
    const res = await request('/health');
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json.status).toBe('healthy');
  });

  it('should respond to ping', async () => {
    const res = await request('/health/ping');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('pong');
  });

  it('should serve API fallback for unknown routes in test', async () => {
    const res = await request('/health/unknown');
    expect(res.status).toBe(200);
    
    const json = await res.json();
    expect(json.message).toBe('Wenyan Server API');
  });

  it('should require auth for document upload', async () => {
    const invalidData = {
      filename: '',
      fileType: 'invalid',
    };
    
    const res = await request('/documents/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidData),
    });
    
    expect(res.status).toBe(401);
  });

  it('should expose prometheus metrics endpoint', async () => {
    const res = await request('/metrics');
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('wenyan_seals_total');
    expect(text).toContain('wenyan_seal_latency_seconds');
  });
});
