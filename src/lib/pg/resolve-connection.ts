import { eq } from 'drizzle-orm'
import type pg from 'pg'

import { db } from '#/db/index'
import { connections } from '#/db/schema'
import { decryptSecret } from '#/lib/crypto'
import { toConnectionProfile } from '#/lib/connections/mapper'
import type {
  ConnectionProfile,
  PostgresConnectionConfig,
} from '#/lib/connections/types'
import { createPgClient } from '#/lib/pg/client'
import { formatConnectionError } from '#/lib/pg/format-error'

export type ResolvedConnection = {
  profile: ConnectionProfile
  config: PostgresConnectionConfig
}

function isDatabaseConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const code = 'code' in error ? String(error.code) : ''

  return code === '42501' || code === '3D000' || code === '28000'
}

function connectDatabaseCandidates(
  config: PostgresConnectionConfig,
  preferred: string,
): string[] {
  return [
    ...new Set([
      preferred,
      config.defaultDatabase,
      config.username,
      'postgres',
    ]),
  ]
}

export async function connectPgClient(
  config: PostgresConnectionConfig,
  preferredDatabase: string,
  options?: { allowFallback?: boolean },
): Promise<{ client: pg.Client; database: string }> {
  const candidates = options?.allowFallback
    ? connectDatabaseCandidates(config, preferredDatabase)
    : [preferredDatabase]
  let lastError: unknown

  for (const candidate of candidates) {
    const client = createPgClient(config, candidate)

    try {
      await client.connect()
      return { client, database: candidate }
    } catch (error) {
      lastError = error
      await client.end().catch(() => undefined)

      if (!options?.allowFallback || !isDatabaseConnectionError(error)) {
        throw new Error(formatConnectionError(error))
      }
    }
  }

  throw new Error(
    lastError instanceof Error
      ? formatConnectionError(lastError)
      : `Cannot connect to database "${preferredDatabase}"`,
  )
}

export async function resolveConnection(
  connectionId: string,
): Promise<ResolvedConnection> {
  const row = await db.query.connections.findFirst({
    where: eq(connections.id, connectionId),
  })

  if (!row) {
    throw new Error('Connection not found')
  }

  const profile = toConnectionProfile(row)
  const password = decryptSecret(row.passwordEncrypted)

  return {
    profile,
    config: {
      host: profile.host,
      port: profile.port,
      username: profile.username,
      password,
      defaultDatabase: profile.defaultDatabase,
      sslMode: profile.sslMode,
    },
  }
}

export async function withPgClient<T>(
  connectionId: string,
  database: string,
  fn: (client: pg.Client, resolved: ResolvedConnection) => Promise<T>,
  options?: { allowFallback?: boolean },
): Promise<T> {
  const resolved = await resolveConnection(connectionId)
  const { client } = await connectPgClient(
    resolved.config,
    database,
    options,
  )

  try {
    return await fn(client, resolved)
  } finally {
    await client.end().catch(() => undefined)
  }
}
