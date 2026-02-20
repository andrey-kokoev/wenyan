import { InMemoryArchiveRepository, type ArchiveRepository } from './index'
import { SqliteArchiveRepository } from './sqlite'
import { CloudflareArchiveRepository, type D1DatabaseLike } from './cloudflare'

export interface StorageAdapter {
  readonly kind: string
  createRepository(): ArchiveRepository | Promise<ArchiveRepository>
}

export class SqliteStorageAdapter implements StorageAdapter {
  readonly kind = 'sqlite'

  constructor(private readonly path: string, private readonly retentionDays = 3650) {}

  createRepository(): ArchiveRepository {
    const repo = new SqliteArchiveRepository(this.path, { retentionDays: this.retentionDays })
    repo.initialize()
    repo.migrate()
    return repo
  }
}

export class CloudflareStorageAdapter implements StorageAdapter {
  readonly kind = 'cloudflare'

  constructor(private readonly db: D1DatabaseLike, private readonly retentionDays = 3650) {}

  async createRepository(): Promise<ArchiveRepository> {
    const repo = new CloudflareArchiveRepository(this.db, { retentionDays: this.retentionDays })
    await repo.initialize()
    await repo.migrate()
    return repo
  }
}

export class InMemoryStorageAdapter implements StorageAdapter {
  readonly kind = 'memory'

  createRepository(): ArchiveRepository {
    return new InMemoryArchiveRepository()
  }
}

export type StorageAdapterKind = 'sqlite' | 'cloudflare' | 'memory'

export interface StorageAdapterFactoryOptions {
  kind: StorageAdapterKind
  sqlitePath?: string
  retentionDays?: number
  d1?: D1DatabaseLike
}

export function createStorageAdapter(options: StorageAdapterFactoryOptions): StorageAdapter {
  switch (options.kind) {
    case 'sqlite':
      return new SqliteStorageAdapter(options.sqlitePath ?? "./wenyan.dang'an", options.retentionDays ?? 3650)
    case 'cloudflare':
      if (!options.d1) throw new Error('cloudflare adapter requires d1 binding')
      return new CloudflareStorageAdapter(options.d1, options.retentionDays ?? 3650)
    case 'memory':
      return new InMemoryStorageAdapter()
    default:
      throw new Error(`unsupported storage adapter: ${(options as { kind: string }).kind}`)
  }
}
