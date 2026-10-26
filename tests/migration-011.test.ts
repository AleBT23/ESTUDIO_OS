// Aislamiento estricto: solo PGlite en memoria; no lee .env ni usa DATABASE_URL.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { beforeAll, afterAll, expect, it } from "vitest";

let db: PGlite;
let migration: string;
let oldData: Record<string, unknown>;
let oldFunction: string;
let oldCatalog: unknown;
let backup: Blob;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const collaborator = "33333333-3333-4333-8333-333333333333";
const reader = "44444444-4444-4444-8444-444444444444";
const admin = "55555555-5555-4555-8555-555555555555";
let org: string, otherOrg: string, project: string;
let publishedPath: string,
  draftPath: string,
  draftObservation: string,
  draftPhoto: string;

async function asUser(user: string, role = "authenticated") {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${user}',false); set role ${role};`,
  );
}
async function dataSnapshot(target = db) {
  await target.exec("reset role");
  const tables = (
    await target.query<{ schemaname: string; tablename: string }>(
      "select schemaname,tablename from pg_tables where schemaname='public' or (schemaname='storage' and tablename in ('objects','buckets')) order by schemaname,tablename",
    )
  ).rows;
  const result: Record<string, unknown> = {};
  for (const table of tables) {
    const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"';
    const rows = (
      await target.query<{ data: unknown }>(
        `select to_jsonb(t) data from ${quote(table.schemaname)}.${quote(table.tablename)} t order by to_jsonb(t)::text`,
      )
    ).rows.map((r) => r.data);
    result[table.schemaname + "." + table.tablename] = rows;
  }
  return result;
}
async function catalogSnapshot() {
  await db.exec("reset role");
  return (
    await db.query(`
    select 'function' kind,n.nspname||'.'||p.proname name,
      pg_get_functiondef(p.oid) definition,p.proacl::text acl
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private')
    union all
    select 'policy',schemaname||'.'||tablename||'.'||policyname,
      concat_ws('|',permissive,roles::text,cmd,qual,with_check),null from pg_policies
      where schemaname in ('public','storage')
    union all
    select 'grant',grantee||'.'||column_name,privilege_type,null
      from information_schema.column_privileges where table_schema='public' and table_name='project_photos'
    order by 1,2,3
  `)
  ).rows;
}
async function addObservation(published: boolean) {
  const observation = crypto.randomUUID(),
    photo = crypto.randomUUID();
  const path = `${org}/${observation}/${photo}.jpg`;
  await asUser(owner);
  await db.query(
    "insert into public.project_observations(id,organization_id,project_id,body,observed_on) values($1,$2,$3,'Registro anterior a 011',(now() at time zone 'America/Mexico_City')::date)",
    [observation, org, project],
  );
  await db.query(
    "insert into public.project_photos(id,organization_id,observation_id,storage_path,byte_size) values($1,$2,$3,$4,500)",
    [photo, org, observation, path],
  );
  if (published) {
    await db.query(
      "insert into storage.objects(bucket_id,name) values('project-photos',$1)",
      [path],
    );
    await db.query("select public.publish_project_observation($1,$2)", [
      org,
      observation,
    ]);
  }
  return { observation, photo, path };
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role authenticated noinherit; create role anon noinherit;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated,anon;
    grant select,insert,update,delete on storage.objects to authenticated;
    grant select on storage.objects to anon;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    insert into auth.users values('${owner}'),('${other}'),('${collaborator}'),('${reader}'),('${admin}');
    alter default privileges in schema public grant execute on functions to anon,authenticated;
  `);
  for (const name of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql") && !n.startsWith("202610260011"))
    .sort())
    await db.exec(await readFile("supabase/migrations/" + name, "utf8"));
  migration = await readFile(
    "supabase/migrations/202610260011_direct_project_photos.sql",
    "utf8",
  );
  await asUser(owner);
  org = (
    await db.query<{ id: string }>(
      "select public.create_workspace('Organización de auditoría') id",
    )
  ).rows[0].id;
  const client = (
    await db.query<{ id: string }>(
      "insert into public.clients(organization_id,name) values($1,'Cliente sintético') returning id",
      [org],
    )
  ).rows[0].id;
  project = (
    await db.query<{ id: string }>(
      "select public.create_project_record($1,$2,'Proyecto anterior',current_date,0,$3) id",
      [org, client, crypto.randomUUID()],
    )
  ).rows[0].id;
  await asUser(other);
  otherOrg = (
    await db.query<{ id: string }>(
      "select public.create_workspace('Otra organización') id",
    )
  ).rows[0].id;
  await db.exec(`reset role; insert into public.memberships(organization_id,user_id,role)
    values('${org}','${collaborator}','collaborator'),('${org}','${reader}','reader'),('${org}','${admin}','admin');`);
  publishedPath = (await addObservation(true)).path;
  const draft = await addObservation(false);
  draftPath = draft.path;
  draftObservation = draft.observation;
  draftPhoto = draft.photo;
  oldData = await dataSnapshot();
  oldCatalog = await catalogSnapshot();
  oldFunction = (
    await db.query<{ source: string }>(
      "select pg_get_functiondef('private.project_photo_access(text,boolean)'::regprocedure) source",
    )
  ).rows[0].source;
  backup = await db.dumpDataDir();
}, 60000);
afterAll(async () => {
  await db?.close();
});

it("ensaya fallo de 011: ROLLBACK restaura datos, funciones, políticas y permisos anteriores", async () => {
  await db.exec("begin");
  try {
    await db.exec(migration);
    await expect(db.exec("select 1/0")).rejects.toThrow();
  } finally {
    await db.exec("rollback");
  }
  expect(await dataSnapshot()).toEqual(oldData);
  expect(await catalogSnapshot()).toEqual(oldCatalog);
});
it("una colisión del bucket detiene la migración sin sobrescribir su configuración", async () => {
  await db.exec(
    "insert into storage.buckets values('project-photo-uploads','preexistente',false,123,array['image/png'])",
  );
  await db.exec("begin");
  try {
    await expect(db.exec(migration)).rejects.toThrow(/duplicate/i);
  } finally {
    await db.exec("rollback");
  }
  expect(
    (
      await db.query(
        "select name,file_size_limit from storage.buckets where id='project-photo-uploads'",
      )
    ).rows[0],
  ).toMatchObject({ name: "preexistente", file_size_limit: 123 });
  await db.exec("delete from storage.buckets where id='project-photo-uploads'");
  expect(await catalogSnapshot()).toEqual(oldCatalog);
});
it("actualiza 001–010 con filas existentes sin cambiar ningún dato de negocio ni objetos previos", async () => {
  await db.exec("begin");
  try {
    await db.exec(migration);
    await db.exec("commit");
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
  const upgraded = await dataSnapshot();
  upgraded["storage.buckets"] = (
    upgraded["storage.buckets"] as { id: string }[]
  ).filter((b) => b.id !== "project-photo-uploads");
  expect(upgraded).toEqual(oldData);
  const hash = (value: unknown) =>
    createHash("sha256").update(JSON.stringify(value)).digest("hex");
  expect(hash(upgraded)).toBe(hash(oldData));
});
it("restaura la copia aislada de 010 y recupera filas, definición y ausencia de objetos nuevos", async () => {
  const restored = new PGlite({ loadDataDir: backup });
  try {
    expect(await dataSnapshot(restored)).toEqual(oldData);
    expect(
      (
        await restored.query<{ source: string }>(
          "select pg_get_functiondef('private.project_photo_access(text,boolean)'::regprocedure) source",
        )
      ).rows[0].source,
    ).toBe(oldFunction);
    expect(
      (
        await restored.query<{ id: string | null }>(
          "select id from storage.buckets where id='project-photo-uploads'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await restored.query<{ id: string | null }>(
          "select to_regprocedure('public.prepare_project_observation(uuid,uuid,uuid,text,date,integer[])') id",
        )
      ).rows[0].id,
    ).toBeNull();
  } finally {
    await restored.close();
  }
}, 30000);
it("RPC y helpers SECURITY DEFINER fijan search_path y no conceden EXECUTE a anon/PUBLIC", async () => {
  await db.exec("reset role");
  const rows = (
    await db.query<{
      prosecdef: boolean;
      proconfig: string[];
      anonymous: boolean;
      public_execute: boolean;
    }>(`
    select p.prosecdef,p.proconfig,has_function_privilege('anon',p.oid,'EXECUTE') anonymous,
      exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee=0 and a.privilege_type='EXECUTE') public_execute
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='private' and p.proname in ('project_photo_access','temporary_project_photo_access'))
       or (n.nspname='public' and p.proname='prepare_project_observation')
  `)
  ).rows;
  expect(rows).toHaveLength(3);
  expect(
    rows.every(
      (r) =>
        r.prosecdef &&
        r.proconfig.includes('search_path=""') &&
        !r.anonymous &&
        !r.public_execute,
    ),
  ).toBe(true);
  expect(
    (
      await db.query<{ size: boolean; path: boolean; table_update: boolean }>(`
    select has_column_privilege('authenticated','public.project_photos','byte_size','UPDATE') size,
      has_column_privilege('authenticated','public.project_photos','storage_path','UPDATE') path,
      has_table_privilege('authenticated','public.project_photos','UPDATE') table_update
  `)
    ).rows[0],
  ).toEqual({ size: true, path: false, table_update: false });
});
it("anon y organización ajena no ven publicados; miembros autorizados conservan lectura compartida", async () => {
  for (const user of [owner, collaborator, reader, admin]) {
    await asUser(user);
    expect(
      (
        await db.query(
          "select id from storage.objects where bucket_id='project-photos' and name=$1",
          [publishedPath],
        )
      ).rows,
    ).toHaveLength(1);
  }
  await asUser(other);
  expect(
    (
      await db.query("select id from storage.objects where name=$1", [
        publishedPath,
      ])
    ).rows,
  ).toHaveLength(0);
  await asUser("", "anon");
  expect(
    (
      await db.query("select id from storage.objects where name=$1", [
        publishedPath,
      ])
    ).rows,
  ).toHaveLength(0);
});
it("solo el autor puede leer/escribir temporales y actualizar tamaño de su borrador", async () => {
  await asUser(owner);
  await db.query(
    "insert into storage.objects(bucket_id,name) values('project-photo-uploads',$1)",
    [draftPath],
  );
  await db.query(
    "insert into storage.objects(bucket_id,name) values('project-photos',$1)",
    [draftPath],
  );
  for (const user of [other, collaborator, reader, admin]) {
    await asUser(user);
    expect(
      (
        await db.query("select id from storage.objects where name=$1", [
          draftPath,
        ])
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.project_photos set byte_size=100 where id=$1 returning id",
          [draftPhoto],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "delete from storage.objects where name=$1 returning id",
          [draftPath],
        )
      ).rows,
    ).toHaveLength(0);
  }
  await asUser(owner);
  expect(
    (
      await db.query(
        "update public.project_photos set byte_size=450 where id=$1 returning id",
        [draftPhoto],
      )
    ).rows,
  ).toHaveLength(1);
  await expect(
    db.query("update storage.objects set name=name where name=$1", [draftPath]),
  ).resolves.toMatchObject({ affectedRows: 0 });
});
it("políticas Storage permisivas adicionales no abren lectura/carga/borrado entre usuarios", async () => {
  await db.exec(
    "reset role; create policy audit_broad_authenticated on storage.objects for all to authenticated using(true) with check(true); create policy audit_broad_anon on storage.objects for select to anon using(true)",
  );
  try {
    for (const user of [other, collaborator, reader, admin]) {
      await asUser(user);
      expect(
        (
          await db.query("select id from storage.objects where name=$1", [
            draftPath,
          ])
        ).rows,
      ).toHaveLength(0);
      expect(
        (
          await db.query(
            "delete from storage.objects where name=$1 returning id",
            [draftPath],
          )
        ).rows,
      ).toHaveLength(0);
      await expect(
        db.query(
          "insert into storage.objects(bucket_id,name) values('project-photo-uploads',$1)",
          [draftPath + ".intruso"],
        ),
      ).rejects.toThrow();
    }
    await asUser("", "anon");
    expect(
      (
        await db.query(
          "select id from storage.objects where name=$1 or name=$2",
          [draftPath, publishedPath],
        )
      ).rows,
    ).toHaveLength(0);
  } finally {
    await db.exec(
      "reset role; drop policy audit_broad_authenticated on storage.objects; drop policy audit_broad_anon on storage.objects",
    );
  }
});
it("retirar permisos de escritura retira inmediatamente acceso al temporal y modificación de tamaño", async () => {
  await db.exec(
    `reset role; update public.memberships set role='reader' where organization_id='${org}' and user_id='${owner}'`,
  );
  try {
    await asUser(owner);
    expect(
      (
        await db.query(
          "select id from storage.objects where bucket_id='project-photo-uploads' and name=$1",
          [draftPath],
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "update public.project_photos set byte_size=200 where id=$1 returning id",
          [draftPhoto],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "select public.prepare_project_observation($1,$2,$3,'Intento',current_date,array[100])",
        [org, project, crypto.randomUUID()],
      ),
    ).rejects.toThrow("Permisos");
  } finally {
    await db.exec(
      `reset role; update public.memberships set role='owner' where organization_id='${org}' and user_id='${owner}'`,
    );
  }
});
it("un UUID de observación de otro autor/estudio no permite reutilizar ni descubrir sus fotos", async () => {
  await asUser(other);
  await expect(
    db.query(
      "select public.prepare_project_observation($1,$2,$3,'Registro anterior a 011',current_date,array[500])",
      [otherOrg, project, draftObservation],
    ),
  ).rejects.toThrow("Proyecto");
  await asUser(collaborator);
  await expect(
    db.query(
      "select public.prepare_project_observation($1,$2,$3,'Registro anterior a 011',(now() at time zone 'America/Mexico_City')::date,array[500])",
      [org, project, draftObservation],
    ),
  ).rejects.toThrow("otro registro");
});
