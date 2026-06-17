export type DatabaseNode = {
  name: string
}

export type SchemaNode = {
  name: string
}

export type RelationNode = {
  name: string
  kind: 'table' | 'view'
}

export type ColumnInfo = {
  name: string
  dataType: string
  isNullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
  isForeignKey: boolean
}

export type IndexInfo = {
  name: string
  definition: string
  isUnique: boolean
  isPrimary: boolean
}

export type ForeignKeyInfo = {
  name: string
  column: string
  referencedSchema: string
  referencedTable: string
  referencedColumn: string
}

export type TableStructure = {
  columns: ColumnInfo[]
  indexes: IndexInfo[]
  foreignKeys: ForeignKeyInfo[]
  primaryKeyColumns: string[]
}

export type BrowseRow = Record<string, unknown>

export type BrowseTableResult = {
  columns: Array<{ name: string; dataType: string }>
  rows: BrowseRow[]
  totalRows: number
  page: number
  pageSize: number
  sortColumn: string | null
  sortDirection: 'asc' | 'desc'
}
