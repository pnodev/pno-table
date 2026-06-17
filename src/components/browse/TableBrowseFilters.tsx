import { useRouter } from '@tanstack/react-router'
import { Filter, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Button } from '#/components/ui/button'
import { NativeSelect } from '#/components/ui/form-layout'
import { Input } from '#/components/ui/input'
import { tableBrowseSearch } from '#/lib/browse/search'
import type { BrowseTableResult, ColumnInfo } from '#/lib/pg/catalog-types'

type TableBrowseFiltersProps = {
  connectionId: string
  database: string
  schema: string
  table: string
  browse: BrowseTableResult
  columns: ColumnInfo[]
}

export function TableBrowseFilters({
  connectionId,
  database,
  schema,
  table,
  browse,
  columns,
}: TableBrowseFiltersProps) {
  const router = useRouter()
  const [q, setQ] = useState(browse.q ?? '')
  const [filterColumn, setFilterColumn] = useState(browse.filterColumn ?? '')
  const [filterValue, setFilterValue] = useState(browse.filterValue ?? '')
  const [filterOp, setFilterOp] = useState<'eq' | 'contains'>(
    browse.filterOp === 'eq' ? 'eq' : 'contains',
  )

  useEffect(() => {
    setQ(browse.q ?? '')
    setFilterColumn(browse.filterColumn ?? '')
    setFilterValue(browse.filterValue ?? '')
    setFilterOp(browse.filterOp === 'eq' ? 'eq' : 'contains')
  }, [browse.q, browse.filterColumn, browse.filterValue, browse.filterOp])

  const hasActiveSearch = Boolean(browse.q?.trim())
  const hasActiveFilter = Boolean(
    browse.filterColumn && browse.filterValue?.trim(),
  )
  const hasActiveQuery = hasActiveSearch || hasActiveFilter
  const canApplyFilter = Boolean(filterColumn && filterValue.trim())

  const navigate = (overrides: Parameters<typeof tableBrowseSearch>[1]) => {
    void router.navigate({
      to: '/connect/$connectionId/$database/$schema/$table',
      params: { connectionId, database, schema, table },
      search: tableBrowseSearch(browse, { page: 1, ...overrides }),
    })
  }

  const applySearch = () => {
    const trimmed = q.trim()
    navigate({
      q: trimmed || undefined,
    })
  }

  const applyFilter = () => {
    const column = filterColumn.trim()
    const value = filterValue.trim()

    if (!column || !value) {
      return
    }

    navigate({
      filterColumn: column,
      filterValue: value,
      filterOp: filterOp === 'contains' ? 'contains' : undefined,
    })
  }

  const clearSearch = () => {
    setQ('')
    navigate({ q: undefined })
  }

  const clearFilter = () => {
    setFilterColumn('')
    setFilterValue('')
    setFilterOp('contains')
    navigate({
      filterColumn: undefined,
      filterValue: undefined,
      filterOp: undefined,
    })
  }

  const clearAll = () => {
    setQ('')
    setFilterColumn('')
    setFilterValue('')
    setFilterOp('contains')
    navigate({
      q: undefined,
      filterColumn: undefined,
      filterValue: undefined,
      filterOp: undefined,
    })
  }

  return (
    <div className="browse-filters">
      <div className="browse-filters-section">
        <p className="browse-filters-heading">Search</p>
        <form
          className="browse-filters-row"
          onSubmit={(event) => {
            event.preventDefault()
            applySearch()
          }}
        >
          <div className="browse-filters-input-wrap">
            <Search aria-hidden="true" />
            <Input
              id="table-browse-search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search all columns..."
              aria-label="Search all columns"
            />
          </div>
          <Button type="submit" size="default" className="browse-filters-action">
            Search
          </Button>
        </form>
      </div>

      <div className="browse-filters-section">
        <p className="browse-filters-heading">Filter</p>
        <form
          className="browse-filters-filter-grid"
          onSubmit={(event) => {
            event.preventDefault()
            applyFilter()
          }}
        >
          <NativeSelect
            id="table-browse-filter-column"
            value={filterColumn}
            onChange={(event) => setFilterColumn(event.target.value)}
            aria-label="Filter column"
          >
            <option value="">Column</option>
            {columns.map((column) => (
              <option key={column.name} value={column.name}>
                {column.name}
              </option>
            ))}
          </NativeSelect>

          <NativeSelect
            id="table-browse-filter-op"
            value={filterOp}
            onChange={(event) =>
              setFilterOp(event.target.value as 'eq' | 'contains')
            }
            aria-label="Filter match type"
          >
            <option value="contains">Contains</option>
            <option value="eq">Equals</option>
          </NativeSelect>

          <div className="browse-filters-input-wrap">
            <Filter aria-hidden="true" />
            <Input
              id="table-browse-filter-value"
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              placeholder="Value"
              className="field-mono"
              aria-label="Filter value"
              disabled={!filterColumn}
            />
          </div>

          <Button
            type="submit"
            variant="outline"
            size="default"
            className="browse-filters-action"
            disabled={!canApplyFilter}
          >
            Filter
          </Button>
        </form>
      </div>

      {hasActiveQuery ? (
        <div className="browse-filters-active">
          <div className="browse-filters-chips">
            {hasActiveSearch ? (
              <span className="browse-filters-chip">
                <span>
                  Search:{' '}
                  <span className="browse-filters-chip-value">{browse.q}</span>
                </span>
                <button
                  type="button"
                  className="browse-filters-chip-remove"
                  aria-label="Clear search"
                  onClick={clearSearch}
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}
            {hasActiveFilter ? (
              <span className="browse-filters-chip">
                <span>
                  <span className="browse-filters-chip-value">
                    {browse.filterColumn}{' '}
                    {browse.filterOp === 'contains' ? 'contains' : '='}{' '}
                    {browse.filterValue}
                  </span>
                </span>
                <button
                  type="button"
                  className="browse-filters-chip-remove"
                  aria-label="Clear filter"
                  onClick={clearFilter}
                >
                  <X className="size-3" />
                </button>
              </span>
            ) : null}
          </div>
          {hasActiveSearch && hasActiveFilter ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
              Clear all
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
