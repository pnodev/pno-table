import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import type { BrowseTableResult } from '#/lib/pg/catalog-types'
import {
  assertAllowedColumns,
  parseRowValues,
} from '#/lib/pg/cell-values'
import {
  browseTableRows,
  buildLinkableRelations,
  countTableRows,
  deleteTableRow,
  getTableStructure,
  insertTableRow,
  listForeignKeyOptions,
  listDatabases,
  listRelations,
  listSchemas,
  resolveRelationLabelsForRows,
  updateTableRow,
} from '#/lib/pg/introspect'
import { withPgClient, resolveConnection } from '#/lib/pg/resolve-connection'

const connectionIdSchema = z.object({
  connectionId: z.string().uuid(),
})

const databaseSchema = connectionIdSchema.extend({
  database: z.string().min(1),
})

const schemaSchema = databaseSchema.extend({
  schema: z.string().min(1),
})

const tableSchema = schemaSchema.extend({
  table: z.string().min(1),
})

const browseSchema = tableSchema.extend({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  sortColumn: z.string().nullable().default(null),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
  filterColumn: z.string().nullable().optional(),
  filterValue: z.string().nullable().optional(),
})

const deleteRowSchema = tableSchema.extend({
  primaryKey: z.record(z.string(), z.unknown()),
})

const rowValuesSchema = tableSchema.extend({
  values: z.record(z.string(), z.string()),
})

const updateRowSchema = rowValuesSchema.extend({
  primaryKey: z.record(z.string(), z.unknown()),
})

const relationColumnMappingSchema = z.object({
  column: z.string().min(1),
  referencedColumn: z.string().min(1),
})

const foreignKeyOptionsSchema = tableSchema.extend({
  referencedSchema: z.string().min(1),
  referencedTable: z.string().min(1),
  columns: z.array(relationColumnMappingSchema).min(1),
  activeColumn: z.string().min(1),
  search: z.string().optional(),
  selectedValues: z.record(z.string(), z.string()).optional(),
  filterValues: z.record(z.string(), z.string()).optional(),
})

function assertWritable(readOnly: boolean) {
  if (readOnly) {
    throw new Error('This connection is read-only')
  }
}

export const fetchDatabases = createServerFn({ method: 'GET' })
  .validator((data) => connectionIdSchema.parse(data))
  .handler(async ({ data }) => {
    const resolved = await resolveConnection(data.connectionId)

    return withPgClient(
      data.connectionId,
      resolved.profile.defaultDatabase,
      async (client) => listDatabases(client),
    )
  })

export const fetchSchemas = createServerFn({ method: 'GET' })
  .validator((data) => databaseSchema.parse(data))
  .handler(async ({ data }) => {
    return withPgClient(data.connectionId, data.database, async (client) => {
      return listSchemas(client, data.database)
    })
  })

export const fetchRelations = createServerFn({ method: 'GET' })
  .validator((data) => schemaSchema.parse(data))
  .handler(async ({ data }) => {
    return withPgClient(data.connectionId, data.database, async (client) => {
      return listRelations(client, data.schema)
    })
  })

export const fetchTableStructure = createServerFn({ method: 'GET' })
  .validator((data) => tableSchema.parse(data))
  .handler(async ({ data }) => {
    return withPgClient(data.connectionId, data.database, async (client) => {
      return getTableStructure(client, data.schema, data.table)
    })
  })

export const fetchTableBrowse = createServerFn({ method: 'GET' })
  .validator((data) => browseSchema.parse(data))
  .handler(async ({ data }): Promise<BrowseTableResult> => {
    return withPgClient(data.connectionId, data.database, async (client) => {
      const structure = await getTableStructure(client, data.schema, data.table)
      const allowedColumns = structure.columns.map((column) => column.name)
      const filterColumn = data.filterColumn ?? null
      const filterValue = data.filterValue ?? null

      const [totalRows, browse] = await Promise.all([
        countTableRows(client, data.schema, data.table, {
          filterColumn,
          filterValue,
          allowedColumns,
        }),
        browseTableRows(client, data.schema, data.table, {
          page: data.page,
          pageSize: data.pageSize,
          sortColumn: data.sortColumn,
          sortDirection: data.sortDirection,
          allowedColumns,
          filterColumn,
          filterValue,
        }),
      ])

      const columnTypes = new Map(
        structure.columns.map((column) => [column.name, column.dataType]),
      )

      const relationLabels = await resolveRelationLabelsForRows(
        client,
        structure.columns,
        data.schema,
        structure.foreignKeys,
        browse.rows,
      )

      const linkableRelations = await buildLinkableRelations(
        client,
        structure.columns,
        data.schema,
        structure.foreignKeys,
      )

      return {
        columns: browse.columns.map((name) => ({
          name,
          dataType: columnTypes.get(name) ?? 'unknown',
        })),
        rows: browse.rows,
        totalRows,
        page: data.page,
        pageSize: data.pageSize,
        sortColumn: data.sortColumn,
        sortDirection: data.sortDirection,
        filterColumn,
        filterValue,
        relationLabels,
        linkableRelations,
      }
    })
  })

export const fetchForeignKeyOptions = createServerFn({ method: 'GET' })
  .validator((data) => foreignKeyOptionsSchema.parse(data))
  .handler(async ({ data }) => {
    return withPgClient(data.connectionId, data.database, async (client) => {
      return listForeignKeyOptions(client, {
        referencedSchema: data.referencedSchema,
        referencedTable: data.referencedTable,
        columns: data.columns,
        activeColumn: data.activeColumn,
        search: data.search,
        selectedValues: data.selectedValues,
        filterValues: data.filterValues,
      })
    })
  })

export const removeTableRow = createServerFn({ method: 'POST' })
  .validator((data) => deleteRowSchema.parse(data))
  .handler(async ({ data }) => {
    return withPgClient(
      data.connectionId,
      data.database,
      async (client, resolved) => {
        assertWritable(resolved.profile.readOnly)

        const structure = await getTableStructure(
          client,
          data.schema,
          data.table,
        )

        await deleteTableRow(
          client,
          data.schema,
          data.table,
          data.primaryKey,
          structure.primaryKeyColumns,
        )

        return { success: true as const }
      },
    )
  })

export const createTableRow = createServerFn({ method: 'POST' })
  .validator((data) => rowValuesSchema.parse(data))
  .handler(async ({ data }) => {
    return withPgClient(
      data.connectionId,
      data.database,
      async (client, resolved) => {
        assertWritable(resolved.profile.readOnly)

        const structure = await getTableStructure(
          client,
          data.schema,
          data.table,
        )
        const allowedColumns = structure.columns.map((column) => column.name)
        const values = parseRowValues(data.values, structure.columns, 'insert')

        assertAllowedColumns(values, allowedColumns)

        await insertTableRow(
          client,
          data.schema,
          data.table,
          values,
          allowedColumns,
        )

        return { success: true as const }
      },
    )
  })

export const saveTableRow = createServerFn({ method: 'POST' })
  .validator((data) => updateRowSchema.parse(data))
  .handler(async ({ data }) => {
    return withPgClient(
      data.connectionId,
      data.database,
      async (client, resolved) => {
        assertWritable(resolved.profile.readOnly)

        const structure = await getTableStructure(
          client,
          data.schema,
          data.table,
        )
        const allowedColumns = structure.columns.map((column) => column.name)
        const values = parseRowValues(data.values, structure.columns, 'update')

        assertAllowedColumns(values, allowedColumns)

        await updateTableRow(
          client,
          data.schema,
          data.table,
          data.primaryKey,
          structure.primaryKeyColumns,
          values,
          allowedColumns,
        )

        return { success: true as const }
      },
    )
  })
