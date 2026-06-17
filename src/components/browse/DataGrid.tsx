import { useRouter } from '@tanstack/react-router'
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { DataGridCell } from '#/components/browse/DataGridCell'
import { RowFormSheet } from '#/components/browse/RowFormSheet'
import { UrlLightbox } from '#/components/browse/UrlLightbox'
import { Button } from '#/components/ui/button'
import { FormAlert } from '#/components/ui/form-layout'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import type { BrowseTableResult, ColumnInfo, ForeignKeyInfo } from '#/lib/pg/catalog-types'
import type { TableBrowseSearch } from '#/lib/browse/search'
import { formatRelationCellValue, totalPages } from '#/lib/pg/format-cell'
import { removeTableRow } from '#/server/browse'

type DataGridProps = {
  connectionId: string
  database: string
  schema: string
  table: string
  browse: BrowseTableResult
  columns: ColumnInfo[]
  foreignKeys: ForeignKeyInfo[]
  readOnly: boolean
  primaryKeyColumns: string[]
}

type RowDialogState =
  | { mode: 'insert' }
  | {
      mode: 'edit'
      row: Record<string, unknown>
      primaryKey: Record<string, unknown>
    }
  | null

const ROW_SHEET_CLOSE_MS = 300

function browseSearch(
  browse: DataGridProps['browse'],
  overrides: Partial<TableBrowseSearch> = {},
): TableBrowseSearch {
  return {
    page: browse.page,
    pageSize: browse.pageSize,
    dir: browse.sortDirection,
    sort: browse.sortColumn ?? undefined,
    filterColumn: browse.filterColumn ?? undefined,
    filterValue: browse.filterValue ?? undefined,
    ...overrides,
  }
}

export function DataGrid({
  connectionId,
  database,
  schema,
  table,
  browse,
  columns,
  foreignKeys,
  readOnly,
  primaryKeyColumns,
}: DataGridProps) {
  const router = useRouter()
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rowDialog, setRowDialog] = useState<RowDialogState>(null)
  const [rowSheetOpen, setRowSheetOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const rowSheetCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )

  useEffect(() => {
    if (!rowDialog) {
      return
    }

    setRowSheetOpen(true)

    return () => {
      setRowSheetOpen(false)
    }
  }, [rowDialog])

  useEffect(() => {
    return () => {
      if (rowSheetCloseTimeoutRef.current) {
        clearTimeout(rowSheetCloseTimeoutRef.current)
      }
    }
  }, [])

  const openRowDialog = (dialog: NonNullable<RowDialogState>) => {
    if (rowSheetCloseTimeoutRef.current) {
      clearTimeout(rowSheetCloseTimeoutRef.current)
      rowSheetCloseTimeoutRef.current = null
    }

    setRowDialog(dialog)
  }

  const handleRowSheetOpenChange = (open: boolean) => {
    setRowSheetOpen(open)

    if (open) {
      if (rowSheetCloseTimeoutRef.current) {
        clearTimeout(rowSheetCloseTimeoutRef.current)
        rowSheetCloseTimeoutRef.current = null
      }
      return
    }

    rowSheetCloseTimeoutRef.current = setTimeout(() => {
      setRowDialog(null)
      rowSheetCloseTimeoutRef.current = null
    }, ROW_SHEET_CLOSE_MS)
  }

  const pages = totalPages(browse.totalRows, browse.pageSize)
  const canEditRows = !readOnly && primaryKeyColumns.length > 0
  const canMutateRows = !readOnly
  const showActions = canEditRows

  const navigatePage = (page: number) => {
    void router.navigate({
      to: '/connect/$connectionId/$database/$schema/$table',
      params: { connectionId, database, schema, table },
      search: browseSearch(browse, { page }),
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
      search: browseSearch(browse, {
        page: 1,
        sort: column,
        dir: nextDirection,
      }),
    })
  }

  const clearFilter = () => {
    void router.navigate({
      to: '/connect/$connectionId/$database/$schema/$table',
      params: { connectionId, database, schema, table },
      search: browseSearch(browse, {
        page: 1,
        filterColumn: undefined,
        filterValue: undefined,
      }),
    })
  }

  const refresh = async () => {
    await router.invalidate()
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
      await refresh()
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
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted-foreground">
            {browse.totalRows.toLocaleString()} row
            {browse.totalRows === 1 ? '' : 's'}
            {browse.sortColumn
              ? ` · sorted by ${browse.sortColumn} ${browse.sortDirection}`
              : ''}
          </p>
          {canMutateRows ? (
            <Button
              type="button"
              size="sm"
              onClick={() => openRowDialog({ mode: 'insert' })}
            >
              <Plus className="size-4" />
              Add row
            </Button>
          ) : null}
        </div>

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

      {error ? <FormAlert>{error}</FormAlert> : null}

      {browse.filterColumn && browse.filterValue ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2">
          <p className="text-sm text-muted-foreground">
            Filtered to{' '}
            <span className="font-mono text-foreground">
              {browse.filterColumn} = {browse.filterValue}
            </span>
          </p>
          <Button type="button" variant="outline" size="sm" onClick={clearFilter}>
            <X className="size-3.5" />
            Clear filter
          </Button>
        </div>
      ) : null}

      {!readOnly && primaryKeyColumns.length === 0 ? (
        <FormAlert variant="warning">
          This table has no primary key. You can insert rows, but editing and
          deleting existing rows is disabled.
        </FormAlert>
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
              {showActions ? (
                <TableHead className="w-24">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {browse.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={
                    browse.columns.length + (showActions ? 1 : 0)
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
                    {browse.columns.map((column) => {
                      const cell = formatRelationCellValue(
                        row[column.name],
                        browse.relationLabels[column.name],
                      )

                      return (
                        <TableCell
                          key={column.name}
                          className="max-w-xs truncate text-xs"
                          title={cell.title}
                        >
                          <DataGridCell
                            connectionId={connectionId}
                            database={database}
                            pageSize={browse.pageSize}
                            rawValue={row[column.name]}
                            display={cell.display}
                            title={cell.title}
                            hasRelationLabel={Boolean(
                              browse.relationLabels[column.name],
                            )}
                            linkable={browse.linkableRelations[column.name]}
                            onPreviewUrl={setPreviewUrl}
                          />
                        </TableCell>
                      )
                    })}
                    {showActions ? (
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() =>
                              openRowDialog({
                                mode: 'edit',
                                row,
                                primaryKey,
                              })
                            }
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            disabled={deletingKey === rowKey}
                            onClick={() => void handleDelete(row)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {rowDialog ? (
        <RowFormSheet
          open={rowSheetOpen}
          mode={rowDialog.mode}
          connectionId={connectionId}
          database={database}
          schema={schema}
          table={table}
          columns={columns}
          foreignKeys={foreignKeys}
          initialRow={rowDialog.mode === 'edit' ? rowDialog.row : undefined}
          primaryKey={
            rowDialog.mode === 'edit' ? rowDialog.primaryKey : undefined
          }
          onOpenChange={handleRowSheetOpenChange}
          onSaved={refresh}
        />
      ) : null}

      <UrlLightbox
        url={previewUrl}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewUrl(null)
          }
        }}
      />
    </div>
  )
}
