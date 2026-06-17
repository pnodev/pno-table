import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { db } from '#/db/index'
import { connections } from '#/db/schema'
import { decryptSecret, encryptSecret } from '#/lib/crypto'
import { toConnectionProfile } from '#/lib/connections/mapper'
import {
  connectionInputSchema,
  connectionUpdateSchema,
} from '#/lib/connections/schemas'
import type {
  ConnectionProfile,
  ConnectionTestResult,
  PostgresConnectionConfig,
} from '#/lib/connections/types'
import { testPostgresConnection } from '#/lib/pg/test-connection'

function toPostgresConfig(
  profile: ConnectionProfile,
  password: string,
): PostgresConnectionConfig {
  return {
    host: profile.host,
    port: profile.port,
    username: profile.username,
    password,
    defaultDatabase: profile.defaultDatabase,
    sslMode: profile.sslMode,
  }
}

export const listConnections = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ConnectionProfile[]> => {
    const rows = await db.query.connections.findMany({
      orderBy: (table, { desc }) => [desc(table.updatedAt)],
    })

    return rows.map(toConnectionProfile)
  },
)

export const getConnection = createServerFn({ method: 'GET' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<ConnectionProfile | null> => {
    const row = await db.query.connections.findFirst({
      where: eq(connections.id, data.id),
    })

    return row ? toConnectionProfile(row) : null
  })

export const createConnection = createServerFn({ method: 'POST' })
  .validator((data) => connectionInputSchema.parse(data))
  .handler(async ({ data }): Promise<ConnectionProfile> => {
    const now = new Date()
    const id = randomUUID()

    const [row] = await db
      .insert(connections)
      .values({
        id,
        name: data.name,
        host: data.host,
        port: data.port,
        username: data.username,
        passwordEncrypted: encryptSecret(data.password),
        defaultDatabase: data.defaultDatabase,
        sslMode: data.sslMode,
        readOnly: data.readOnly,
        createdAt: now,
        updatedAt: now,
      })
      .returning()

    return toConnectionProfile(row)
  })

export const updateConnection = createServerFn({ method: 'POST' })
  .validator((data: { id: string; values: unknown }) => ({
    id: data.id,
    values: connectionUpdateSchema.parse(data.values),
  }))
  .handler(async ({ data }): Promise<ConnectionProfile> => {
    const existing = await db.query.connections.findFirst({
      where: eq(connections.id, data.id),
    })

    if (!existing) {
      throw new Error('Connection not found')
    }

    const [row] = await db
      .update(connections)
      .set({
        name: data.values.name,
        host: data.values.host,
        port: data.values.port,
        username: data.values.username,
        defaultDatabase: data.values.defaultDatabase,
        sslMode: data.values.sslMode,
        readOnly: data.values.readOnly,
        ...(data.values.password
          ? { passwordEncrypted: encryptSecret(data.values.password) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(connections.id, data.id))
      .returning()

    return toConnectionProfile(row)
  })

export const deleteConnection = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<{ success: true }> => {
    await db.delete(connections).where(eq(connections.id, data.id))
    return { success: true }
  })

export const testConnectionDraft = createServerFn({ method: 'POST' })
  .validator((data) => connectionInputSchema.parse(data))
  .handler(async ({ data }): Promise<ConnectionTestResult> => {
    return testPostgresConnection({
      host: data.host,
      port: data.port,
      username: data.username,
      password: data.password,
      defaultDatabase: data.defaultDatabase,
      sslMode: data.sslMode,
    })
  })

export const testSavedConnection = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }): Promise<ConnectionTestResult> => {
    const row = await db.query.connections.findFirst({
      where: eq(connections.id, data.id),
    })

    if (!row) {
      return { ok: false, error: 'Connection not found' }
    }

    const profile = toConnectionProfile(row)
    const password = decryptSecret(row.passwordEncrypted)

    return testPostgresConnection(toPostgresConfig(profile, password))
  })
