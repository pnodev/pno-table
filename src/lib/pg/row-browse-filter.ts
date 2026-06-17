import { quoteIdentifier } from '#/lib/pg/identifiers'

export type RowBrowseFilterOp = 'eq' | 'contains'

export type RowBrowseFilterOptions = {
  allowedColumns: string[]
  filterColumn?: string | null
  filterValue?: string | null
  filterOp?: RowBrowseFilterOp | null
  q?: string | null
}

export type RowBrowseFilterClause = {
  clause: string
  values: unknown[]
}

type ColumnFilter = {
  column: string
  value: string
  op: RowBrowseFilterOp
}

function resolveColumnFilter(
  filterColumn: string | null | undefined,
  filterValue: string | null | undefined,
  filterOp: RowBrowseFilterOp | null | undefined,
  allowedColumns: string[],
): ColumnFilter | null {
  const column = filterColumn?.trim()
  const value = filterValue?.trim()

  if (!column || !value || !allowedColumns.includes(column)) {
    return null
  }

  return {
    column,
    value,
    op: filterOp === 'contains' ? 'contains' : 'eq',
  }
}

export function buildRowBrowseFilterClause(
  options: RowBrowseFilterOptions,
): RowBrowseFilterClause {
  const parts: string[] = []
  const values: unknown[] = []

  const columnFilter = resolveColumnFilter(
    options.filterColumn,
    options.filterValue,
    options.filterOp,
    options.allowedColumns,
  )

  if (columnFilter) {
    const paramIndex = values.length + 1

    if (columnFilter.op === 'contains') {
      values.push(`%${columnFilter.value}%`)
      parts.push(
        `${quoteIdentifier(columnFilter.column)}::text ilike $${paramIndex}`,
      )
    } else {
      values.push(columnFilter.value)
      parts.push(
        `${quoteIdentifier(columnFilter.column)}::text = $${paramIndex}`,
      )
    }
  }

  const q = options.q?.trim() ?? ''
  if (q && options.allowedColumns.length > 0) {
    const paramIndex = values.length + 1
    values.push(`%${q}%`)
    const targets = options.allowedColumns.map(
      (column) => `${quoteIdentifier(column)}::text ilike $${paramIndex}`,
    )
    parts.push(`(${targets.join(' or ')})`)
  }

  if (parts.length === 0) {
    return { clause: '', values: [] }
  }

  return {
    clause: `where ${parts.join(' and ')}`,
    values,
  }
}
