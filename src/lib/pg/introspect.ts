import type pg from 'pg'

import type {
  ColumnInfo,
  DatabaseNode,
  ForeignKeyInfo,
  ForeignKeyOption,
  ForeignKeyOptionsResult,
  IndexInfo,
  RelationColumnMapping,
  RelationNode,
  SchemaNode,
  TableStructure,
  ColumnRelation,
} from '#/lib/pg/catalog-types'
import {
  formatForeignKeyOptionValue,
  getResolvableRelations,
  inferLabelColumn,
  isCompositeRelation,
  listColumnRelations,
} from '#/lib/pg/foreign-keys'
import { quoteIdentifier, quoteQualifiedName } from '#/lib/pg/identifiers'
import {
  buildRowBrowseFilterClause,
  type RowBrowseFilterOp,
} from '#/lib/pg/row-browse-filter'

export async function listDatabases(client: pg.Client): Promise<DatabaseNode[]> {
  const result = await client.query<{ name: string }>(`
    select d.datname as name
    from pg_catalog.pg_database d
    join pg_catalog.pg_roles session_role
      on session_role.rolname = current_user
    where d.datallowconn
      and not d.datistemplate
      and (
        session_role.rolsuper
        or exists (
          select 1
          from aclexplode(coalesce(d.datacl, acldefault('d', d.datdba))) as acl
          join pg_catalog.pg_roles grantee on grantee.oid = acl.grantee
          where grantee.rolname = current_user
            and acl.privilege_type = 'CONNECT'
        )
      )
    order by d.datname
  `)

  return result.rows
}

export async function listSchemas(
  client: pg.Client,
  _database: string,
): Promise<SchemaNode[]> {
  const result = await client.query<{ name: string }>(
    `
      select n.nspname as name
      from pg_catalog.pg_namespace n
      where pg_catalog.has_schema_privilege(n.oid, 'USAGE')
        and n.nspname not like 'pg\\_%' escape '\\'
        and n.nspname <> 'information_schema'
      order by n.nspname
    `,
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
        c.relname as name,
        case c.relkind
          when 'v' then 'view'
          else 'table'
        end as kind
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1
        and c.relkind in ('r', 'v', 'p', 'f')
        and (
          pg_catalog.has_table_privilege(c.oid, 'SELECT')
          or pg_catalog.has_any_column_privilege(c.oid, 'SELECT')
        )
      order by c.relname
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
  }>(
    `
      select
        c.column_name as name,
        c.data_type as data_type,
        c.is_nullable,
        c.column_default
      from information_schema.columns c
      where c.table_schema = $1
        and c.table_name = $2
      order by c.ordinal_position
    `,
    [schema, table],
  )

  const primaryKeyResult = await client.query<{ column_name: string }>(
    `
      select a.attname as column_name
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_class rel on rel.oid = con.conrelid
      join pg_catalog.pg_namespace nsp on nsp.oid = rel.relnamespace
      join pg_catalog.pg_attribute a
        on a.attrelid = con.conrelid
       and a.attnum = any(con.conkey)
      where nsp.nspname = $1
        and rel.relname = $2
        and con.contype = 'p'
        and a.attnum > 0
        and not a.attisdropped
      order by array_position(con.conkey, a.attnum)
    `,
    [schema, table],
  )

  const foreignKeyColumnsResult = await client.query<{ column_name: string }>(
    `
      select distinct a.attname as column_name
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_class rel on rel.oid = con.conrelid
      join pg_catalog.pg_namespace nsp on nsp.oid = rel.relnamespace
      join pg_catalog.pg_attribute a
        on a.attrelid = con.conrelid
       and a.attnum = any(con.conkey)
      where nsp.nspname = $1
        and rel.relname = $2
        and con.contype = 'f'
        and a.attnum > 0
        and not a.attisdropped
    `,
    [schema, table],
  )

  const primaryKeyColumns = new Set(
    primaryKeyResult.rows.map((row) => row.column_name),
  )
  const foreignKeyColumns = new Set(
    foreignKeyColumnsResult.rows.map((row) => row.column_name),
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
        con.conname as name,
        att.attname as column,
        fnsp.nspname as referenced_schema,
        frel.relname as referenced_table,
        fatt.attname as referenced_column
      from pg_catalog.pg_constraint con
      join pg_catalog.pg_class rel on rel.oid = con.conrelid
      join pg_catalog.pg_namespace nsp on nsp.oid = rel.relnamespace
      join lateral unnest(con.conkey) with ordinality as ck(attnum, ord) on true
      join pg_catalog.pg_attribute att
        on att.attrelid = con.conrelid
       and att.attnum = ck.attnum
      join lateral unnest(con.confkey) with ordinality as fk(attnum, ord)
        on fk.ord = ck.ord
      join pg_catalog.pg_attribute fatt
        on fatt.attrelid = con.confrelid
       and fatt.attnum = fk.attnum
      join pg_catalog.pg_class frel on frel.oid = con.confrelid
      join pg_catalog.pg_namespace fnsp on fnsp.oid = frel.relnamespace
      where nsp.nspname = $1
        and rel.relname = $2
        and con.contype = 'f'
      order by con.conname, ck.ord
    `,
    [schema, table],
  )

  const columns: ColumnInfo[] = columnsResult.rows.map((row) => ({
    name: row.name,
    dataType: row.data_type,
    isNullable: row.is_nullable === 'YES',
    defaultValue: row.column_default,
    isPrimaryKey: primaryKeyColumns.has(row.name),
    isForeignKey: foreignKeyColumns.has(row.name),
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

const FOREIGN_KEY_OPTIONS_LIMIT = 100

function buildRelationOption(
  relation: ColumnRelation,
  row: Record<string, unknown>,
  label: unknown,
): ForeignKeyOption | null {
  const values = Object.fromEntries(
    relation.columns.map((mapping) => [
      mapping.column,
      formatForeignKeyOptionValue(row[mapping.column]),
    ]),
  )

  const primaryValue = values[relation.column]

  if (!primaryValue) {
    return null
  }

  const formattedLabel = formatForeignKeyOptionValue(label) || primaryValue

  return {
    value: primaryValue,
    label: formattedLabel,
    values,
  }
}

export async function listForeignKeyOptions(
  client: pg.Client,
  options: {
    referencedSchema: string
    referencedTable: string
    columns: RelationColumnMapping[]
    activeColumn: string
    search?: string
    selectedValues?: Record<string, string>
    filterValues?: Record<string, string>
    limit?: number
  },
): Promise<ForeignKeyOptionsResult> {
  if (
    !(await relationExists(
      client,
      options.referencedSchema,
      options.referencedTable,
    ))
  ) {
    return {
      options: [],
      labelColumn: null,
      referencedSchema: options.referencedSchema,
      referencedTable: options.referencedTable,
      columns: options.columns,
    }
  }

  const relation: ColumnRelation = {
    source: 'constraint',
    name: 'options',
    column: options.activeColumn,
    columns: options.columns,
    referencedSchema: options.referencedSchema,
    referencedTable: options.referencedTable,
  }

  const structure = await getTableStructure(
    client,
    options.referencedSchema,
    options.referencedTable,
  )

  for (const mapping of options.columns) {
    const referencedColumn = structure.columns.find(
      (column) => column.name === mapping.referencedColumn,
    )

    if (!referencedColumn) {
      throw new Error(
        `Referenced column ${options.referencedSchema}.${options.referencedTable}.${mapping.referencedColumn} was not found`,
      )
    }
  }

  const primaryReferencedColumn =
    options.columns.find((mapping) => mapping.column === relation.column)
      ?.referencedColumn ?? options.columns[0]?.referencedColumn

  const labelColumn = inferLabelColumn(
    structure.columns,
    primaryReferencedColumn ?? options.columns[0].referencedColumn,
  )
  const qualified = quoteQualifiedName(
    options.referencedSchema,
    options.referencedTable,
  )
  const search = options.search?.trim() ?? ''
  const selectedValues = options.selectedValues ?? {}
  const filterValues = options.filterValues ?? {}
  const limit = options.limit ?? FOREIGN_KEY_OPTIONS_LIMIT
  const values: unknown[] = []
  const whereParts: string[] = []

  for (const mapping of options.columns) {
    const filterValue = filterValues[mapping.column]?.trim()

    if (!filterValue) {
      continue
    }

    values.push(filterValue)
    whereParts.push(
      `ref.${quoteIdentifier(mapping.referencedColumn)}::text = $${values.length}`,
    )
  }

  if (search) {
    values.push(`%${search}%`)
    const searchIndex = values.length
    const searchTargets = new Set<string>()

    if (labelColumn) {
      searchTargets.add(`ref.${quoteIdentifier(labelColumn)}::text`)
    }

    for (const mapping of options.columns) {
      searchTargets.add(`ref.${quoteIdentifier(mapping.referencedColumn)}::text`)
    }

    whereParts.push(
      `(${[...searchTargets].map((target) => `${target} ilike $${searchIndex}`).join(' or ')})`,
    )
  }

  const selectedClauses: string[] = []

  if (Object.keys(selectedValues).length > 0) {
    const selectedParts: string[] = []

    for (const mapping of options.columns) {
      const selectedValue = selectedValues[mapping.column]?.trim()

      if (!selectedValue) {
        selectedParts.length = 0
        break
      }

      values.push(selectedValue)
      selectedParts.push(
        `ref.${quoteIdentifier(mapping.referencedColumn)}::text = $${values.length}`,
      )
    }

    if (selectedParts.length === options.columns.length) {
      selectedClauses.push(`(${selectedParts.join(' and ')})`)
    }
  }

  const filters =
    whereParts.length > 0 ? `(${whereParts.join(' and ')})` : ''
  const selected =
    selectedClauses.length > 0 ? `(${selectedClauses.join(' or ')})` : ''
  const predicate = [filters, selected].filter(Boolean).join(' or ')
  const whereClause = predicate ? `where ${predicate}` : ''
  const labelIdentifier = quoteIdentifier(
    labelColumn ?? primaryReferencedColumn ?? options.columns[0].referencedColumn,
  )
  const valueSelects = options.columns
    .map(
      (mapping) =>
        `ref.${quoteIdentifier(mapping.referencedColumn)}::text as ${quoteIdentifier(mapping.column)}`,
    )
    .join(', ')

  values.push(limit)
  const limitIndex = values.length

  const result = await client.query<Record<string, unknown>>(
    `
      select
        ${valueSelects},
        ref.${labelIdentifier}::text as label
      from ${qualified} ref
      ${whereClause}
      order by label asc nulls last, ${quoteIdentifier(options.columns[0].column)} asc
      limit $${limitIndex}
    `,
    values,
  )

  const seen = new Set<string>()
  const mappedOptions: ForeignKeyOption[] = []

  for (const row of result.rows) {
    const option = buildRelationOption(relation, row, row.label)

    if (!option) {
      continue
    }

    const dedupeKey = isCompositeRelation(relation)
      ? JSON.stringify(option.values)
      : option.value

    if (seen.has(dedupeKey)) {
      continue
    }

    seen.add(dedupeKey)
    mappedOptions.push(option)
  }

  return {
    options: mappedOptions,
    labelColumn,
    referencedSchema: options.referencedSchema,
    referencedTable: options.referencedTable,
    columns: options.columns,
  }
}

export async function resolveRelationLabels(
  client: pg.Client,
  relation: ColumnRelation,
  values: string[],
): Promise<Record<string, string>> {
  if (isCompositeRelation(relation) || values.length === 0) {
    return {}
  }

  const mapping = relation.columns[0]
  const structure = await getTableStructure(
    client,
    relation.referencedSchema,
    relation.referencedTable,
  )
  const labelColumn = inferLabelColumn(
    structure.columns,
    mapping.referencedColumn,
  )
  const qualified = quoteQualifiedName(
    relation.referencedSchema,
    relation.referencedTable,
  )
  const valueIdentifier = quoteIdentifier(mapping.referencedColumn)
  const labelIdentifier = quoteIdentifier(labelColumn ?? mapping.referencedColumn)

  const result = await client.query<{
    value: unknown
    label: unknown
  }>(
    `
      select
        ref.${valueIdentifier}::text as value,
        ref.${labelIdentifier}::text as label
      from ${qualified} ref
      where ref.${valueIdentifier}::text = any($1::text[])
    `,
    [values],
  )

  const labels: Record<string, string> = {}

  for (const row of result.rows) {
    const value = formatForeignKeyOptionValue(row.value)

    if (!value) {
      continue
    }

    labels[value] = formatForeignKeyOptionValue(row.label) || value
  }

  return labels
}

export async function relationExists(
  client: pg.Client,
  schema: string,
  table: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = $1
          and table_name = $2
          and table_type in ('BASE TABLE', 'VIEW')
      ) as exists
    `,
    [schema, table],
  )

  return result.rows[0]?.exists ?? false
}

export async function buildLinkableRelations(
  client: pg.Client,
  columns: ColumnInfo[],
  schema: string,
  foreignKeys: ForeignKeyInfo[],
) {
  const relations = listColumnRelations(columns, schema, foreignKeys)
  const linkable: Record<
    string,
    {
      referencedSchema: string
      referencedTable: string
      filterColumn: string
    }
  > = {}

  for (const relation of relations) {
    if (
      !(await relationExists(
        client,
        relation.referencedSchema,
        relation.referencedTable,
      ))
    ) {
      continue
    }

    for (const mapping of relation.columns) {
      linkable[mapping.column] = {
        referencedSchema: relation.referencedSchema,
        referencedTable: relation.referencedTable,
        filterColumn: mapping.referencedColumn,
      }
    }
  }

  return linkable
}

export async function resolveRelationLabelsForRows(
  client: pg.Client,
  columns: ColumnInfo[],
  schema: string,
  foreignKeys: ForeignKeyInfo[],
  rows: Record<string, unknown>[],
): Promise<Record<string, Record<string, string>>> {
  const relations = getResolvableRelations(columns, schema, foreignKeys)
  const relationLabels: Record<string, Record<string, string>> = {}

  await Promise.all(
    relations.map(async (relation) => {
      const columnName = relation.columns[0]?.column

      if (!columnName) {
        return
      }

      try {
        if (
          !(await relationExists(
            client,
            relation.referencedSchema,
            relation.referencedTable,
          ))
        ) {
          return
        }

        const uniqueValues = [
          ...new Set(
            rows
              .map((row) => formatForeignKeyOptionValue(row[columnName]))
              .filter(Boolean),
          ),
        ]

        if (uniqueValues.length === 0) {
          return
        }

        relationLabels[columnName] = await resolveRelationLabels(
          client,
          relation,
          uniqueValues,
        )
      } catch {
        return
      }
    }),
  )

  return relationLabels
}

export async function countTableRows(
  client: pg.Client,
  schema: string,
  table: string,
  options?: {
    allowedColumns?: string[]
    filterColumn?: string | null
    filterValue?: string | null
    filterOp?: RowBrowseFilterOp | null
    q?: string | null
  },
): Promise<number> {
  const qualified = quoteQualifiedName(schema, table)
  const { clause, values } = buildRowBrowseFilterClause({
    allowedColumns: options?.allowedColumns ?? [],
    filterColumn: options?.filterColumn,
    filterValue: options?.filterValue,
    filterOp: options?.filterOp,
    q: options?.q,
  })
  const result = await client.query<{ count: string }>(
    `select count(*)::text as count from ${qualified} ${clause}`,
    values,
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
    filterColumn?: string | null
    filterValue?: string | null
    filterOp?: RowBrowseFilterOp | null
    q?: string | null
  },
): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  const qualified = quoteQualifiedName(schema, table)
  const offset = (options.page - 1) * options.pageSize
  const { clause, values: filterValues } = buildRowBrowseFilterClause({
    allowedColumns: options.allowedColumns,
    filterColumn: options.filterColumn,
    filterValue: options.filterValue,
    filterOp: options.filterOp,
    q: options.q,
  })

  let orderBy = ''
  if (
    options.sortColumn &&
    options.allowedColumns.includes(options.sortColumn)
  ) {
    orderBy = `order by ${quoteIdentifier(options.sortColumn)} ${options.sortDirection === 'desc' ? 'desc' : 'asc'}`
  }

  const limitIndex = filterValues.length + 1
  const offsetIndex = filterValues.length + 2

  const result = await client.query(
    `select * from ${qualified} ${clause} ${orderBy} limit $${limitIndex} offset $${offsetIndex}`,
    [...filterValues, options.pageSize, offset],
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

export async function insertTableRow(
  client: pg.Client,
  schema: string,
  table: string,
  values: Record<string, unknown>,
  allowedColumns: string[],
): Promise<void> {
  const columns = Object.keys(values).filter((column) =>
    allowedColumns.includes(column),
  )

  if (columns.length === 0) {
    throw new Error('No column values provided for insert')
  }

  const qualified = quoteQualifiedName(schema, table)
  const columnList = columns.map((column) => quoteIdentifier(column)).join(', ')
  const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ')
  const queryValues = columns.map((column) => values[column])

  await client.query(
    `insert into ${qualified} (${columnList}) values (${placeholders})`,
    queryValues,
  )
}

export async function updateTableRow(
  client: pg.Client,
  schema: string,
  table: string,
  primaryKey: Record<string, unknown>,
  primaryKeyColumns: string[],
  values: Record<string, unknown>,
  allowedColumns: string[],
): Promise<void> {
  if (primaryKeyColumns.length === 0) {
    throw new Error('Cannot update rows in a table without a primary key')
  }

  const setColumns = Object.keys(values).filter(
    (column) =>
      allowedColumns.includes(column) && !primaryKeyColumns.includes(column),
  )

  if (setColumns.length === 0) {
    throw new Error('No column values provided for update')
  }

  const qualified = quoteQualifiedName(schema, table)
  const setClause = setColumns
    .map((column, index) => `${quoteIdentifier(column)} = $${index + 1}`)
    .join(', ')
  const setValues = setColumns.map((column) => values[column])

  const pkOffset = setColumns.length
  const conditions = primaryKeyColumns.map(
    (column, index) =>
      `${quoteIdentifier(column)} = $${pkOffset + index + 1}`,
  )
  const pkValues = primaryKeyColumns.map((column) => primaryKey[column])

  if (pkValues.some((value) => value === undefined)) {
    throw new Error('Primary key values are required to update a row')
  }

  await client.query(
    `update ${qualified} set ${setClause} where ${conditions.join(' and ')}`,
    [...setValues, ...pkValues],
  )
}
