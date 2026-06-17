import pg from 'pg'

import type {
  ConnectionTestResult,
  PostgresConnectionConfig,
} from '#/lib/connections/types'
import { formatConnectionError } from '#/lib/pg/format-error'

function sslConfig(sslMode: PostgresConnectionConfig['sslMode']) {
  if (sslMode === 'disable') {
    return false
  }

  if (sslMode === 'require') {
    return { rejectUnauthorized: false }
  }

  return undefined
}

export async function testPostgresConnection(
  config: PostgresConnectionConfig,
): Promise<ConnectionTestResult> {
  const client = new pg.Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.defaultDatabase,
    ssl: sslConfig(config.sslMode),
    connectionTimeoutMillis: 5_000,
    query_timeout: 5_000,
  })

  const startedAt = Date.now()

  try {
    await client.connect()
    const result = await client.query<{
      version: string
      database: string
    }>(
      'select version() as version, current_database() as database',
    )

    return {
      ok: true,
      version: result.rows[0]?.version ?? 'Unknown',
      database: result.rows[0]?.database ?? config.defaultDatabase,
      latencyMs: Date.now() - startedAt,
    }
  } catch (error) {
    return {
      ok: false,
      error: formatConnectionError(error),
    }
  } finally {
    await client.end().catch(() => undefined)
  }
}
