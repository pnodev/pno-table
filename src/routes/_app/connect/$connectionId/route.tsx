import {
  createFileRoute,
  notFound,
  Outlet,
  useMatches,
} from '@tanstack/react-router'

import { ConnectionBar } from '#/components/connect/ConnectionBar'
import { DatabaseTree } from '#/components/connect/DatabaseTree'
import { connectRouteApi } from '#/lib/connect/route-api'
import { getConnection } from '#/server/connections'

export const Route = createFileRoute('/_app/connect/$connectionId')({
  component: ConnectLayout,
  loader: async ({ params }) => {
    const connection = await getConnection({
      data: { id: params.connectionId },
    })

    if (!connection) {
      throw notFound()
    }

    return { connection }
  },
})

function ConnectLayout() {
  const { connection } = connectRouteApi.useLoaderData()
  const params = Route.useParams()
  const matches = useMatches()

  const tableMatch = [...matches]
    .reverse()
    .find((match) => 'database' in (match.params ?? {}))

  const tableParams = tableMatch?.params as
    | {
        database?: string
        schema?: string
        table?: string
      }
    | undefined

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      <ConnectionBar
        connection={connection}
        database={tableParams?.database}
      />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <DatabaseTree
          connectionId={params.connectionId}
          activeDatabase={tableParams?.database}
          activeSchema={tableParams?.schema}
          activeTable={tableParams?.table}
        />

        <div className="min-h-0 overflow-auto border-l border-border bg-card">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
