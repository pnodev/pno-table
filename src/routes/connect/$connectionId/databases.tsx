import { createFileRoute } from '@tanstack/react-router'

import { DatabaseManager } from '#/components/admin/DatabaseManager'
import { connectRouteApi } from '#/lib/connect/route-api'
import { fetchDatabaseDetails } from '#/server/admin'

export const Route = createFileRoute('/connect/$connectionId/databases')({
  component: DatabasesPage,
  loader: async ({ params }) => {
    const databases = await fetchDatabaseDetails({
      data: { connectionId: params.connectionId },
    })

    return { databases }
  },
})

function DatabasesPage() {
  const { connection } = connectRouteApi.useLoaderData()
  const { databases } = Route.useLoaderData()
  const params = Route.useParams()

  return (
    <DatabaseManager
      connectionId={params.connectionId}
      readOnly={connection.readOnly}
      initialDatabases={databases}
    />
  )
}
