import { Link, useNavigate } from '@tanstack/react-router'
import { LogOut } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { defaultAuthStatus, type AuthStatus } from '#/lib/auth/types'
import { logout } from '#/server/auth'

type HeaderProps = {
  auth?: AuthStatus
}

export default function Header({ auth = defaultAuthStatus }: HeaderProps) {
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    await navigate({ to: '/login' })
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-card shadow-sm">
      <nav className="page-wrap flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <h2 className="m-0 flex-shrink-0 text-base font-semibold tracking-tight">
          <Link
            to="/"
            className="text-foreground no-underline hover:text-muted-foreground"
          >
            pno-table
          </Link>
        </h2>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm font-medium">
          <Link
            to="/"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            Connections
          </Link>
          <Link
            to="/connections/new"
            className="nav-link"
            activeProps={{ className: 'nav-link is-active' }}
          >
            New connection
          </Link>
        </div>

        {auth.enabled && auth.authenticated ? (
          <div className="ml-auto">
            <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="size-4" />
              Sign out
            </Button>
          </div>
        ) : null}
      </nav>
    </header>
  )
}
