import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

import type { TableBrowseSearch } from '#/lib/browse/search'

type RelationCellLinkProps = {
  connectionId: string
  database: string
  schema: string
  table: string
  filterColumn: string
  filterValue: string
  pageSize: number
  title: string
  children: ReactNode
  className?: string
}

function relationBrowseSearch(
  filterColumn: string,
  filterValue: string,
  pageSize: number,
): TableBrowseSearch {
  return {
    page: 1,
    pageSize,
    dir: 'asc',
    filterColumn,
    filterValue,
  }
}

export function RelationCellLink({
  connectionId,
  database,
  schema,
  table,
  filterColumn,
  filterValue,
  pageSize,
  title,
  children,
  className,
}: RelationCellLinkProps) {
  return (
    <Link
      to="/connect/$connectionId/$database/$schema/$table"
      params={{
        connectionId,
        database,
        schema,
        table,
      }}
      search={relationBrowseSearch(filterColumn, filterValue, pageSize)}
      title={title}
      className={className ?? 'relation-cell-link'}
    >
      {children}
    </Link>
  )
}
