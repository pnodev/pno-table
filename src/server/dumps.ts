import { createServerFn } from '@tanstack/react-start'

import {
  exportDatabaseDumpSchema,
  importDatabaseDumpSchema,
} from '#/lib/pg/dump-schemas'
import {
  dumpFilename,
  exportDatabaseDump,
  importDatabaseDump,
} from '#/lib/pg/dump'
import { resolveConnection } from '#/lib/pg/resolve-connection'

function assertWritable(readOnly: boolean) {
  if (readOnly) {
    throw new Error('This connection is read-only')
  }
}

export const exportServerDatabaseDump = createServerFn({ method: 'POST' })
  .validator((data) => exportDatabaseDumpSchema.parse(data))
  .handler(async ({ data }) => {
    const resolved = await resolveConnection(data.connectionId)
    const sql = await exportDatabaseDump(
      resolved.config,
      data.database,
      data.options,
    )

    return {
      sql,
      filename: dumpFilename(data.database),
    }
  })

export const importServerDatabaseDump = createServerFn({ method: 'POST' })
  .validator((data) => importDatabaseDumpSchema.parse(data))
  .handler(async ({ data }) => {
    const resolved = await resolveConnection(data.connectionId)
    assertWritable(resolved.profile.readOnly)

    await importDatabaseDump(
      resolved.config,
      data.database,
      data.sql,
      data.options,
    )

    return { success: true as const }
  })
