export type DatabaseNode = {
  name: string
}

export type DatabaseDetails = {
  name: string
  owner: string
  encoding: string
  collation: string
  sizeBytes: number
  isTemplate: boolean
  allowConnections: boolean
}

export type RoleInfo = {
  name: string
  oid: number
  isSuperuser: boolean
  canLogin: boolean
  canCreateDb: boolean
  canCreateRole: boolean
  isReplication: boolean
  bypassRls: boolean
  connectionLimit: number
  validUntil: string | null
  memberOf: string[]
}

export type RoleDatabaseAccess = {
  database: string
  canConnect: boolean
  canCreate: boolean
  publicCanConnect: boolean
  effectiveCanConnect: boolean
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

export type ForeignKeyOption = {
  value: string
  label: string
  values: Record<string, string>
}

export type RelationColumnMapping = {
  column: string
  referencedColumn: string
}

export type ColumnRelationSource = 'constraint' | 'inferred'

export type ColumnRelation = {
  source: ColumnRelationSource
  name: string
  column: string
  columns: RelationColumnMapping[]
  referencedSchema: string
  referencedTable: string
}

export type ForeignKeyOptionsResult = {
  options: ForeignKeyOption[]
  labelColumn: string | null
  referencedSchema: string
  referencedTable: string
  columns: RelationColumnMapping[]
}

export type LinkableRelation = {
  referencedSchema: string
  referencedTable: string
  filterColumn: string
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
  filterColumn: string | null
  filterValue: string | null
  relationLabels: Record<string, Record<string, string>>
  linkableRelations: Record<string, LinkableRelation>
}
