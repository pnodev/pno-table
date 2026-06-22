export const SIDEBAR_REFRESH_EVENT = 'pno-table:sidebar-refresh'

type SidebarRefreshDetail = {
  connectionId?: string
}

export function emitSidebarRefresh(detail: SidebarRefreshDetail = {}) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent<SidebarRefreshDetail>(SIDEBAR_REFRESH_EVENT, { detail }))
}

