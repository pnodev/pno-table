import pg from 'pg'

import type { PostgresConnectionConfig } from '#/lib/connections/types'

function sslConfig(sslMode: PostgresConnectionConfig['sslMode']) {
  if (sslMode === 'disable') {
    return false
  }

  if (sslMode === 'require') {
    return { rejectUnauthorized: false }
  }

  return undefined
}

export function createPgClient(
  config: PostgresConnectionConfig,
  database?: string,
): pg.Client {
  return new pg.Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: database ?? config.defaultDatabase,
    ssl: sslConfig(config.sslMode),
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
  })
}
