import { createFileRoute } from '@tanstack/react-router'

import { RoleManager } from '#/components/admin/RoleManager'
import { connectRouteApi } from '#/lib/connect/route-api'
import { fetchRoles } from '#/server/admin'

export const Route = createFileRoute('/_app/connect/$connectionId/users')({
  component: UsersPage,
  loader: async ({ params }) => {
    const roles = await fetchRoles({
      data: { connectionId: params.connectionId },
    })

    return { roles }
  },
})

function UsersPage() {
  const { connection } = connectRouteApi.useLoaderData()
  const { roles } = Route.useLoaderData()
  const params = Route.useParams()

  return (
    <RoleManager
      connectionId={params.connectionId}
      readOnly={connection.readOnly}
      initialRoles={roles}
    />
  )
}
