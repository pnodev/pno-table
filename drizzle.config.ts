import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: ['.env.local', '.env'] })

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.PNO_DATA_DIR
      ? `${process.env.PNO_DATA_DIR}/pno-table.sqlite`
      : './data/pno-table.sqlite',
  },
})
