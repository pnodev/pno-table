import { useRouter } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import { useState } from 'react'

import { Button } from '#/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { formatCellValue, totalPages } from '#/lib/pg/format-cell'
import type { BrowseTableResult } from '#/lib/pg/catalog-types'
import { removeTableRow } from '#/server/browse'

type DataGridProps = {
  connectionId: string
  database: string
  schema: string
  table: string
  browse: BrowseTableResult
  readOnly: boolean
  primaryKeyColumns: string[]
}

export function DataGrid({
  connectionId,
  database,
  schema,
  table,
  browse,
  readOnly,
  primaryKeyColumns,
}: DataGridProps) {
  const router = useRouter()
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const pages = totalPages(browse.totalRows, browse.pageSize)

  const navigatePage = (page: number) => {
    void router.navigate({
      to: '/connect/$connectionId/$database/$schema/$table',
      params: { connectionId, database, schema, table },
      search: {
        page,
        pageSize: browse.pageSize,
        sort: browse.sortColumn ?? undefined,
        dir: browse.sortDirection,
      },
    })
  }

  const navigateSort = (column: string) => {
    const nextDirection =
      browse.sortColumn === column && browse.sortDirection === 'asc'
        ? 'desc'
        : 'asc'

    void router.navigate({
      to: '/connect/$connectionId/$database/$schema/$table',
      params: { connectionId, database, schema, table },
      search: {
        page: 1,
        pageSize: browse.pageSize,
        sort: column,
        dir: nextDirection,
      },
    })
  }

  const handleDelete = async (row: Record<string, unknown>) => {
    const primaryKey = Object.fromEntries(
      primaryKeyColumns.map((column) => [column, row[column]]),
    )
    const key = JSON.stringify(primaryKey)

    const confirmed = window.confirm(
      `Delete this row from ${schema}.${table}?`,
    )

    if (!confirmed) {
      return
    }

    setDeletingKey(key)
    setError(null)

    try {
      await removeTableRow({
        data: {
          connectionId,
          database,
          schema,
          table,
          primaryKey,
        },
      })
      await router.invalidate()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete row',
      )
    } finally {
      setDeletingKey(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {browse.totalRows.toLocaleString()} row
          {browse.totalRows === 1 ? '' : 's'}
          {browse.sortColumn
            ? ` · sorted by ${browse.sortColumn} ${browse.sortDirection}`
            : ''}
        </p>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={browse.page <= 1}
            onClick={() => navigatePage(browse.page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {browse.page} of {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={browse.page >= pages}
            onClick={() => navigatePage(browse.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              {browse.columns.map((column) => (
                <TableHead key={column.name}>
                  <button
                    type="button"
                    onClick={() => navigateSort(column.name)}
                    className="inline-flex items-center gap-1 font-medium"
                  >
                    <span>{column.name}</span>
                    <span className="text-muted-foreground text-xs font-normal">
                      {column.dataType}
                    </span>
                    {browse.sortColumn === column.name ? (
                      browse.sortDirection === 'asc' ? (
                        <ArrowUp className="size-3.5" />
                      ) : (
                        <ArrowDown className="size-3.5" />
                      )
                    ) : null}
                  </button>
                </TableHead>
              ))}
              {!readOnly && primaryKeyColumns.length > 0 ? (
                <TableHead className="w-20">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {browse.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={
                    browse.columns.length +
                    (!readOnly && primaryKeyColumns.length > 0 ? 1 : 0)
                  }
                  className="text-muted-foreground h-24 text-center"
                >
                  No rows found.
                </TableCell>
              </TableRow>
            ) : (
              browse.rows.map((row, index) => {
                const primaryKey = Object.fromEntries(
                  primaryKeyColumns.map((column) => [column, row[column]]),
                )
                const rowKey = JSON.stringify(primaryKey) || String(index)

                return (
                  <TableRow key={rowKey}>
                    {browse.columns.map((column) => (
                      <TableCell
                        key={column.name}
                        className="max-w-xs truncate font-mono text-xs"
                        title={formatCellValue(row[column.name])}
                      >
                        {formatCellValue(row[column.name])}
                      </TableCell>
                    ))}
                    {!readOnly && primaryKeyColumns.length > 0 ? (
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          disabled={deletingKey === rowKey}
                          onClick={() => void handleDelete(row)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
