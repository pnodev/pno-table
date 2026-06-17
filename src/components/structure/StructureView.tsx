import { Link } from '@tanstack/react-router'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import type { TableStructure } from '#/lib/pg/catalog-types'

type StructureViewProps = {
  connectionId: string
  database: string
  structure: TableStructure
}

export function StructureView({
  connectionId,
  database,
  structure,
}: StructureViewProps) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Columns</h2>
        <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Key</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {structure.columns.map((column) => (
                <TableRow key={column.name}>
                  <TableCell className="font-medium">{column.name}</TableCell>
                  <TableCell>{column.dataType}</TableCell>
                  <TableCell>{column.isNullable ? 'YES' : 'NO'}</TableCell>
                  <TableCell className="max-w-sm truncate font-mono text-xs">
                    {column.defaultValue ?? '—'}
                  </TableCell>
                  <TableCell>
                    {column.isPrimaryKey
                      ? 'PRIMARY KEY'
                      : column.isForeignKey
                        ? 'FOREIGN KEY'
                        : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Indexes</h2>
        {structure.indexes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No indexes.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Unique</TableHead>
                  <TableHead>Primary</TableHead>
                  <TableHead>Definition</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structure.indexes.map((index) => (
                  <TableRow key={index.name}>
                    <TableCell>{index.name}</TableCell>
                    <TableCell>{index.isUnique ? 'YES' : 'NO'}</TableCell>
                    <TableCell>{index.isPrimary ? 'YES' : 'NO'}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {index.definition}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">
          Foreign keys
        </h2>
        {structure.foreignKeys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No foreign keys.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Column</TableHead>
                  <TableHead>References</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {structure.foreignKeys.map((foreignKey) => (
                  <TableRow key={`${foreignKey.name}-${foreignKey.column}`}>
                    <TableCell>{foreignKey.name}</TableCell>
                    <TableCell>{foreignKey.column}</TableCell>
                    <TableCell>
                      <Link
                        to="/connect/$connectionId/$database/$schema/$table"
                        params={{
                          connectionId,
                          database,
                          schema: foreignKey.referencedSchema,
                          table: foreignKey.referencedTable,
                        }}
                        className="font-mono text-xs no-underline hover:underline"
                      >
                        {foreignKey.referencedSchema}.
                        {foreignKey.referencedTable}.
                        {foreignKey.referencedColumn}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
