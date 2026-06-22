import type { ReactNode } from 'react'
import {
  type LayoutStorage,
  useDefaultLayout,
} from 'react-resizable-panels'

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '#/components/ui/resizable'
import { useMediaQuery } from '#/hooks/use-media-query'

const SIDEBAR_PANEL_ID = 'sidebar'
const MAIN_PANEL_ID = 'main'

// Pixel widths — keep in sync with --sidebar-width-* in styles.css
const SIDEBAR_WIDTH_DEFAULT = 280
const SIDEBAR_WIDTH_MIN = 200
const SIDEBAR_WIDTH_MAX = 480

const panelLayoutStorage: LayoutStorage = {
  getItem(key) {
    if (typeof window === 'undefined') return null
    return localStorage.getItem(key)
  },
  setItem(key, value) {
    if (typeof window === 'undefined') return
    localStorage.setItem(key, value)
  },
}

type SidebarLayoutProps = {
  layoutId: string
  sidebar: ReactNode
  children: ReactNode
}

export function SidebarLayout({
  layoutId,
  sidebar,
  children,
}: SidebarLayoutProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: layoutId,
    panelIds: [SIDEBAR_PANEL_ID, MAIN_PANEL_ID],
    storage: panelLayoutStorage,
  })

  if (!isDesktop) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {sidebar}
        <div className="min-h-0 flex-1 overflow-auto border-t border-border bg-card">
          {children}
        </div>
      </div>
    )
  }

  return (
    <ResizablePanelGroup
      id={layoutId}
      className="min-h-0 flex-1"
      defaultLayout={defaultLayout}
      onLayoutChanged={onLayoutChanged}
    >
      <ResizablePanel
        id={SIDEBAR_PANEL_ID}
        defaultSize={SIDEBAR_WIDTH_DEFAULT}
        minSize={SIDEBAR_WIDTH_MIN}
        maxSize={SIDEBAR_WIDTH_MAX}
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0"
      >
        {sidebar}
      </ResizablePanel>

      <ResizableHandle title="Drag to resize. Double-click to reset." />

      <ResizablePanel id={MAIN_PANEL_ID} minSize={30} className="min-h-0">
        <div className="h-full min-h-0 overflow-auto bg-card">{children}</div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
