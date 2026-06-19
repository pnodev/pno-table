import { createFileRoute, Outlet } from '@tanstack/react-router'

import Header from '#/components/Header'
import { getAuthStatus } from '#/server/auth'

export const Route = createFileRoute('/_app')({
  loader: async () => ({
    auth: await getAuthStatus(),
  }),
  component: AppLayout,
})

function AppLayout() {
  const { auth } = Route.useLoaderData()

  return (
    <>
      <Header auth={auth} />
      <Outlet />
    </>
  )
}
