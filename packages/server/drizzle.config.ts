import type { Config } from 'drizzle-kit'

const config: Config = {
  schema: './src/auth/schema.ts',
  out: './database/migrations',
  driver: 'd1',
  dbCredentials: {
    wranglerConfigPath: './wrangler.toml',
    dbName: 'harmonia-db',
  },
}

export default config
