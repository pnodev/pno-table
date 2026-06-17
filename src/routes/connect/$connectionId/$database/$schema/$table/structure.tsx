import { createFileRoute } from '@tanstack/react-router'

import { TableTabs } from '#/components/connect/TableTabs'
import { StructureView } from '#/components/structure/StructureView'
import { fetchTableStructure } from '#/server/browse'

export const Route = createFileRoute(
  '/connect/$connectionId/$database/$schema/$table/structure',
)({
  loader: async ({ params }) => {
    const structure = await fetchTableStructure({
      data: {
        connectionId: params.connectionId,
        database: params.database,
        schema: params.schema,
        table: params.table,
      },
    })

    return { structure }
  },
  component: TableStructurePage,
})

function TableStructurePage() {
  const params = Route.useParams()
  const { structure } = Route.useLoaderData()

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
        active="structure"
      />

      <div className="p-4">
        <StructureView
          connectionId={params.connectionId}
          database={params.database}
          structure={structure}
        />
      </div>
    </div>
  )
}
