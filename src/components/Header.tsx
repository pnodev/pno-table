import { Link } from '@tanstack/react-router'

export default function Header() {
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
      </nav>
    </header>
  )
}
