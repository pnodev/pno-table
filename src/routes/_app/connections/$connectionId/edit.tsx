import { createFileRoute, notFound } from '@tanstack/react-router'

import { ConnectionForm } from '#/components/connections/ConnectionForm'
import { getConnection } from '#/server/connections'

export const Route = createFileRoute('/_app/connections/$connectionId/edit')({
  component: EditConnectionPage,
  loader: async ({ params }) => {
    const connection = await getConnection({ data: { id: params.connectionId } })

    if (!connection) {
      throw notFound()
    }

    return connection
  },
})

function EditConnectionPage() {
  const connection = Route.useLoaderData()

  return (
    <main className="page-wrap px-4 pb-10 pt-10">
      <section className="content-panel rounded-xl p-6 sm:p-8">
        <div className="mb-8 space-y-2">
          <p className="island-kicker">Connections</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Edit connection
          </h1>
          <p className="text-sm text-muted-foreground">
            Update settings for <strong>{connection.name}</strong>.
          </p>
        </div>
        <ConnectionForm mode="edit" initialValues={connection} />
      </section>
    </main>
  )
}
