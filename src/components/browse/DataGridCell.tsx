import type { ReactNode } from 'react'

import { RelationCellLink } from '#/components/browse/RelationCellLink'
import type { LinkableRelation } from '#/lib/pg/catalog-types'
import { formatForeignKeyOptionValue } from '#/lib/pg/foreign-keys'
import { parseCellUrl } from '#/lib/url/detect-url'

type DataGridCellProps = {
  connectionId: string
  database: string
  pageSize: number
  rawValue: unknown
  display: string
  title: string
  hasRelationLabel: boolean
  linkable?: LinkableRelation
  onPreviewUrl: (url: string) => void
}

function CellContent({
  children,
  monospace = false,
}: {
  children: ReactNode
  monospace?: boolean
}) {
  return (
    <span className={monospace ? 'font-mono' : undefined}>{children}</span>
  )
}

export function DataGridCell({
  connectionId,
  database,
  pageSize,
  rawValue,
  display,
  title,
  hasRelationLabel,
  linkable,
  onPreviewUrl,
}: DataGridCellProps) {
  const filterValue =
    linkable && rawValue !== null && rawValue !== undefined
      ? formatForeignKeyOptionValue(rawValue)
      : ''
  const content = (
    <CellContent monospace={!hasRelationLabel && !linkable}>
      {display}
    </CellContent>
  )

  if (linkable && filterValue) {
    return (
      <RelationCellLink
        connectionId={connectionId}
        database={database}
        schema={linkable.referencedSchema}
        table={linkable.referencedTable}
        filterColumn={linkable.filterColumn}
        filterValue={filterValue}
        pageSize={pageSize}
        title={`Open ${linkable.referencedSchema}.${linkable.referencedTable} where ${linkable.filterColumn} = ${filterValue}`}
      >
        {content}
      </RelationCellLink>
    )
  }

  const url = parseCellUrl(rawValue)

  if (url) {
    return (
      <button
        type="button"
        className="url-cell-link"
        title={`${title}\nClick to preview`}
        onClick={() => onPreviewUrl(url)}
      >
        {content}
      </button>
    )
  }

  return content
}
