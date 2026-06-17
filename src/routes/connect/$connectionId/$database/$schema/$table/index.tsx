import { createFileRoute } from '@tanstack/react-router'

import { DataGrid } from '#/components/browse/DataGrid'
import { TableTabs } from '#/components/connect/TableTabs'
import { tableBrowseSearchSchema } from '#/lib/browse/search'
import { connectRouteApi } from '#/lib/connect/route-api'
import { fetchTableBrowse, fetchTableStructure } from '#/server/browse'

export const Route = createFileRoute(
  '/connect/$connectionId/$database/$schema/$table/',
)({
  validateSearch: tableBrowseSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps: search }) => {
    const [browse, structure] = await Promise.all([
      fetchTableBrowse({
        data: {
          connectionId: params.connectionId,
          database: params.database,
          schema: params.schema,
          table: params.table,
          page: search.page,
          pageSize: search.pageSize,
          sortColumn: search.sort ?? null,
          sortDirection: search.dir,
          q: search.q ?? null,
          filterColumn: search.filterColumn ?? null,
          filterValue: search.filterValue ?? null,
          filterOp: search.filterOp ?? 'eq',
        },
      }),
      fetchTableStructure({
        data: {
          connectionId: params.connectionId,
          database: params.database,
          schema: params.schema,
          table: params.table,
        },
      }),
    ])

    return { browse, structure }
  },
  component: TableBrowsePage,
})

function TableBrowsePage() {
  const { connection } = connectRouteApi.useLoaderData()
  const params = Route.useParams()
  const { browse, structure } = Route.useLoaderData()

  return (
    <div className="flex min-h-full flex-col">
      <div className="border-b border-border bg-card px-4 py-3">
        <h1 className="font-mono text-lg font-semibold text-foreground">
          {params.schema}.{params.table}
        </h1>
      </div>

      <TableTabs
        connectionId={params.connectionId}
        database={params.database}
        schema={params.schema}
        table={params.table}
        active="browse"
      />

      <div className="p-4">
        <DataGrid
          connectionId={params.connectionId}
          database={params.database}
          schema={params.schema}
          table={params.table}
          browse={browse}
          columns={structure.columns}
          foreignKeys={structure.foreignKeys}
          readOnly={connection.readOnly}
          primaryKeyColumns={structure.primaryKeyColumns}
        />
      </div>
    </div>
  )
}
