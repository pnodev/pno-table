import { z } from 'zod'

import type { BrowseTableResult } from '#/lib/pg/catalog-types'

export const tableBrowseSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(500).catch(50),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).catch('asc'),
  q: z.string().optional(),
  filterColumn: z.string().optional(),
  filterValue: z.string().optional(),
  filterOp: z.enum(['eq', 'contains']).optional(),
})

export type TableBrowseSearch = z.infer<typeof tableBrowseSearchSchema>

type BrowseSearchState = Pick<
  BrowseTableResult,
  | 'page'
  | 'pageSize'
  | 'sortColumn'
  | 'sortDirection'
  | 'q'
  | 'filterColumn'
  | 'filterValue'
  | 'filterOp'
>

export function tableBrowseSearch(
  browse: BrowseSearchState,
  overrides: Partial<TableBrowseSearch> = {},
): TableBrowseSearch {
  return {
    page: browse.page,
    pageSize: browse.pageSize,
    dir: browse.sortDirection,
    sort: browse.sortColumn ?? undefined,
    q: browse.q ?? undefined,
    filterColumn: browse.filterColumn ?? undefined,
    filterValue: browse.filterValue ?? undefined,
    filterOp: browse.filterOp === 'contains' ? 'contains' : undefined,
    ...overrides,
  }
}
