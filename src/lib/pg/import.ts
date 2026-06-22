import { spawn } from 'node:child_process'
import type pg from 'pg'

import type { PostgresConnectionConfig } from '#/lib/connections/types'
import {
  buildPgDumpArgs,
  buildPsqlArgs,
  type DumpExportOptions,
  type DumpImportOptions,
} from '#/lib/pg/dump'
import { quoteIdentifier, quoteQualifiedName } from '#/lib/pg/identifiers'
import type {
  ImportRunOptions,
  ImportSelection,
} from '#/lib/pg/import-schemas'
import { listRelations, listSchemas } from '#/lib/pg/introspect'

export type ImportCatalogRelation = {
  schema: string
  name: string
  kind: 'table' | 'view'
}

export type ImportCatalogSchema = {
  name: string
  relations: ImportCatalogRelation[]
}

export type ImportPreview = {
  collisions: string[]
  warnings: string[]
  poolerWarning: string | null
}

function pgEnv(
  config: PostgresConnectionConfig,
  database: string,
): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PGHOST: config.host,
    PGPORT: String(config.port),
    PGUSER: config.username,
    PGPASSWORD: config.password,
    PGDATABASE: database,
    PGSSLMODE: config.sslMode,
  }
}

export function detectPoolerWarning(host: string): string | null {
  if (host.includes('-pooler') || host.includes('.pooler.')) {
    return 'This host looks like a connection pooler. pg_dump needs a direct database connection — use the non-pooler hostname from your provider.'
  }

  return null
}

export function buildImportPgDumpArgs(
  selection: ImportSelection,
  options: DumpExportOptions,
): string[] {
  const args = buildPgDumpArgs(options)

  if (selection.mode === 'schemas') {
    for (const schema of selection.schemas) {
      args.push('--schema', schema)
    }
  }

  if (selection.mode === 'tables') {
    for (const table of selection.tables) {
      args.push('--table', `${table.schema}.${table.name}`)
    }
  }

  return args
}

export async function listImportCatalog(
  client: pg.Client,
): Promise<ImportCatalogSchema[]> {
  const schemas = await listSchemas(client, '')

  return Promise.all(
    schemas.map(async (schema) => {
      const relations = await listRelations(client, schema.name)

      return {
        name: schema.name,
        relations: relations.map((relation) => ({
          schema: schema.name,
          name: relation.name,
          kind: relation.kind,
        })),
      }
    }),
  )
}

async function targetHasUserObjects(client: pg.Client): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(`
    select exists (
      select 1
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where n.nspname not like 'pg\\_%' escape '\\'
        and n.nspname <> 'information_schema'
        and c.relkind in ('r', 'v', 'p', 'f', 'm')
    ) as exists
  `)

  return result.rows[0]?.exists ?? false
}

async function schemaExists(
  client: pg.Client,
  schema: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      select exists (
        select 1
        from pg_catalog.pg_namespace
        where nspname = $1
      ) as exists
    `,
    [schema],
  )

  return result.rows[0]?.exists ?? false
}

async function tableExists(
  client: pg.Client,
  schema: string,
  table: string,
): Promise<boolean> {
  const result = await client.query<{ exists: boolean }>(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = $1
          and table_name = $2
          and table_type in ('BASE TABLE', 'VIEW')
      ) as exists
    `,
    [schema, table],
  )

  return result.rows[0]?.exists ?? false
}

export async function findImportCollisions(
  client: pg.Client,
  selection: ImportSelection,
): Promise<string[]> {
  const collisions: string[] = []

  if (selection.mode === 'database') {
    if (await targetHasUserObjects(client)) {
      collisions.push('Target database already contains schemas or tables')
    }

    return collisions
  }

  if (selection.mode === 'schemas') {
    for (const schema of selection.schemas) {
      if (await schemaExists(client, schema)) {
        collisions.push(`Schema "${schema}" already exists`)
      }
    }

    return collisions
  }

  for (const table of selection.tables) {
    if (await tableExists(client, table.schema, table.name)) {
      collisions.push(`Table "${table.schema}.${table.name}" already exists`)
    }
  }

  return collisions
}

export function buildImportPreview(
  sourceHost: string,
  collisions: string[],
): ImportPreview {
  const warnings: string[] = []

  if (collisions.length > 0) {
    warnings.push(
      'Import may fail or overwrite data unless you choose replace mode or use an empty target.',
    )
  }

  return {
    collisions,
    warnings,
    poolerWarning: detectPoolerWarning(sourceHost),
  }
}

async function dropImportTargets(
  client: pg.Client,
  selection: ImportSelection,
): Promise<void> {
  if (selection.mode === 'database') {
    const schemas = await listSchemas(client, '')

    for (const schema of schemas) {
      await client.query(
        `drop schema if exists ${quoteIdentifier(schema.name)} cascade`,
      )
    }

    return
  }

  if (selection.mode === 'schemas') {
    for (const schema of selection.schemas) {
      await client.query(
        `drop schema if exists ${quoteIdentifier(schema)} cascade`,
      )
    }

    return
  }

  for (const table of selection.tables) {
    await client.query(
      `drop table if exists ${quoteQualifiedName(table.schema, table.name)} cascade`,
    )
  }
}

export async function pipePgDumpToPsql(
  sourceConfig: PostgresConnectionConfig,
  sourceDatabase: string,
  targetConfig: PostgresConnectionConfig,
  targetDatabase: string,
  selection: ImportSelection,
  options: ImportRunOptions,
): Promise<void> {
  if (options.conflictMode === 'replace') {
    const { connectPgClient } = await import('#/lib/pg/resolve-connection')
    const { client } = await connectPgClient(targetConfig, targetDatabase)

    try {
      await dropImportTargets(client, selection)
    } finally {
      await client.end().catch(() => undefined)
    }
  }

  const dumpArgs = buildImportPgDumpArgs(selection, options)
  const psqlArgs = buildPsqlArgs({
    singleTransaction: options.singleTransaction,
    onErrorStop: options.onErrorStop,
  } satisfies DumpImportOptions)

  return new Promise((resolve, reject) => {
    const dump = spawn('pg_dump', dumpArgs, {
      env: pgEnv(sourceConfig, sourceDatabase),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const psql = spawn('psql', psqlArgs, {
      env: pgEnv(targetConfig, targetDatabase),
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let dumpStderr = ''
    let psqlStderr = ''

    dump.stderr.on('data', (chunk: Buffer | string) => {
      dumpStderr += chunk.toString()
    })

    psql.stderr.on('data', (chunk: Buffer | string) => {
      psqlStderr += chunk.toString()
    })

    const fail = (message: string) => {
      dump.kill('SIGTERM')
      psql.kill('SIGTERM')
      reject(new Error(message))
    }

    dump.on('error', (error) => {
      if ('code' in error && error.code === 'ENOENT') {
        fail(
          'pg_dump is not installed. Install the PostgreSQL client tools to use database import.',
        )
        return
      }

      fail(error.message)
    })

    psql.on('error', (error) => {
      if ('code' in error && error.code === 'ENOENT') {
        fail(
          'psql is not installed. Install the PostgreSQL client tools to use database import.',
        )
        return
      }

      fail(error.message)
    })

    dump.stdout.pipe(psql.stdin)

    dump.on('close', (code) => {
      if (code !== 0) {
        fail(dumpStderr.trim() || `pg_dump failed with exit code ${code}`)
      }
    })

    psql.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      fail(psqlStderr.trim() || `psql failed with exit code ${code}`)
    })
  })
}
