import { createFileRoute } from '@tanstack/react-router'
import { Table2 } from 'lucide-react'

import { connectRouteApi } from '#/lib/connect/route-api'

export const Route = createFileRoute('/connect/$connectionId/')({
  component: ConnectHomePage,
})

function ConnectHomePage() {
  const { connection } = connectRouteApi.useLoaderData()

  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg border border-border bg-muted">
          <Table2 className="size-5 text-brand" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">
          Connected to {connection.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Expand a database in the sidebar, then pick a schema and table to
          browse data or view structure.
        </p>
      </div>
    </div>
  )
}
