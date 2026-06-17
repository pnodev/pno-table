import { Link, useRouterState } from '@tanstack/react-router'
import { ArrowLeft, Database } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import {
  SegmentTab,
  SegmentTabs,
  SegmentTabsBar,
} from '#/components/ui/nav-patterns'
import type { ConnectionProfile } from '#/lib/connections/types'

type ConnectionBarProps = {
  connection: ConnectionProfile
  database?: string
}

export function ConnectionBar({ connection, database }: ConnectionBarProps) {
  const activeDatabase = database ?? connection.defaultDatabase
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  const databasesActive = pathname.endsWith('/databases')
  const usersActive = pathname.endsWith('/users')
  const browseActive = !databasesActive && !usersActive

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

        <SegmentTabsBar className="ml-auto">
          <SegmentTabs>
            <SegmentTab
              to="/connect/$connectionId"
              params={{ connectionId: connection.id }}
              active={browseActive}
            >
              Browse
            </SegmentTab>
            <SegmentTab
              to="/connect/$connectionId/databases"
              params={{ connectionId: connection.id }}
              active={databasesActive}
            >
              Databases
            </SegmentTab>
            <SegmentTab
              to="/connect/$connectionId/users"
              params={{ connectionId: connection.id }}
              active={usersActive}
            >
              Users
            </SegmentTab>
          </SegmentTabs>
        </SegmentTabsBar>
      </div>
    </div>
  )
}
