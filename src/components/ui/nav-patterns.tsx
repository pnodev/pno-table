import type { LinkProps } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'

import { cn } from '#/lib/utils'

type SegmentTabProps = {
  to: LinkProps['to']
  params?: LinkProps['params']
  active?: boolean
  children: React.ReactNode
}

export function SegmentTabsBar({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div className={cn('segment-tabs-bar', className)} {...props}>
      {children}
    </div>
  )
}

export function SegmentTabs({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div className={cn('segment-tabs', className)} {...props}>
      {children}
    </div>
  )
}

export function SegmentTab({
  to,
  params,
  active = false,
  children,
}: SegmentTabProps) {
  return (
    <Link
      to={to}
      params={params}
      className={cn('segment-tab', active && 'segment-tab-active')}
    >
      {children}
    </Link>
  )
}

export function SidebarLink({
  to,
  params,
  active = false,
  children,
  className,
}: SegmentTabProps & { className?: string }) {
  return (
    <Link
      to={to}
      params={params}
      className={cn('sidebar-link', active && 'sidebar-link-active', className)}
    >
      {children}
    </Link>
  )
}
