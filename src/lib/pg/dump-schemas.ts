import { z } from 'zod'

export const dumpExportOptionsSchema = z
  .object({
    schemaOnly: z.boolean().default(false),
    dataOnly: z.boolean().default(false),
    noOwner: z.boolean().default(true),
    noPrivileges: z.boolean().default(true),
  })
  .refine((value) => !(value.schemaOnly && value.dataOnly), {
    message: 'Choose either schema only or data only, not both',
    path: ['schemaOnly'],
  })

export const dumpImportOptionsSchema = z.object({
  singleTransaction: z.boolean().default(true),
  onErrorStop: z.boolean().default(true),
})

export const exportDatabaseDumpSchema = z.object({
  connectionId: z.string().uuid(),
  database: z.string().min(1),
  options: dumpExportOptionsSchema.default({
    schemaOnly: false,
    dataOnly: false,
    noOwner: true,
    noPrivileges: true,
  }),
})

const MAX_IMPORT_BYTES = 50 * 1024 * 1024

export const importDatabaseDumpSchema = z.object({
  connectionId: z.string().uuid(),
  database: z.string().min(1),
  sql: z
    .string()
    .min(1, 'SQL dump is empty')
    .max(
      MAX_IMPORT_BYTES,
      `SQL dump must be ${MAX_IMPORT_BYTES / (1024 * 1024)} MB or smaller`,
    ),
  options: dumpImportOptionsSchema.default({
    singleTransaction: true,
    onErrorStop: true,
  }),
})
