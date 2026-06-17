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

export type ResolvedConnection = {
  profile: ConnectionProfile
  config: PostgresConnectionConfig
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
): Promise<T> {
  const resolved = await resolveConnection(connectionId)
  const client = createPgClient(resolved.config, database)

  try {
    await client.connect()
    return await fn(client, resolved)
  } finally {
    await client.end().catch(() => undefined)
  }
}
