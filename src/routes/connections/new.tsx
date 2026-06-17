import { createFileRoute } from '@tanstack/react-router'

import { ConnectionForm } from '#/components/connections/ConnectionForm'

export const Route = createFileRoute('/connections/new')({
  component: NewConnectionPage,
})

function NewConnectionPage() {
  return (
    <main className="page-wrap px-4 pb-10 pt-10">
      <section className="content-panel rounded-xl p-6 sm:p-8">
        <div className="mb-8 space-y-2">
          <p className="island-kicker">Connections</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            New connection
          </h1>
          <p className="text-sm text-muted-foreground">
            Store Postgres credentials locally. Test before saving to confirm
            host, SSL, and database settings.
          </p>
        </div>
        <ConnectionForm mode="create" />
      </section>
    </main>
  )
}
