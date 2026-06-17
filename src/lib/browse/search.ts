import { z } from 'zod'

export const tableBrowseSearchSchema = z.object({
  page: z.coerce.number().int().min(1).catch(1),
  pageSize: z.coerce.number().int().min(1).max(500).catch(50),
  sort: z.string().optional(),
  dir: z.enum(['asc', 'desc']).catch('asc'),
  filterColumn: z.string().optional(),
  filterValue: z.string().optional(),
})

export type TableBrowseSearch = z.infer<typeof tableBrowseSearchSchema>
