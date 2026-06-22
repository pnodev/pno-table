import { z } from 'zod'

import { dumpExportOptionsSchema } from '#/lib/pg/dump-schemas'

export const importTableRefSchema = z.object({
  schema: z.string().min(1),
  name: z.string().min(1),
})

export const importSelectionSchema = z
  .object({
    mode: z.enum(['database', 'schemas', 'tables']),
    schemas: z.array(z.string().min(1)).default([]),
    tables: z.array(importTableRefSchema).default([]),
  })
  .superRefine((value, context) => {
    if (value.mode === 'schemas' && value.schemas.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Select at least one schema',
        path: ['schemas'],
      })
    }

    if (value.mode === 'tables' && value.tables.length === 0) {
      context.addIssue({
        code: 'custom',
        message: 'Select at least one table',
        path: ['tables'],
      })
    }
  })

export const importRunOptionsSchema = dumpExportOptionsSchema.and(
  z.object({
    singleTransaction: z.boolean().default(true),
    onErrorStop: z.boolean().default(true),
    conflictMode: z.enum(['fail', 'replace']).default('fail'),
  }),
)

export const startImportSessionSchema = z.object({
  connectionString: z.string().min(1, 'Connection string is required'),
})

export const importSessionIdSchema = z.object({
  sessionId: z.string().uuid(),
})

export const endImportSessionSchema = importSessionIdSchema

export const setImportSourceDatabaseSchema = importSessionIdSchema.extend({
  database: z.string().min(1),
})

export const listImportSourceCatalogSchema = importSessionIdSchema

export const previewImportSchema = importSessionIdSchema.extend({
  connectionId: z.string().uuid(),
  targetDatabase: z.string().min(1),
  selection: importSelectionSchema,
  options: importRunOptionsSchema.default({
    schemaOnly: false,
    dataOnly: false,
    noOwner: true,
    noPrivileges: true,
    singleTransaction: true,
    onErrorStop: true,
    conflictMode: 'fail',
  }),
})

export const runImportSchema = previewImportSchema

export type ImportSelection = z.infer<typeof importSelectionSchema>
export type ImportRunOptions = z.infer<typeof importRunOptionsSchema>
export type ImportTableRef = z.infer<typeof importTableRefSchema>
