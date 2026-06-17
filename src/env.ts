import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
  server: {
    PNO_MASTER_KEY: z
      .string()
      .min(16, 'PNO_MASTER_KEY must be at least 16 characters'),
    PNO_DATA_DIR: z.string().default('./data'),
  },

  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
  },

  runtimeEnv: {
    PNO_MASTER_KEY: process.env.PNO_MASTER_KEY,
    PNO_DATA_DIR: process.env.PNO_DATA_DIR,
    VITE_APP_TITLE: import.meta.env.VITE_APP_TITLE,
  },

  emptyStringAsUndefined: true,
})
