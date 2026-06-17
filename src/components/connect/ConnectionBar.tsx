import { Link } from '@tanstack/react-router'
import { ArrowLeft, Database } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import type { ConnectionProfile } from '#/lib/connections/types'

type ConnectionBarProps = {
  connection: ConnectionProfile
  database?: string
}

export function ConnectionBar({ connection, database }: ConnectionBarProps) {
  const activeDatabase = database ?? connection.defaultDatabase

  return (
    <div className="border-b border-border bg-muted/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="size-4" />
            Connections
          </Link>
        </Button>

        <div className="flex min-w-0 items-center gap-2">
          <Database className="size-4 shrink-0 text-brand" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {connection.name}
            </p>
            <p className="truncate font-mono text-xs text-muted-foreground">
              {connection.username}@{connection.host}:{connection.port}/
              {activeDatabase}
            </p>
          </div>
        </div>

        {connection.readOnly ? (
          <Badge variant="secondary">Read-only</Badge>
        ) : null}
      </div>
    </div>
  )
}
