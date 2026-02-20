import { Hono } from 'hono';
import type { Bindings, Variables } from './types/env';
import { commonMiddleware } from './middleware/common';
import { healthRoutes } from './routes/health';
import { documentRoutes } from './routes/documents';
import { authRoutes } from './auth';
import { authMiddleware } from './middleware/auth';
import { accessControlRoutes } from './routes/access-control';
import { ensurePersonalWorkspaceMiddleware } from './utils/workspaces';
import issuesRoutes from './routes/issues';
import aiProvidersListHandler from './routes/ai/providers/index.get';
import adminAiRoutes from './routes/admin/ai';
import adminConfigRoutes from './routes/admin/config';
import { createStorageAdapter, type StorageAdapter } from '@wenyan/archive/adapter';
import { syncWithPeer } from '@wenyan/archive/sync';
import { ReliableChannel } from '@wenyan/channel';
import { parseBootstrapConfig, type EdictLawType, type LawMode } from '@wenyan/core';
import { buildGateway, type GatewayRuntimeOptions } from '@wenyan/gateway';
import { BridgeGateway } from '@wenyan/bridge';
import { SwimMembership, InMemoryPlumtree, ImperialBroadcast } from '@wenyan/gossip';
import { PbftConsensus } from '@wenyan/consensus';
import { mergeEdict, type EdictLike } from '@wenyan/crdt';
import { DEV_SEAL_CONTEXT } from '@wenyan/seal';

// Import me/settings routes
import meSettingsGetHandler from './routes/me/settings/index.get';
import meSettingsPatchHandler from './routes/me/settings/index.patch';
import meSettingsPutHandler from './routes/me/settings/index.put';

// Import workspace and project routes
import workspacesListHandler from './routes/workspaces/index.get';
import workspacesCreateHandler from './routes/workspaces/index.post';
import workspaceGetHandler from './routes/workspaces/[id]/index.get';
import workspaceUpdateHandler from './routes/workspaces/[id]/index.patch';
import workspaceDeleteHandler from './routes/workspaces/[id]/index.delete';
import workspaceCloneHandler from './routes/workspaces/[id]/clone/index.post';
import workspaceRulesListHandler from './routes/workspaces/[id]/rules/index.get';
import workspaceRulesLinkHandler from './routes/workspaces/[id]/rules/index.post';
import workspaceRulesUnlinkHandler from './routes/workspaces/[id]/rules/[ruleId]/index.delete';

import projectsListHandler from './routes/projects/index.get';
import projectsCreateHandler from './routes/projects/index.post';
import projectGetHandler from './routes/projects/[id]/index.get';
import projectUpdateHandler from './routes/projects/[id]/index.patch';
import projectDeleteHandler from './routes/projects/[id]/index.delete';
import rulesListHandler from './routes/rules/index.get';
import rulesCreateHandler from './routes/rules/index.post';
import rulesAiCreateHandler from './routes/rules/ai.post';
import rulesAiDuplicatesHandler from './routes/rules/ai-duplicates.post';
import ruleGetHandler from './routes/rules/[id]/index.get';
import ruleUpdateHandler from './routes/rules/[id]/index.patch';
import ruleDeleteHandler from './routes/rules/[id]/index.delete';
import ruleSetsListHandler from './routes/rule-sets/index.get';
import ruleSetsCreateHandler from './routes/rule-sets/index.post';
import ruleSetGetHandler from './routes/rule-sets/[id]/index.get';
import ruleSetUpdateHandler from './routes/rule-sets/[id]/index.patch';
import ruleSetDeleteHandler from './routes/rule-sets/[id]/index.delete';
import ruleSetRulesListHandler from './routes/rule-sets/[id]/rules/index.get';
import ruleSetRulesLinkHandler from './routes/rule-sets/[id]/rules/index.post';
import ruleSetRulesUnlinkHandler from './routes/rule-sets/[id]/rules/[ruleId]/index.delete';
import projectRulesListHandler from './routes/projects/[id]/rules/index.get';
import projectRulesLinkHandler from './routes/projects/[id]/rules/index.post';
import projectRulesUnlinkHandler from './routes/projects/[id]/rules/[ruleId]/index.delete';
import projectRuleSetsListHandler from './routes/projects/[id]/rule-sets/index.get';
import projectRuleSetsLinkHandler from './routes/projects/[id]/rule-sets/index.post';
import projectRuleSetsUnlinkHandler from './routes/projects/[id]/rule-sets/[ruleSetId]/index.delete';
import projectEffectiveRulesHandler from './routes/projects/[id]/effective-rules/index.get';
import projectIssuesAnalyzeHandler from './routes/projects/[id]/issues/analyze.post';
import projectIssuesAnalyzeStatusHandler from './routes/projects/[id]/issues/analyze/[jobId]/index.get';
import projectIssuesAnalyzeConsumeHandler from './routes/projects/[id]/issues/analyze/[jobId]/consume.post';
import themesListHandler from './routes/themes/index.get';
import themeGetHandler from './routes/themes/[id]/index.get';
import themeUpdateHandler from './routes/themes/[id]/index.patch';

/**
 * Create and configure the Hono application
 */
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();
const DEFAULT_NODE_ID = '00000000-0000-4000-8000-000000000000';
const DEFAULT_GENESIS_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseLawPreload(raw: string | undefined): EdictLawType[] | undefined {
  if (!raw) return undefined;
  const values = raw
    .split(',')
    .map((v) => v.trim())
    .filter((v): v is EdictLawType =>
      v === 'appointment' ||
      v === 'classification' ||
      v === 'routing' ||
      v === 'admission' ||
      v === 'protocol' ||
      v === 'regulation',
    );
  return values.length > 0 ? values : undefined;
}

function parseCsv(raw: string | undefined): string[] {
  if (!raw) return []
  return raw.split(',').map((v) => v.trim()).filter(Boolean)
}

function parseBridgeAdapters(raw: string | undefined): Array<Record<string, unknown>> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : []
  } catch {
    return []
  }
}

function resolveBootstrap(env: Bindings) {
  return parseBootstrapConfig({
    archive: {
      engine: env.WENYAN_ARCHIVE_ENGINE ?? (env.DB ? 'cloudflare' : 'sqlite'),
      path: env.WENYAN_ARCHIVE_PATH ?? "./wenyan.dang'an",
    },
    genesis: {
      node_id: env.WENYAN_NODE_ID ?? DEFAULT_NODE_ID,
      genesis_key: env.WENYAN_GENESIS_KEY ?? DEFAULT_GENESIS_KEY,
    },
    gateway: {
      listen: {
        host: env.WENYAN_GATEWAY_HOST ?? '127.0.0.1',
        port: parsePositiveInt(env.WENYAN_GATEWAY_PORT, 8787),
      },
      ...(env.WENYAN_UPSTREAM ? { upstream: env.WENYAN_UPSTREAM } : {}),
    },
    law: {
      mode: (env.WENYAN_LAW_MODE as LawMode | undefined) ?? 'strict',
    },
    law_cache: {
      ttl_seconds: parsePositiveInt(env.WENYAN_LAW_CACHE_TTL_SECONDS, 60),
      preload_types: parseLawPreload(env.WENYAN_LAW_PRELOAD_TYPES) ?? ['appointment', 'classification'],
    },
    distributed: {
      mode: env.WENYAN_DISTRIBUTED_MODE ?? 'single',
      node_id: env.WENYAN_DISTRIBUTED_NODE_ID ?? env.WENYAN_NODE_ID ?? DEFAULT_NODE_ID,
      bind_gossip: env.WENYAN_DISTRIBUTED_BIND_GOSSIP ?? '127.0.0.1:7946',
      seeds: parseCsv(env.WENYAN_DISTRIBUTED_SEEDS),
      fanout: parsePositiveInt(env.WENYAN_DISTRIBUTED_FANOUT, 3),
      suspicion_timeout_ms: parsePositiveInt(env.WENYAN_DISTRIBUTED_SUSPICION_TIMEOUT_MS, 5000),
    },
    consensus: {
      kind: env.WENYAN_CONSENSUS_KIND ?? 'none',
      replica_set: parseCsv(env.WENYAN_CONSENSUS_REPLICA_SET),
      constitutional_threshold: parsePositiveInt(env.WENYAN_CONSENSUS_THRESHOLD, 3),
      view_change_timeout_ms: parsePositiveInt(env.WENYAN_CONSENSUS_VIEW_CHANGE_TIMEOUT_MS, 5000),
    },
    sync: {
      batch_size: parsePositiveInt(env.WENYAN_SYNC_BATCH_SIZE, 200),
      max_inflight: parsePositiveInt(env.WENYAN_SYNC_MAX_INFLIGHT, 4),
      retry_backoff_ms: parsePositiveInt(env.WENYAN_SYNC_RETRY_BACKOFF_MS, 300),
    },
    bridge: {
      enabled: env.WENYAN_BRIDGE_ENABLED === 'true',
      mode: env.WENYAN_BRIDGE_MODE ?? 'standalone',
      adapters: parseBridgeAdapters(env.WENYAN_BRIDGE_ADAPTERS_JSON),
      sync: {
        mode: env.WENYAN_BRIDGE_SYNC_MODE ?? 'hybrid',
        poll_interval_ms: parsePositiveInt(env.WENYAN_BRIDGE_SYNC_POLL_INTERVAL_MS, 1000),
        batch_size: parsePositiveInt(env.WENYAN_BRIDGE_SYNC_BATCH_SIZE, 100),
      },
      circuit_breaker: {
        failure_rate_threshold: Number(env.WENYAN_BRIDGE_BREAKER_FAILURE_RATE ?? 0.05),
        cool_down_ms: parsePositiveInt(env.WENYAN_BRIDGE_BREAKER_COOL_DOWN_MS, 30_000),
        max_retries: parsePositiveInt(env.WENYAN_BRIDGE_BREAKER_MAX_RETRIES, 10),
      },
    },
  });
}

function resolveStorageAdapter(kind: string | undefined, env: Bindings, sqlitePath: string): StorageAdapter {
  if (kind === 'cloudflare') {
    if (!env.DB) {
      throw new Error('cloudflare adapter requires DB binding');
    }
    return createStorageAdapter({
      kind: 'cloudflare',
      d1: env.DB as unknown as Parameters<typeof createStorageAdapter>[0]['d1'],
      retentionDays: 3650,
    });
  }
  return createStorageAdapter({ kind: 'sqlite', sqlitePath, retentionDays: 3650 });
}

let wenyanArchive: Awaited<ReturnType<StorageAdapter['createRepository']>> | undefined;
let wenyanArchiveInit: Promise<void> | undefined
const wenyanChannel = new ReliableChannel();
let wenyanMembership: SwimMembership | undefined;
let wenyanPlumtree: InMemoryPlumtree | undefined;
let wenyanImperial: ImperialBroadcast | undefined;
let wenyanPbft: PbftConsensus | undefined;
let wenyanBridge: BridgeGateway | undefined;
const wenyanGatewayOptions: GatewayRuntimeOptions = {
  lawMode: 'strict',
  distributedMode: 'single',
  consensusKind: 'none',
  lawCacheTtlSeconds: 60,
  lawPreloadTypes: ['appointment', 'classification'],
};
const wenyanGateway = buildGateway(async () => {
  if (!wenyanArchive) {
    throw new Error('wenyan archive is not initialized');
  }
  return wenyanArchive;
}, wenyanChannel, DEV_SEAL_CONTEXT, wenyanGatewayOptions);

/**
 * Apply common middleware to all routes
 */
app.use('*', ...commonMiddleware);
app.use('*', async (c, next) => {
  if (!wenyanArchiveInit) {
    wenyanArchiveInit = (async () => {
      const bootstrap = resolveBootstrap(c.env);
      wenyanGatewayOptions.lawMode = bootstrap.law.mode;
      wenyanGatewayOptions.distributedMode = bootstrap.distributed.mode;
      wenyanGatewayOptions.consensusKind = bootstrap.consensus.kind;
      wenyanGatewayOptions.nodeId = bootstrap.distributed.node_id;
      wenyanGatewayOptions.lawCacheTtlSeconds = bootstrap.law_cache?.ttl_seconds ?? 60;
      wenyanGatewayOptions.lawPreloadTypes = bootstrap.law_cache?.preload_types;

      const adapter = resolveStorageAdapter(bootstrap.archive.engine, c.env, bootstrap.archive.path);
      wenyanArchive = await adapter.createRepository();
      if (bootstrap.distributed.mode === 'consort') {
        wenyanMembership = new SwimMembership(bootstrap.distributed.suspicion_timeout_ms);
        wenyanPlumtree = new InMemoryPlumtree(bootstrap.distributed.fanout);
        wenyanImperial = new ImperialBroadcast();
        for (const seed of bootstrap.distributed.seeds) {
          wenyanMembership.upsert(seed, seed);
        }
        wenyanGatewayOptions.meshMembers = () => wenyanMembership?.list() ?? [];
        wenyanGatewayOptions.meshPartitioned = () => wenyanMembership?.isPartitioned() ?? false;
        wenyanGatewayOptions.onMeshJoin = async (peer) => {
          wenyanMembership?.upsert(peer, peer);
          return { ok: true, detail: `joined ${peer}` };
        };
        wenyanGatewayOptions.onSealGossip = async (messageId, sealSeq) => {
          if (sealSeq < 6) {
            wenyanPlumtree?.eagerPush({ id: `${messageId}:${sealSeq}`, topic: 'seal', payload: { messageId, sealSeq } });
          } else {
            wenyanImperial?.deliver({ id: `${messageId}:${sealSeq}`, topic: 'imperial', payload: { messageId, sealSeq } });
          }
        };
        wenyanGatewayOptions.onMeshSync = async (peer, fromCursor, limit) => {
          if (!wenyanArchive) return { ok: false, fetched: 0 };
          const remoteBase = peer.replace(/^gossip:\/\//, 'http://').replace(/\/$/, '');
          const result = await syncWithPeer(
            wenyanArchive,
            {
              getMerkleRoot: async () => {
                const res = await fetch(`${remoteBase}/api/wenyan/mesh/merkle-root`);
                const json = await res.json() as { root: string };
                return json.root;
              },
              getSyncRange: async (cursor, lim) => {
                const res = await fetch(`${remoteBase}/api/wenyan/mesh/sync`, {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ peer: 'local', fromCursor: cursor, limit: lim }),
                });
                if (!res.ok) return [];
                const json = await res.json() as { transitions?: Array<Record<string, unknown>> };
                return json.transitions ?? [];
              },
            },
            { fromCursor, limit },
          );
          if (result.diverged) {
            const a: EdictLike = { id: 'local', nodeId: bootstrap.distributed.node_id, precedence: 0, clock: { [bootstrap.distributed.node_id]: 1 }, payload: {} };
            const b: EdictLike = { id: 'remote', nodeId: peer, precedence: 0, clock: { [peer]: 1 }, payload: {} };
            mergeEdict(a, b);
          }
          return { ok: true, fetched: result.fetched };
        };
      }
      if (bootstrap.consensus.kind === 'pbft') {
        wenyanPbft = new PbftConsensus({
          replicaSet: bootstrap.consensus.replica_set.length > 0
            ? bootstrap.consensus.replica_set
            : [bootstrap.distributed.node_id],
          threshold: bootstrap.consensus.constitutional_threshold,
          viewChangeTimeoutMs: bootstrap.consensus.view_change_timeout_ms,
        });
        wenyanGatewayOptions.pbftConsensus = wenyanPbft;
      }

      if (bootstrap.bridge.enabled && bootstrap.bridge.mode === 'embedded') {
        const hasNodeRuntime = typeof process !== 'undefined' && !!process.versions?.node
        if (hasNodeRuntime) {
          wenyanBridge = new BridgeGateway({
            bootstrap,
            archive: wenyanArchive,
            apiBaseUrl: `${bootstrap.gateway.upstream ?? `http://${bootstrap.gateway.listen.host}:${bootstrap.gateway.listen.port}`}/api/wenyan`,
          })
          await wenyanBridge.start()
        }
      }
    })()
  }
  await wenyanArchiveInit
  return next();
});

/**
 * Auth routes (must be before auth middleware to allow unauthenticated access)
 */
app.route('/auth', authRoutes);
app.route('/api/auth', authRoutes);
app.route('/api/wenyan', wenyanGateway);

/**
 * Health check routes
 */
app.route('/health', healthRoutes);

/**
 * API info endpoint
 */
app.get('/api', (c) => {
  return c.json({
    name: 'Wenyan API',
    version: '0.2.0',
    environment: c.env.ENVIRONMENT,
    endpoints: {
      health: '/health',
      documents: '/documents',
      workspaces: '/api/workspaces',
  projects: '/api/projects',
      rules: '/api/rules',
      issues: '/api/issues',
      auth: {
        microsoft: '/auth/microsoft',
        callback: '/auth/callback',
        logout: '/auth/logout',
        session: '/api/auth/session',
      },
      accessControl: {
        roles: '/api/access-control/roles',
        controlledActions: '/api/access-control/controlled-actions',
        roleMappings: '/api/access-control/roles-rel-controlled-actions',
        userRoleMappings: '/api/access-control/external-user-ids-rel-roles',
      },
    },
    documentation: '/docs',
  });
});

/**
 * Auth middleware (excludes auth and health routes, and static assets)
 * Only applies to /documents and other protected API routes
 */
app.use('/documents/*', authMiddleware());
app.use('/api/*', authMiddleware());

/**
 * Document analysis routes
 */
app.route('/documents', documentRoutes);

/**
 * Workspaces API routes
 */
app.use('/api/workspaces', ensurePersonalWorkspaceMiddleware);
app.get('/api/workspaces', workspacesListHandler);
app.post('/api/workspaces', workspacesCreateHandler);
app.get('/api/workspaces/:id', workspaceGetHandler);
app.patch('/api/workspaces/:id', workspaceUpdateHandler);
app.delete('/api/workspaces/:id', workspaceDeleteHandler);
app.post('/api/workspaces/:id/clone', workspaceCloneHandler);
app.get('/api/workspaces/:id/rules', workspaceRulesListHandler);
app.post('/api/workspaces/:id/rules', workspaceRulesLinkHandler);
app.delete('/api/workspaces/:id/rules/:ruleId', workspaceRulesUnlinkHandler);

/**
 * Projects API routes
 */
app.get('/api/projects', projectsListHandler);
app.post('/api/projects', projectsCreateHandler);
app.get('/api/projects/:id', projectGetHandler);
app.patch('/api/projects/:id', projectUpdateHandler);
app.delete('/api/projects/:id', projectDeleteHandler);
app.get('/api/projects/:id/rules', projectRulesListHandler);
app.post('/api/projects/:id/rules', projectRulesLinkHandler);
app.delete('/api/projects/:id/rules/:ruleId', projectRulesUnlinkHandler);
app.get('/api/projects/:id/rule-sets', projectRuleSetsListHandler);
app.post('/api/projects/:id/rule-sets', projectRuleSetsLinkHandler);
app.delete('/api/projects/:id/rule-sets/:ruleSetId', projectRuleSetsUnlinkHandler);
app.get('/api/projects/:id/effective-rules', projectEffectiveRulesHandler);
app.post('/api/projects/:id/issues/analyze', projectIssuesAnalyzeHandler);
app.get('/api/projects/:id/issues/analyze/:jobId', projectIssuesAnalyzeStatusHandler);
app.post('/api/projects/:id/issues/analyze/:jobId/consume', projectIssuesAnalyzeConsumeHandler);
app.route('/api/ai/providers', aiProvidersListHandler);
app.route('/api/admin/ai', adminAiRoutes);
app.route('/api/admin/config', adminConfigRoutes);

/**
 * Rules API routes
 */
app.get('/api/rules', rulesListHandler);
app.post('/api/rules', rulesCreateHandler);
app.post('/api/rules/ai', rulesAiCreateHandler);
app.post('/api/rules/ai/duplicates', rulesAiDuplicatesHandler);
app.get('/api/rules/:id', ruleGetHandler);
app.patch('/api/rules/:id', ruleUpdateHandler);
app.delete('/api/rules/:id', ruleDeleteHandler);

/**
 * Rule Sets API routes
 */
app.get('/api/rule-sets', ruleSetsListHandler);
app.post('/api/rule-sets', ruleSetsCreateHandler);
app.get('/api/rule-sets/:id', ruleSetGetHandler);
app.patch('/api/rule-sets/:id', ruleSetUpdateHandler);
app.delete('/api/rule-sets/:id', ruleSetDeleteHandler);
app.get('/api/rule-sets/:id/rules', ruleSetRulesListHandler);
app.post('/api/rule-sets/:id/rules', ruleSetRulesLinkHandler);
app.delete('/api/rule-sets/:id/rules/:ruleId', ruleSetRulesUnlinkHandler);

/**
 * Issues API routes
 */
app.route('/api/issues', issuesRoutes);

/**
 * Access Control API routes (protected by auth middleware above)
 */
app.route('/api/access-control', accessControlRoutes);

/**
 * User Settings API routes (protected by auth middleware above)
 */
app.route('/api/me/settings', meSettingsGetHandler);
app.route('/api/me/settings', meSettingsPatchHandler);
app.route('/api/me/settings', meSettingsPutHandler);

/**
 * Theme Registry API routes (protected by auth middleware above)
 */
app.route('/api/themes', themesListHandler);
app.route('/api/themes', themeGetHandler);
app.patch('/api/themes/:id', themeUpdateHandler);

app.get('*', async (c) => {
  return c.json({
    message: 'Wenyan Server API',
    version: '0.2.0',
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    note: 'UI removed. API-only runtime.',
  });
});

/**
 * 404 handler
 */
app.notFound((c) => {
  return c.json({
    error: {
      message: 'Endpoint not found',
      requestId: c.get('requestId'),
    },
    timestamp: new Date().toISOString(),
  }, 404);
});

/**
 * Error handler (fallback)
 */
app.onError((err, c) => {
  const requestId = c.get('requestId');
  const isDev = c.env.ENVIRONMENT === 'development';
  
  return c.json({
    error: {
      message: err.message,
      ...(isDev && { stack: err.stack }),
      requestId,
    },
    timestamp: new Date().toISOString(),
  }, 500);
});

export { app };

export default {
  fetch: app.fetch,
};
