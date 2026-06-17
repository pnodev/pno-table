import type pg from 'pg'

import type {
  ColumnInfo,
  DatabaseNode,
  ForeignKeyInfo,
  IndexInfo,
  RelationNode,
  SchemaNode,
  TableStructure,
} from '#/lib/pg/catalog-types'
import { quoteIdentifier, quoteQualifiedName } from '#/lib/pg/identifiers'

export async function listDatabases(client: pg.Client): Promise<DatabaseNode[]> {
  const result = await client.query<{ name: string }>(`
    select datname as name
    from pg_catalog.pg_database
    where datallowconn
      and not datistemplate
    order by datname
  `)

  return result.rows
}

export async function listSchemas(
  client: pg.Client,
  database: string,
): Promise<SchemaNode[]> {
  const result = await client.query<{ name: string }>(
    `
      select schema_name as name
      from information_schema.schemata
      where catalog_name = $1
        and schema_name not like 'pg\\_%' escape '\\'
        and schema_name <> 'information_schema'
      order by schema_name
    `,
    [database],
  )

  return result.rows
}

export async function listRelations(
  client: pg.Client,
  schema: string,
): Promise<RelationNode[]> {
  const result = await client.query<{ name: string; kind: 'table' | 'view' }>(
    `
      select
        table_name as name,
        case table_type
          when 'VIEW' then 'view'
          else 'table'
        end as kind
      from information_schema.tables
      where table_schema = $1
        and table_type in ('BASE TABLE', 'VIEW')
      order by table_name
    `,
    [schema],
  )

  return result.rows
}

export async function getTableStructure(
  client: pg.Client,
  schema: string,
  table: string,
): Promise<TableStructure> {
  const columnsResult = await client.query<{
    name: string
    data_type: string
    is_nullable: string
    column_default: string | null
    is_primary_key: boolean
    is_foreign_key: boolean
  }>(
    `
      select
        c.column_name as name,
        c.data_type as data_type,
        c.is_nullable,
        c.column_default,
        coalesce(pk.is_primary_key, false) as is_primary_key,
        coalesce(fk.is_foreign_key, false) as is_foreign_key
      from information_schema.columns c
      left join lateral (
        select true as is_primary_key
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
         and tc.table_schema = kcu.table_schema
        where tc.constraint_type = 'PRIMARY KEY'
          and tc.table_schema = c.table_schema
          and tc.table_name = c.table_name
          and kcu.column_name = c.column_name
        limit 1
      ) pk on true
      left join lateral (
        select true as is_foreign_key
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
         and tc.table_schema = kcu.table_schema
        where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_schema = c.table_schema
          and tc.table_name = c.table_name
          and kcu.column_name = c.column_name
        limit 1
      ) fk on true
      where c.table_schema = $1
        and c.table_name = $2
      order by c.ordinal_position
    `,
    [schema, table],
  )

  const indexesResult = await client.query<{
    name: string
    definition: string
    is_unique: boolean
    is_primary: boolean
  }>(
    `
      select
        i.relname as name,
        pg_get_indexdef(ix.indexrelid) as definition,
        ix.indisunique as is_unique,
        ix.indisprimary as is_primary
      from pg_class t
      join pg_namespace n on n.oid = t.relnamespace
      join pg_index ix on t.oid = ix.indrelid
      join pg_class i on i.oid = ix.indexrelid
      where n.nspname = $1
        and t.relname = $2
      order by i.relname
    `,
    [schema, table],
  )

  const foreignKeysResult = await client.query<{
    name: string
    column: string
    referenced_schema: string
    referenced_table: string
    referenced_column: string
  }>(
    `
      select
        tc.constraint_name as name,
        kcu.column_name as column,
        ccu.table_schema as referenced_schema,
        ccu.table_name as referenced_table,
        ccu.column_name as referenced_column
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name
       and tc.table_schema = kcu.table_schema
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_name = tc.constraint_name
       and ccu.table_schema = tc.table_schema
      where tc.constraint_type = 'FOREIGN KEY'
        and tc.table_schema = $1
        and tc.table_name = $2
      order by tc.constraint_name, kcu.ordinal_position
    `,
    [schema, table],
  )

  const columns: ColumnInfo[] = columnsResult.rows.map((row) => ({
    name: row.name,
    dataType: row.data_type,
    isNullable: row.is_nullable === 'YES',
    defaultValue: row.column_default,
    isPrimaryKey: row.is_primary_key,
    isForeignKey: row.is_foreign_key,
  }))

  const indexes: IndexInfo[] = indexesResult.rows.map((row) => ({
    name: row.name,
    definition: row.definition,
    isUnique: row.is_unique,
    isPrimary: row.is_primary,
  }))

  const foreignKeys: ForeignKeyInfo[] = foreignKeysResult.rows.map((row) => ({
    name: row.name,
    column: row.column,
    referencedSchema: row.referenced_schema,
    referencedTable: row.referenced_table,
    referencedColumn: row.referenced_column,
  }))

  return {
    columns,
    indexes,
    foreignKeys,
    primaryKeyColumns: columns
      .filter((column) => column.isPrimaryKey)
      .map((column) => column.name),
  }
}

export async function countTableRows(
  client: pg.Client,
  schema: string,
  table: string,
): Promise<number> {
  const qualified = quoteQualifiedName(schema, table)
  const result = await client.query<{ count: string }>(
    `select count(*)::text as count from ${qualified}`,
  )

  return Number(result.rows[0]?.count ?? 0)
}

export async function browseTableRows(
  client: pg.Client,
  schema: string,
  table: string,
  options: {
    page: number
    pageSize: number
    sortColumn: string | null
    sortDirection: 'asc' | 'desc'
    allowedColumns: string[]
  },
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  const qualified = quoteQualifiedName(schema, table)
  const offset = (options.page - 1) * options.pageSize

  let orderBy = ''
  if (
    options.sortColumn &&
    options.allowedColumns.includes(options.sortColumn)
  ) {
    orderBy = `order by ${quoteIdentifier(options.sortColumn)} ${options.sortDirection === 'desc' ? 'desc' : 'asc'}`
  }

  const result = await client.query(
    `select * from ${qualified} ${orderBy} limit $1 offset $2`,
    [options.pageSize, offset],
  )

  return {
    rows: result.rows as Record<string, unknown>[],
    columns: result.fields.map((field) => field.name),
  }
}

export async function deleteTableRow(
  client: pg.Client,
  schema: string,
  table: string,
  primaryKey: Record<string, unknown>,
  primaryKeyColumns: string[],
): Promise<void> {
  if (primaryKeyColumns.length === 0) {
    throw new Error('Cannot delete rows from a table without a primary key')
  }

  const qualified = quoteQualifiedName(schema, table)
  const conditions = primaryKeyColumns.map(
    (column, index) => `${quoteIdentifier(column)} = $${index + 1}`,
  )
  const values = primaryKeyColumns.map((column) => primaryKey[column])

  if (values.some((value) => value === undefined)) {
    throw new Error('Primary key values are required to delete a row')
  }

  await client.query(
    `delete from ${qualified} where ${conditions.join(' and ')}`,
    values,
  )
}
