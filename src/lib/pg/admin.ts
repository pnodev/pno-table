import type pg from 'pg'

import type { DatabaseDetails, RoleDatabaseAccess, RoleInfo } from '#/lib/pg/catalog-types'
import {
  quoteIdentifier,
  quoteQualifiedName,
  quoteStringLiteral,
} from '#/lib/pg/identifiers'

const USER_SCHEMA_SQL = `
  n.nspname not like 'pg\\_%' escape '\\'
  and n.nspname <> 'information_schema'
`

export async function listDatabaseDetails(
  client: pg.Client,
): Promise<DatabaseDetails[]> {
  const result = await client.query<{
    name: string
    owner: string
    encoding: string
    collation: string
    size_bytes: string
    is_template: boolean
    allow_connections: boolean
  }>(`
    select
      d.datname as name,
      pg_catalog.pg_get_userbyid(d.datdba) as owner,
      pg_catalog.pg_encoding_to_char(d.encoding) as encoding,
      d.datcollate as collation,
      pg_catalog.pg_database_size(d.datname) as size_bytes,
      d.datistemplate as is_template,
      d.datallowconn as allow_connections
    from pg_catalog.pg_database d
    where not d.datistemplate
    order by d.datname
  `)

  return result.rows.map((row) => ({
    name: row.name,
    owner: row.owner,
    encoding: row.encoding,
    collation: row.collation,
    sizeBytes: Number(row.size_bytes),
    isTemplate: row.is_template,
    allowConnections: row.allow_connections,
  }))
}

export async function listRoleNames(client: pg.Client): Promise<string[]> {
  const result = await client.query<{ name: string }>(`
    select rolname as name
    from pg_catalog.pg_roles
    order by rolname
  `)

  return result.rows.map((row) => row.name)
}

export async function listRoles(client: pg.Client): Promise<RoleInfo[]> {
  const result = await client.query<{
    name: string
    oid: number
    is_superuser: boolean
    can_login: boolean
    can_create_db: boolean
    can_create_role: boolean
    is_replication: boolean
    bypass_rls: boolean
    connection_limit: number
    valid_until: Date | null
  }>(`
    select
      r.rolname as name,
      r.oid,
      r.rolsuper as is_superuser,
      r.rolcanlogin as can_login,
      r.rolcreatedb as can_create_db,
      r.rolcreaterole as can_create_role,
      r.rolreplication as is_replication,
      r.rolbypassrls as bypass_rls,
      r.rolconnlimit as connection_limit,
      r.rolvaliduntil as valid_until
    from pg_catalog.pg_roles r
    order by r.rolname
  `)

  const memberships = await client.query<{
    role_name: string
    member_of: string
  }>(`
    select
      member.rolname as role_name,
      parent.rolname as member_of
    from pg_catalog.pg_auth_members am
    join pg_catalog.pg_roles member on member.oid = am.member
    join pg_catalog.pg_roles parent on parent.oid = am.roleid
    order by member.rolname, parent.rolname
  `)

  const memberOfByRole = new Map<string, string[]>()

  for (const row of memberships.rows) {
    const current = memberOfByRole.get(row.role_name) ?? []
    current.push(row.member_of)
    memberOfByRole.set(row.role_name, current)
  }

  return result.rows.map((row) => ({
    name: row.name,
    oid: row.oid,
    isSuperuser: row.is_superuser,
    canLogin: row.can_login,
    canCreateDb: row.can_create_db,
    canCreateRole: row.can_create_role,
    isReplication: row.is_replication,
    bypassRls: row.bypass_rls,
    connectionLimit: row.connection_limit,
    validUntil: row.valid_until ? row.valid_until.toISOString() : null,
    memberOf: memberOfByRole.get(row.name) ?? [],
  }))
}

type CreateDatabaseOptions = {
  name: string
  owner?: string
  encoding?: string
  template?: string
}

export async function createDatabase(
  client: pg.Client,
  options: CreateDatabaseOptions,
): Promise<void> {
  const parts = [`create database ${quoteIdentifier(options.name)}`]
  const withParts: string[] = []

  if (options.owner) {
    withParts.push(`owner = ${quoteIdentifier(options.owner)}`)
  }

  if (options.encoding) {
    withParts.push(`encoding = '${options.encoding.replaceAll("'", "''")}'`)
  }

  if (options.template) {
    withParts.push(`template = ${quoteIdentifier(options.template)}`)
  }

  if (withParts.length > 0) {
    parts.push(`with ${withParts.join(' ')}`)
  }

  await client.query(parts.join(' '))
}

async function terminateOtherBackends(client: pg.Client): Promise<void> {
  await client.query(`
    select pg_catalog.pg_terminate_backend(pid)
    from pg_catalog.pg_stat_activity
    where datname = pg_catalog.current_database()
      and pid <> pg_catalog.pg_backend_pid()
  `)
}

async function listUserTableQualifiedNames(client: pg.Client): Promise<string[]> {
  const result = await client.query<{ schema_name: string; table_name: string }>(
    `
      select
        n.nspname as schema_name,
        c.relname as table_name
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      where ${USER_SCHEMA_SQL}
        and c.relkind in ('r', 'p')
      order by n.nspname, c.relname
    `,
  )

  return result.rows.map((row) =>
    quoteQualifiedName(row.schema_name, row.table_name),
  )
}

export async function truncateDatabase(client: pg.Client): Promise<void> {
  await terminateOtherBackends(client)

  const tables = await listUserTableQualifiedNames(client)

  if (tables.length === 0) {
    return
  }

  await client.query(
    `truncate table ${tables.join(', ')} restart identity cascade`,
  )
}

export async function emptyDatabase(client: pg.Client): Promise<void> {
  await terminateOtherBackends(client)

  await client.query(`
    do $do$
    declare
      obj record;
    begin
      for obj in
        select
          n.nspname as schema_name,
          c.relname as object_name,
          c.relkind as kind
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        where ${USER_SCHEMA_SQL}
          and c.relkind in ('v', 'm', 'r', 'p', 'f', 'S')
          and not (
            c.relkind = 'S'
            and exists (
              select 1
              from pg_catalog.pg_depend d
              where d.classid = 'pg_class'::regclass
                and d.objid = c.oid
                and d.deptype = 'a'
                and d.refclassid = 'pg_class'::regclass
            )
          )
        order by
          case c.relkind
            when 'v' then 1
            when 'm' then 2
            when 'r' then 3
            when 'p' then 3
            when 'f' then 3
            when 'S' then 4
          end,
          n.nspname,
          c.relname
      loop
        case obj.kind
          when 'v' then
            execute format(
              'drop view if exists %I.%I cascade',
              obj.schema_name,
              obj.object_name
            );
          when 'm' then
            execute format(
              'drop materialized view if exists %I.%I cascade',
              obj.schema_name,
              obj.object_name
            );
          when 'r', 'p' then
            execute format(
              'drop table if exists %I.%I cascade',
              obj.schema_name,
              obj.object_name
            );
          when 'f' then
            execute format(
              'drop foreign table if exists %I.%I cascade',
              obj.schema_name,
              obj.object_name
            );
          when 'S' then
            execute format(
              'drop sequence if exists %I.%I cascade',
              obj.schema_name,
              obj.object_name
            );
        end case;
      end loop;
    end
    $do$
  `)
}

export async function dropDatabase(
  client: pg.Client,
  name: string,
): Promise<void> {
  await client.query(
    `
      select pg_catalog.pg_terminate_backend(pid)
      from pg_catalog.pg_stat_activity
      where datname = $1
        and pid <> pg_catalog.pg_backend_pid()
    `,
    [name],
  )

  await client.query(`drop database ${quoteIdentifier(name)}`)
}

type RoleOptions = {
  login?: boolean
  superuser?: boolean
  createdb?: boolean
  createrole?: boolean
  replication?: boolean
  bypassRls?: boolean
  connectionLimit?: number
}

function buildRoleOptionsClause(options: RoleOptions): string {
  const parts: string[] = []

  if (options.login !== undefined) {
    parts.push(options.login ? 'login' : 'nologin')
  }

  if (options.superuser !== undefined) {
    parts.push(options.superuser ? 'superuser' : 'nosuperuser')
  }

  if (options.createdb !== undefined) {
    parts.push(options.createdb ? 'createdb' : 'nocreatedb')
  }

  if (options.createrole !== undefined) {
    parts.push(options.createrole ? 'createrole' : 'nocreaterole')
  }

  if (options.replication !== undefined) {
    parts.push(options.replication ? 'replication' : 'noreplication')
  }

  if (options.bypassRls !== undefined) {
    parts.push(options.bypassRls ? 'bypassrls' : 'nobypassrls')
  }

  if (options.connectionLimit !== undefined) {
    parts.push(`connection limit ${options.connectionLimit}`)
  }

  return parts.join(' ')
}

export async function createRole(
  client: pg.Client,
  name: string,
  options: RoleOptions & { password?: string },
): Promise<void> {
  const optionClause = buildRoleOptionsClause(options)

  if (options.password) {
    const passwordLiteral = quoteStringLiteral(options.password)
    await client.query(
      `create role ${quoteIdentifier(name)} with ${optionClause} password ${passwordLiteral}`,
    )
    return
  }

  await client.query(
    `create role ${quoteIdentifier(name)}${optionClause ? ` with ${optionClause}` : ''}`,
  )
}

export async function updateRole(
  client: pg.Client,
  name: string,
  options: RoleOptions & { password?: string },
): Promise<void> {
  const optionClause = buildRoleOptionsClause(options)

  if (options.password) {
    const passwordLiteral = quoteStringLiteral(options.password)
    await client.query(
      `alter role ${quoteIdentifier(name)} with ${optionClause} password ${passwordLiteral}`,
    )
    return
  }

  if (!optionClause) {
    throw new Error('No role changes provided')
  }

  await client.query(
    `alter role ${quoteIdentifier(name)} with ${optionClause}`,
  )
}

export async function dropRole(client: pg.Client, name: string): Promise<void> {
  await client.query(`drop role ${quoteIdentifier(name)}`)
}

type DatabasePrivilege = 'CONNECT' | 'CREATE'

export function formatRoleSql(role: string): string {
  return role.toLowerCase() === 'public' ? 'PUBLIC' : quoteIdentifier(role)
}

export function buildDatabasePrivilegeStatement(
  action: 'grant' | 'revoke',
  privilege: DatabasePrivilege,
  database: string,
  role: string,
): string {
  const verb = action === 'grant' ? 'grant' : 'revoke'
  const roleSql = formatRoleSql(role)

  return `${verb} ${privilege} on database ${quoteIdentifier(database)} ${action === 'grant' ? 'to' : 'from'} ${roleSql}`
}

async function listGrantableSchemas(client: pg.Client): Promise<string[]> {
  const result = await client.query<{ name: string }>(`
    select n.nspname as name
    from pg_catalog.pg_namespace n
    where n.nspname not like 'pg\\_%' escape '\\'
      and n.nspname <> 'information_schema'
    order by n.nspname
  `)

  return result.rows.map((row) => row.name)
}

export async function grantDatabaseBrowseAccess(
  client: pg.Client,
  roleName: string,
): Promise<void> {
  const roleSql = formatRoleSql(roleName)
  const schemas = await listGrantableSchemas(client)

  for (const schema of schemas) {
    const schemaSql = quoteIdentifier(schema)

    await client.query(`grant usage on schema ${schemaSql} to ${roleSql}`)
    await client.query(
      `grant select on all tables in schema ${schemaSql} to ${roleSql}`,
    )
    await client.query(
      `grant select on all sequences in schema ${schemaSql} to ${roleSql}`,
    )

    await client
      .query(
        `
          alter default privileges in schema ${schemaSql}
          grant select on tables to ${roleSql}
        `,
      )
      .catch(() => undefined)
  }
}

export async function revokeDatabaseBrowseAccess(
  client: pg.Client,
  roleName: string,
): Promise<void> {
  const roleSql = formatRoleSql(roleName)
  const schemas = await listGrantableSchemas(client)

  for (const schema of schemas) {
    const schemaSql = quoteIdentifier(schema)

    await client
      .query(
        `revoke all on all tables in schema ${schemaSql} from ${roleSql}`,
      )
      .catch(() => undefined)
    await client
      .query(
        `revoke all on all sequences in schema ${schemaSql} from ${roleSql}`,
      )
      .catch(() => undefined)
    await client
      .query(`revoke create on schema ${schemaSql} from ${roleSql}`)
      .catch(() => undefined)
    await client
      .query(`revoke usage on schema ${schemaSql} from ${roleSql}`)
      .catch(() => undefined)
  }
}

async function setSchemaCreatePrivilege(
  client: pg.Client,
  action: 'grant' | 'revoke',
  schema: string,
  roleName: string,
): Promise<void> {
  const schemaSql = quoteIdentifier(schema)
  const roleSql = formatRoleSql(roleName)
  const verb = action === 'grant' ? 'grant' : 'revoke'

  await client.query(
    `${verb} create on schema ${schemaSql} ${action === 'grant' ? 'to' : 'from'} ${roleSql}`,
  )
}

export async function applyDatabaseAccessChange(
  client: pg.Client,
  database: string,
  roleName: string,
  entry: Pick<RoleDatabaseAccess, 'canConnect' | 'canCreate'>,
  prior: Pick<RoleDatabaseAccess, 'canConnect' | 'canCreate'>,
): Promise<void> {
  const targetCreate = entry.canConnect && entry.canCreate
  const priorCreate = prior.canCreate

  if (entry.canConnect) {
    if (!prior.canConnect) {
      await revokePublicDatabaseConnect(client, database)
      await setDatabasePrivilege(client, 'grant', 'CONNECT', database, roleName)
    }

    await grantDatabaseBrowseAccess(client, roleName)
  } else if (prior.canConnect) {
    await revokeDatabaseBrowseAccess(client, roleName)
    await setDatabasePrivilege(client, 'revoke', 'CONNECT', database, roleName)
  }

  if (targetCreate !== priorCreate) {
    const schemas = await listGrantableSchemas(client)

    for (const schema of schemas) {
      await setSchemaCreatePrivilege(
        client,
        targetCreate ? 'grant' : 'revoke',
        schema,
        roleName,
      )
    }

    await setDatabasePrivilege(
      client,
      targetCreate ? 'grant' : 'revoke',
      'CREATE',
      database,
      roleName,
    )
  }
}

export async function listRoleDatabaseAccess(
  client: pg.Client,
  roleName: string,
): Promise<RoleDatabaseAccess[]> {
  const result = await client.query<{
    database: string
    direct_connect: boolean
    direct_create: boolean
    effective_connect: boolean
    public_can_connect: boolean
  }>(
    `
      select
        d.datname as database,
        exists (
          select 1
          from aclexplode(coalesce(d.datacl, acldefault('d', d.datdba))) as acl
          join pg_catalog.pg_roles r on r.oid = acl.grantee
          where r.rolname = $1
            and acl.privilege_type = 'CONNECT'
        ) as direct_connect,
        exists (
          select 1
          from aclexplode(coalesce(d.datacl, acldefault('d', d.datdba))) as acl
          join pg_catalog.pg_roles r on r.oid = acl.grantee
          where r.rolname = $1
            and acl.privilege_type = 'CREATE'
        ) as direct_create,
        pg_catalog.has_database_privilege($1::name, d.oid, 'CONNECT') as effective_connect,
        pg_catalog.has_database_privilege('public', d.oid, 'CONNECT') as public_can_connect
      from pg_catalog.pg_database d
      where not d.datistemplate
      order by d.datname
    `,
    [roleName],
  )

  return result.rows.map((row) => ({
    database: row.database,
    canConnect: row.direct_connect,
    canCreate: row.direct_create,
    publicCanConnect: row.public_can_connect,
    effectiveCanConnect: row.effective_connect,
  }))
}

export async function revokePublicDatabaseConnect(
  client: pg.Client,
  database: string,
): Promise<void> {
  await client.query(
    buildDatabasePrivilegeStatement('revoke', 'CONNECT', database, 'PUBLIC'),
  )
}

async function setDatabasePrivilege(
  client: pg.Client,
  action: 'grant' | 'revoke',
  privilege: DatabasePrivilege,
  database: string,
  roleName: string,
): Promise<void> {
  await client.query(
    buildDatabasePrivilegeStatement(action, privilege, database, roleName),
  )
}
