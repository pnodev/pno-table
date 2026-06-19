import { createStart } from '@tanstack/react-start'

import { requireAuthFunctionMiddleware } from '#/lib/auth/middleware'

export const startInstance = createStart(() => ({
  functionMiddleware: [requireAuthFunctionMiddleware],
}))
