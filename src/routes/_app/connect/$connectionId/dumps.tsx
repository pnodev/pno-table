import { createFileRoute } from '@tanstack/react-router'

import { DumpManager } from '#/components/admin/DumpManager'
import { connectRouteApi } from '#/lib/connect/route-api'
import { fetchDatabaseDetails } from '#/server/admin'

export const Route = createFileRoute('/_app/connect/$connectionId/dumps')({
  component: DumpsPage,
  loader: async ({ params }) => {
    const databases = await fetchDatabaseDetails({
      data: { connectionId: params.connectionId },
    })

    return { databases }
  },
})

function DumpsPage() {
  const { connection } = connectRouteApi.useLoaderData()
  const { databases } = Route.useLoaderData()
  const params = Route.useParams()

  return (
    <DumpManager
      connectionId={params.connectionId}
      readOnly={connection.readOnly}
      initialDatabases={databases}
    />
  )
}
