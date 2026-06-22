import { createCsrfMiddleware, createStart } from '@tanstack/react-start'

import { requireAuthFunctionMiddleware } from '#/lib/auth/middleware'

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware],
  functionMiddleware: [requireAuthFunctionMiddleware],
}))
