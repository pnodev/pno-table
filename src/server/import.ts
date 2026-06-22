import { createServerFn } from '@tanstack/react-start'

import { parseConnectionString } from '#/lib/connections/parse-connection-string'
import {
  buildImportPreview,
  findImportCollisions,
  listImportCatalog,
  pipePgDumpToPsql,
} from '#/lib/pg/import'
import {
  endImportSessionSchema,
  importSessionIdSchema,
  listImportSourceCatalogSchema,
  previewImportSchema,
  runImportSchema,
  setImportSourceDatabaseSchema,
  startImportSessionSchema,
} from '#/lib/pg/import-schemas'
import {
  createImportSession,
  endImportSession,
  getImportSession,
  setImportSessionDatabase,
  touchImportSession,
} from '#/lib/pg/import-session'
import { listDatabases } from '#/lib/pg/introspect'
import { connectPgClient, resolveConnection } from '#/lib/pg/resolve-connection'
import { testPostgresConnection } from '#/lib/pg/test-connection'

function assertWritable(readOnly: boolean) {
  if (readOnly) {
    throw new Error('This connection is read-only')
  }
}

function requireImportSession(sessionId: string) {
  const session = getImportSession(sessionId)

  if (!session) {
    throw new Error('Import session expired or not found. Start again from step 1.')
  }

  touchImportSession(sessionId)
  return session
}

function requireSourceDatabase(sessionId: string) {
  const session = requireImportSession(sessionId)

  if (!session.sourceDatabase) {
    throw new Error('Select a source database first')
  }

  return {
    config: session.config,
    sourceDatabase: session.sourceDatabase,
  }
}

export const startImportSession = createServerFn({ method: 'POST' })
  .validator((data) => startImportSessionSchema.parse(data))
  .handler(async ({ data }) => {
    const parsed = parseConnectionString(data.connectionString)

    if (!parsed.ok) {
      throw new Error(parsed.error)
    }

    const testResult = await testPostgresConnection(parsed.value)

    if (!testResult.ok) {
      throw new Error(testResult.error)
    }

    const sessionId = createImportSession(
      parsed.value,
      testResult.database,
    )

    let databases: { name: string }[] = []

    try {
      const { client } = await connectPgClient(parsed.value, 'postgres', {
        allowFallback: true,
      })

      try {
        databases = await listDatabases(client)
      } finally {
        await client.end().catch(() => undefined)
      }
    } catch {
      databases = [{ name: testResult.database }]
    }

    return {
      sessionId,
      testResult,
      sourceDatabase: testResult.database,
      databases: databases.map((database) => database.name),
      poolerWarning: buildImportPreview(parsed.value.host, []).poolerWarning,
    }
  })

export const listImportSourceDatabases = createServerFn({ method: 'POST' })
  .validator((data) => importSessionIdSchema.parse(data))
  .handler(async ({ data }) => {
    const session = requireImportSession(data.sessionId)
    const { client } = await connectPgClient(session.config, 'postgres', {
      allowFallback: true,
    })

    try {
      const databases = await listDatabases(client)
      return databases.map((database) => database.name)
    } finally {
      await client.end().catch(() => undefined)
    }
  })

export const setImportSourceDatabase = createServerFn({ method: 'POST' })
  .validator((data) => setImportSourceDatabaseSchema.parse(data))
  .handler(async ({ data }) => {
    const session = requireImportSession(data.sessionId)
    const testResult = await testPostgresConnection({
      ...session.config,
      defaultDatabase: data.database,
    })

    if (!testResult.ok) {
      throw new Error(testResult.error)
    }

    const updated = setImportSessionDatabase(data.sessionId, data.database)

    if (!updated) {
      throw new Error('Import session expired or not found. Start again from step 1.')
    }

    return {
      sourceDatabase: data.database,
      testResult,
    }
  })

export const listImportSourceCatalog = createServerFn({ method: 'POST' })
  .validator((data) => listImportSourceCatalogSchema.parse(data))
  .handler(async ({ data }) => {
    const { config, sourceDatabase } = requireSourceDatabase(data.sessionId)
    const { client } = await connectPgClient(config, sourceDatabase)

    try {
      return listImportCatalog(client)
    } finally {
      await client.end().catch(() => undefined)
    }
  })

export const previewImport = createServerFn({ method: 'POST' })
  .validator((data) => previewImportSchema.parse(data))
  .handler(async ({ data }) => {
    const { config, sourceDatabase } = requireSourceDatabase(data.sessionId)
    const resolved = await resolveConnection(data.connectionId)

    if (data.options.conflictMode === 'fail') {
      const { client } = await connectPgClient(
        resolved.config,
        data.targetDatabase,
      )

      try {
        const collisions = await findImportCollisions(client, data.selection)

        return buildImportPreview(config.host, collisions)
      } finally {
        await client.end().catch(() => undefined)
      }
    }

    return buildImportPreview(config.host, [])
  })

export const runDatabaseImport = createServerFn({ method: 'POST' })
  .validator((data) => runImportSchema.parse(data))
  .handler(async ({ data }) => {
    const { config, sourceDatabase } = requireSourceDatabase(data.sessionId)
    const resolved = await resolveConnection(data.connectionId)

    assertWritable(resolved.profile.readOnly)

    if (data.options.conflictMode === 'fail') {
      const { client } = await connectPgClient(
        resolved.config,
        data.targetDatabase,
      )

      try {
        const collisions = await findImportCollisions(client, data.selection)

        if (collisions.length > 0) {
          throw new Error(
            `Import blocked: ${collisions.join('; ')}. Choose an empty target, narrow the selection, or use replace mode.`,
          )
        }
      } finally {
        await client.end().catch(() => undefined)
      }
    }

    await pipePgDumpToPsql(
      config,
      sourceDatabase,
      resolved.config,
      data.targetDatabase,
      data.selection,
      data.options,
    )

    endImportSession(data.sessionId)

    return {
      success: true as const,
      sourceDatabase,
      targetDatabase: data.targetDatabase,
    }
  })

export const endImportSessionFn = createServerFn({ method: 'POST' })
  .validator((data) => endImportSessionSchema.parse(data))
  .handler(async ({ data }) => {
    endImportSession(data.sessionId)
    return { success: true as const }
  })
