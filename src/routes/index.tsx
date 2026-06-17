import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'

import { ConnectionCard } from '#/components/connections/ConnectionCard'
import { Button } from '#/components/ui/button'
import { listConnections } from '#/server/connections'

export const Route = createFileRoute('/')({
  component: ConnectionsPage,
  loader: async () => await listConnections(),
})

function ConnectionsPage() {
  const connections = Route.useLoaderData()

  return (
    <main className="page-wrap px-4 pb-10 pt-10">
      <section className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="island-kicker">Postgres administration</p>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            pno-table
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            A phpMyAdmin-inspired Postgres admin with a modern workflow. Save
            connections, then browse and edit table data, manage databases, and
            configure users.
          </p>
        </div>
        <Button asChild size="lg">
          <Link to="/connections/new">
            <Plus className="size-4" />
            New connection
          </Link>
        </Button>
      </section>

      {connections.length === 0 ? (
        <section className="island-shell rounded-xl border border-dashed p-10 text-center">
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            No connections yet
          </h2>
          <p className="mx-auto mb-6 max-w-lg text-sm text-muted-foreground">
            Add your first Postgres server to get started. Credentials are
            encrypted locally with your <code>PNO_MASTER_KEY</code>.
          </p>
          <Button asChild>
            <Link to="/connections/new">
              <Plus className="size-4" />
              Add connection
            </Link>
          </Button>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2">
          {connections.map((connection) => (
            <ConnectionCard key={connection.id} connection={connection} />
          ))}
        </section>
      )}
    </main>
  )
}
