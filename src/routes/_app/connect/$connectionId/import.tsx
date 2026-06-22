import { createFileRoute } from '@tanstack/react-router'

import { ImportWizard } from '#/components/admin/ImportWizard'
import { connectRouteApi } from '#/lib/connect/route-api'
import { fetchDatabaseDetails } from '#/server/admin'

export const Route = createFileRoute('/_app/connect/$connectionId/import')({
  component: ImportPage,
  loader: async ({ params }) => {
    const databases = await fetchDatabaseDetails({
      data: { connectionId: params.connectionId },
    })

    return { databases }
  },
})

function ImportPage() {
  const { connection } = connectRouteApi.useLoaderData()
  const { databases } = Route.useLoaderData()
  const params = Route.useParams()

  return (
    <ImportWizard
      connectionId={params.connectionId}
      readOnly={connection.readOnly}
      initialDatabases={databases}
    />
  )
}
