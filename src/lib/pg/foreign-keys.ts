import type {
  ColumnInfo,
  ColumnRelation,
  ForeignKeyInfo,
  RelationColumnMapping,
} from '#/lib/pg/catalog-types'

const PREFERRED_LABEL_COLUMNS = [
  'name',
  'title',
  'label',
  'display_name',
  'slug',
  'code',
  'email',
] as const

const LABEL_COLUMN_TYPES = new Set([
  'character varying',
  'varchar',
  'text',
  'character',
  'char',
  'citext',
])

const INFERRED_RELATION_TYPES = new Set([
  'uuid',
  'integer',
  'bigint',
  'smallint',
])

export function isCompositeRelation(relation: ColumnRelation) {
  return relation.columns.length > 1
}

export function buildConstraintRelations(
  foreignKeys: ForeignKeyInfo[],
): ColumnRelation[] {
  const grouped = new Map<string, ForeignKeyInfo[]>()

  for (const foreignKey of foreignKeys) {
    const current = grouped.get(foreignKey.name) ?? []
    current.push(foreignKey)
    grouped.set(foreignKey.name, current)
  }

  const relations: ColumnRelation[] = []

  for (const [name, keys] of grouped) {
    const columns = keys.map((foreignKey) => ({
      column: foreignKey.column,
      referencedColumn: foreignKey.referencedColumn,
    }))

    for (const foreignKey of keys) {
      relations.push({
        source: 'constraint',
        name,
        column: foreignKey.column,
        columns,
        referencedSchema: foreignKey.referencedSchema,
        referencedTable: foreignKey.referencedTable,
      })
    }
  }

  return relations
}

export function inferRelationForColumn(
  column: ColumnInfo,
  schema: string,
): ColumnRelation | null {
  if (!column.name.endsWith('_id') || column.name === 'id') {
    return null
  }

  if (!INFERRED_RELATION_TYPES.has(column.dataType.toLowerCase())) {
    return null
  }

  const tableName = column.name.slice(0, -3)

  if (!tableName) {
    return null
  }

  return {
    source: 'inferred',
    name: `inferred:${column.name}`,
    column: column.name,
    columns: [{ column: column.name, referencedColumn: 'id' }],
    referencedSchema: schema,
    referencedTable: tableName,
  }
}

export function listColumnRelations(
  columns: ColumnInfo[],
  schema: string,
  foreignKeys: ForeignKeyInfo[],
): ColumnRelation[] {
  const relations = new Map<string, ColumnRelation>()
  const coveredColumns = new Set<string>()

  for (const relation of buildConstraintRelations(foreignKeys)) {
    relations.set(relation.name, relation)

    for (const mapping of relation.columns) {
      coveredColumns.add(mapping.column)
    }
  }

  for (const column of columns) {
    if (coveredColumns.has(column.name)) {
      continue
    }

    const inferred = inferRelationForColumn(column, schema)

    if (inferred) {
      relations.set(inferred.name, inferred)
      coveredColumns.add(column.name)
    }
  }

  return [...relations.values()]
}

export function getColumnRelation(
  columnName: string,
  columns: ColumnInfo[],
  schema: string,
  foreignKeys: ForeignKeyInfo[],
): ColumnRelation | null {
  const constraintRelation = buildConstraintRelations(foreignKeys).find(
    (relation) => relation.column === columnName,
  )

  if (constraintRelation) {
    return constraintRelation
  }

  const column = columns.find((entry) => entry.name === columnName)

  if (!column) {
    return null
  }

  return inferRelationForColumn(column, schema)
}

export function getResolvableRelations(
  columns: ColumnInfo[],
  schema: string,
  foreignKeys: ForeignKeyInfo[],
): ColumnRelation[] {
  return listColumnRelations(columns, schema, foreignKeys).filter(
    (relation) => !isCompositeRelation(relation),
  )
}

export function inferLabelColumn(
  columns: ColumnInfo[],
  valueColumn: string,
): string | null {
  const byName = new Map(
    columns.map((column) => [column.name.toLowerCase(), column.name]),
  )

  for (const preferred of PREFERRED_LABEL_COLUMNS) {
    const match = byName.get(preferred)

    if (match && match !== valueColumn) {
      return match
    }
  }

  const textColumn = columns.find(
    (column) =>
      column.name !== valueColumn &&
      LABEL_COLUMN_TYPES.has(column.dataType.toLowerCase()),
  )

  return textColumn?.name ?? null
}

export function formatForeignKeyOptionValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

export function relationReferenceLabel(relation: ColumnRelation) {
  const target = `${relation.referencedSchema}.${relation.referencedTable}`

  if (isCompositeRelation(relation)) {
    return `${target} (${relation.columns
      .map((mapping) => mapping.referencedColumn)
      .join(', ')})`
  }

  return `${target}.${relation.columns[0]?.referencedColumn ?? 'id'}`
}

export function relationHintSuffix(relation: ColumnRelation) {
  const reference = relationReferenceLabel(relation)

  if (relation.source === 'inferred') {
    return `inferred reference to ${reference}`
  }

  if (isCompositeRelation(relation)) {
    return `references ${reference}`
  }

  return `references ${reference}`
}

export function buildRelationFilterValues(
  relation: ColumnRelation,
  relationValues: Record<string, string>,
  activeColumn: string,
) {
  const filters: Record<string, string> = {}

  for (const mapping of relation.columns) {
    if (mapping.column === activeColumn) {
      continue
    }

    const nextValue = relationValues[mapping.column]?.trim()

    if (nextValue) {
      filters[mapping.column] = nextValue
    }
  }

  return filters
}

export function buildRelationSelectedValues(
  relation: ColumnRelation,
  relationValues: Record<string, string>,
) {
  const selectedValues: Record<string, string> = {}

  for (const mapping of relation.columns) {
    const nextValue = relationValues[mapping.column]?.trim()

    if (nextValue) {
      selectedValues[mapping.column] = nextValue
    }
  }

  return selectedValues
}

export function optionLabelForRelationValue(
  options: Array<{ value: string; label: string; values: Record<string, string> }>,
  relation: ColumnRelation,
  relationValues: Record<string, string>,
) {
  const activeValue = relationValues[relation.column]?.trim()

  if (!activeValue) {
    return null
  }

  const match = options.find((option) => {
    if (isCompositeRelation(relation)) {
      return relation.columns.every(
        (mapping) => option.values[mapping.column] === relationValues[mapping.column]?.trim(),
      )
    }

    return option.value === activeValue
  })

  return match?.label ?? null
}

export function relationMappingsEqual(
  left: RelationColumnMapping[],
  right: RelationColumnMapping[],
) {
  if (left.length !== right.length) {
    return false
  }

  return left.every(
    (mapping, index) =>
      mapping.column === right[index]?.column &&
      mapping.referencedColumn === right[index]?.referencedColumn,
  )
}

export function getRelationLinkTarget(
  relation: ColumnRelation,
  columnName: string,
  rawValue: unknown,
) {
  if (rawValue === null || rawValue === undefined) {
    return null
  }

  const mapping = relation.columns.find((entry) => entry.column === columnName)

  if (!mapping) {
    return null
  }

  const filterValue = formatForeignKeyOptionValue(rawValue)

  if (!filterValue) {
    return null
  }

  return {
    schema: relation.referencedSchema,
    table: relation.referencedTable,
    filterColumn: mapping.referencedColumn,
    filterValue,
  }
}

export function buildColumnRelationMap(
  columns: ColumnInfo[],
  schema: string,
  foreignKeys: ForeignKeyInfo[],
) {
  const relations = new Map<string, ColumnRelation>()

  for (const column of columns) {
    const relation = getColumnRelation(column.name, columns, schema, foreignKeys)

    if (relation) {
      relations.set(column.name, relation)
    }
  }

  return relations
}

// Backwards-compatible alias used in a few call sites during migration.
export function getForeignKeyForColumn(
  columnName: string,
  foreignKeys: ForeignKeyInfo[],
): ForeignKeyInfo | null {
  const relation = buildConstraintRelations(foreignKeys).find(
    (entry) =>
      entry.column === columnName && !isCompositeRelation(entry),
  )

  if (!relation) {
    return null
  }

  const mapping = relation.columns[0]

  return {
    name: relation.name,
    column: mapping.column,
    referencedSchema: relation.referencedSchema,
    referencedTable: relation.referencedTable,
    referencedColumn: mapping.referencedColumn,
  }
}
