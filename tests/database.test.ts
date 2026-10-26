import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { beforeAll, afterAll, it, expect } from "vitest";
import { calculateQuote, fromCents } from "@/shared/money";
import { defaultDocumentOptions } from "@/modules/documents/schema";
import { opportunitySchema } from "@/modules/crm/pipeline-schema";
import { insertConcept } from "@/modules/quotes/concept-schema";
import {
  standaloneSnapshotSchema,
  resolveDocumentBody,
} from "@/modules/documents/standalone-schema";
let db: PGlite;
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const reader = "33333333-3333-4333-8333-333333333333";
let org: string;
let otherOrg: string;
let client: string;
async function asUser(user: string) {
  await db.exec(
    `reset role; select set_config('request.jwt.claim.sub','${user}',false); set role authenticated;`,
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role authenticated noinherit; create role anon noinherit; create schema storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,unique(bucket_id,name)); alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select,insert,update,delete on storage.objects to authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values('${owner}'),('${other}'),('${reader}');`,
  );
  // Reproduce las concesiones explícitas del entorno Supabase real.
  await db.exec(
    "alter default privileges in schema public grant execute on functions to anon,authenticated;",
  );
  for (const name of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(`supabase/migrations/${name}`, "utf8"));
  await asUser(owner);
  org = (
    await db.query<{ id: string }>(
      `select public.create_workspace('Estudio de prueba') id`,
    )
  ).rows[0].id;
  await asUser(other);
  otherOrg = (
    await db.query<{ id: string }>(
      `select public.create_workspace('Otro estudio') id`,
    )
  ).rows[0].id;
  await db.exec(
    `reset role; insert into public.memberships(organization_id,user_id,role) values('${org}','${reader}','reader');`,
  );
  await asUser(owner);
  client = (
    await db.query<{ id: string }>(
      `insert into public.clients(organization_id,name) values('${org}','María Ñúñez') returning id`,
    )
  ).rows[0].id;
});
afterAll(async () => {
  await db?.close();
});
it("retira concesiones anónimas de RPC incluso con defaults de Supabase", async () => {
  await db.exec("reset role");
  const rows = (
    await db.query<{ anonymous: boolean; authenticated: boolean }>(
      `select has_function_privilege('anon',p.oid,'EXECUTE') anonymous,
       has_function_privilege('authenticated',p.oid,'EXECUTE') authenticated
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.prosecdef`,
    )
  ).rows;
  expect(rows).toHaveLength(19);
  expect(rows.every((r) => !r.anonymous && r.authenticated)).toBe(true);
  await db.exec("set role anon");
  try {
    await expect(
      db.query("select public.create_workspace('No autorizado')"),
    ).rejects.toThrow(/permission denied/i);
  } finally {
    await asUser(owner);
  }
});
it("pipeline valida etapas, conserva seguimiento y bloquea referencias cruzadas", async () => {
  await asUser(owner);
  const line = (
    await db.query<{ id: string }>(
      "select id from public.business_lines where organization_id=$1 limit 1",
      [org],
    )
  ).rows[0].id;
  const input = {
    name: "Oportunidad de prueba",
    client_id: client,
    business_line_id: line,
    stage: "new",
    notes: "Contacto inicial",
    next_follow_up: "2026-10-20",
  };
  expect(opportunitySchema.safeParse(input).success).toBe(true);
  expect(
    opportunitySchema.safeParse({ ...input, stage: "inventada" }).success,
  ).toBe(false);
  const id = (
    await db.query<{ id: string }>(
      "insert into public.opportunities(organization_id,client_id,business_line_id,name,next_follow_up) values($1,$2,$3,'Oportunidad de prueba','2026-10-20') returning id",
      [org, client, line],
    )
  ).rows[0].id;
  await db.query(
    "update public.opportunities set stage='contact' where id=$1 and version=1",
    [id],
  );
  expect(
    (
      await db.query<{ stage: string; version: number }>(
        "select stage,version from public.opportunities where id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual({ stage: "contact", version: 2 });
  await asUser(other);
  expect(
    (await db.query("select * from public.opportunities")).rows,
  ).toHaveLength(0);
  await expect(
    db.query(
      "insert into public.opportunities(organization_id,client_id,business_line_id,name) values($1,$2,$3,'Cruce indebido')",
      [otherOrg, client, line],
    ),
  ).rejects.toThrow();
});
it("conserva Unicode y persiste filas reales", async () => {
  await asUser(owner);
  expect(
    (
      await db.query<{ name: string }>(
        `select name from public.clients where id='${client}'`,
      )
    ).rows[0].name,
  ).toBe("María Ñúñez");
});
it("no permite crear un segundo estudio con el mismo usuario", async () => {
  await asUser(owner);
  await expect(
    db.query(`select public.create_workspace('Duplicado')`),
  ).rejects.toThrow("Ya perteneces");
});
it("RLS oculta datos de otro estudio", async () => {
  await asUser(other);
  expect((await db.query("select * from public.clients")).rows).toHaveLength(0);
  await expect(
    db.query(
      `insert into public.clients(organization_id,name) values('${org}','Intruso')`,
    ),
  ).rejects.toThrow();
});
it("impide referencias cruzadas por organización", async () => {
  await asUser(other);
  const line = (
    await db.query<{ id: string }>(
      "select id from public.business_lines limit 1",
    )
  ).rows[0].id;
  await asUser(owner);
  await expect(
    db.query(
      `insert into public.clients(organization_id,name,business_line_id) values('${org}','Cruce','${line}')`,
    ),
  ).rejects.toThrow();
});
it("lector consulta pero no edita, elimina ni escala su rol", async () => {
  await asUser(reader);
  expect((await db.query("select * from public.clients")).rows).toHaveLength(1);
  await expect(
    db.query(
      `insert into public.clients(organization_id,name) values('${org}','No permitido')`,
    ),
  ).rejects.toThrow();
  expect(
    (
      await db.query(
        `update public.clients set name='Alterado' where id='${client}' returning id`,
      )
    ).rows,
  ).toHaveLength(0);
  await expect(
    db.query(`delete from public.clients where id='${client}'`),
  ).rejects.toThrow();
  await expect(
    db.query(
      `update public.memberships set role='owner' where user_id='${reader}'`,
    ),
  ).rejects.toThrow();
});
it("rechaza referencias cliente-contacto cruzadas", async () => {
  await asUser(other);
  await expect(
    db.query(
      `insert into public.client_contacts(organization_id,client_id,name) values('${otherOrg}','${client}','Contacto cruzado')`,
    ),
  ).rejects.toThrow();
});
it("control optimista evita sobrescribir cambios concurrentes", async () => {
  await asUser(owner);
  expect(
    (
      await db.query(
        `update public.clients set name='Nombre nuevo' where id='${client}' and version=1 returning version`,
      )
    ).rows,
  ).toEqual([{ version: 2 }]);
  expect(
    (
      await db.query(
        `update public.clients set name='Nombre viejo' where id='${client}' and version=1 returning version`,
      )
    ).rows,
  ).toHaveLength(0);
});
it("archiva y restaura sin borrar; audita la transacción", async () => {
  await asUser(owner);
  await db.query(
    `update public.clients set deleted_at=now() where id='${client}'`,
  );
  expect(
    (
      await db.query<{ deleted_at: string }>(
        `select deleted_at from public.clients where id='${client}'`,
      )
    ).rows[0].deleted_at,
  ).not.toBeNull();
  await db.query(
    `update public.clients set deleted_at=null where id='${client}'`,
  );
  expect(
    (
      await db.query<{ action: string }>(
        "select action from public.audit_events where entity_type='clients' and entity_id=$1 order by created_at",
        [client],
      )
    ).rows.map((r) => r.action),
  ).toEqual(["created", "updated", "archived", "restored"]);
});
it("no permite falsificar auditoría ni mover un cliente a otro estudio", async () => {
  await asUser(owner);
  await expect(
    db.query(
      `insert into public.audit_events(organization_id,entity_type,entity_id,action) values('${org}','clients','${client}','fake')`,
    ),
  ).rejects.toThrow();
  await expect(
    db.query(
      `update public.clients set organization_id='${otherOrg}' where id='${client}'`,
    ),
  ).rejects.toThrow();
});
it("sesión anónima no puede crear estudio", async () => {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','',false);set role authenticated;`,
  );
  await expect(
    db.query(`select public.create_workspace('Anónimo')`),
  ).rejects.toThrow("Se requiere");
});

async function commercialFixture() {
  await asUser(owner);
  const line = (
    await db.query<{ id: string }>(
      `select id from public.business_lines where organization_id='${org}' order by name limit 1`,
    )
  ).rows[0].id;
  const service = (
    await db.query<{ id: string }>(
      `insert into public.services(organization_id,business_line_id,code,name,unit,price_cents) values($1,$2,$3,'Diseño de prueba','fixed',10000) returning id`,
      [org, line, crypto.randomUUID()],
    )
  ).rows[0].id;
  return { line, service };
}
function quoteHeader() {
  return {
    client_id: client,
    name: "Proyecto mixto prueba",
    vat_rate: "16",
    apply_vat: true,
    advance_rate: "50",
    valid_until: new Date(Date.now() + 30 * 86400000)
      .toISOString()
      .slice(0, 10),
    notes: "Árbol, ñ y diseño",
    conditions: "",
    estimated_hours: "12",
    external_cost_cents: 2500,
  };
}
async function draft(
  items: unknown,
  quote: string | null = null,
  version = 0,
  header = quoteHeader(),
) {
  return (
    await db.query<{ id: string }>(
      `select public.save_quote_draft($1,$2,$3,$4::jsonb,$5::jsonb) id`,
      [org, quote, version, JSON.stringify(header), JSON.stringify(items)],
    )
  ).rows[0].id;
}
it("cotización calcula en PostgreSQL y coincide con motor decimal, sin tocar catálogo", async () => {
  const { line, service } = await commercialFixture();
  const items = [
    {
      service_id: service,
      business_line_id: line,
      name: "Servicio personalizado",
      description: "Con acentos",
      quantity: "2.125",
      unit: "unit",
      unit_price_cents: 10005,
      discount_rate: "7.5",
    },
    {
      service_id: "",
      business_line_id: line,
      name: "Honorarios sobre obra",
      description: "",
      quantity: "1000000",
      unit: "pct",
      unit_price_cents: 800,
      discount_rate: "0",
    },
  ];
  const id = await draft(items);
  const quote = (
    await db.query<{
      total_cents: number;
      subtotal_cents: number;
      discount_cents: number;
      tax_cents: number;
    }>(
      `select total_cents::float8,subtotal_cents::float8,discount_cents::float8,tax_cents::float8 from public.quotes where id=$1`,
      [id],
    )
  ).rows[0];
  const totals = calculateQuote(
    items.map((i) => ({
      quantity: i.quantity,
      unit: i.unit,
      unitPrice: fromCents(i.unit_price_cents),
      discount: i.discount_rate,
    })),
    "16",
    true,
  );
  expect(quote).toEqual({
    total_cents: totals.total,
    subtotal_cents: totals.subtotal,
    discount_cents: totals.discount,
    tax_cents: totals.tax,
  });
  expect(
    (
      await db.query<{ name: string; price: string }>(
        `select name,price_cents::text price from public.services where id=$1`,
        [service],
      )
    ).rows[0],
  ).toEqual({ name: "Diseño de prueba", price: "10000" });
});
it("fallo de una partida revierte cabecera, partidas y auditoría atómicamente", async () => {
  const { line, service } = await commercialFixture();
  const item = {
    service_id: service,
    business_line_id: line,
    name: "Alcance original",
    quantity: "1",
    unit: "fixed",
    unit_price_cents: 50000,
    discount_rate: "0",
  };
  const id = await draft([item]);
  const original = (
    await db.query<{ version: number; total: string }>(
      `select version,total_cents::text total from public.quotes where id=$1`,
      [id],
    )
  ).rows[0];
  await expect(
    draft(
      [item, { ...item, business_line_id: crypto.randomUUID() }],
      id,
      original.version,
    ),
  ).rejects.toThrow();
  expect(
    (
      await db.query(
        `select version,total_cents::text total from public.quotes where id=$1`,
        [id],
      )
    ).rows[0],
  ).toEqual(original);
  expect(
    (await db.query(`select * from public.quote_items where quote_id=$1`, [id]))
      .rows,
  ).toHaveLength(1);
});
it("borradores impiden edición concurrente e importes con precisión inconsistente", async () => {
  const { line } = await commercialFixture();
  const item = {
    business_line_id: line,
    name: "Partida manual",
    quantity: "1",
    unit: "fixed",
    unit_price_cents: 1,
    discount_rate: "0",
  };
  const id = await draft([item]);
  const version = (
    await db.query<{ version: number }>(
      `select version from public.quotes where id=$1`,
      [id],
    )
  ).rows[0].version;
  await draft([{ ...item, unit_price_cents: 2 }], id, version);
  await expect(draft([item], id, version)).rejects.toThrow("Conflicto");
  await expect(draft([{ ...item, quantity: "1.00001" }])).rejects.toThrow(
    "Precisión",
  );
  await expect(draft(null)).rejects.toThrow("Agrega");
});
it("presets transaccionales validan referencias y cantidades, sin reemplazo parcial", async () => {
  const { service } = await commercialFixture();
  const id = (
    await db.query<{ id: string }>(
      `select public.save_preset($1,null,0,'Paquete de prueba','Notas',$2::jsonb) id`,
      [org, JSON.stringify([{ service_id: service, quantity: "2" }])],
    )
  ).rows[0].id;
  await expect(
    db.query(
      `select public.save_preset($1,$2,1,'Nombre cambiado','',$3::jsonb)`,
      [
        org,
        id,
        JSON.stringify([{ service_id: crypto.randomUUID(), quantity: "1" }]),
      ],
    ),
  ).rejects.toThrow("Servicio no disponible");
  expect(
    (
      await db.query<{ name: string }>(
        `select name from public.service_presets where id=$1`,
        [id],
      )
    ).rows[0].name,
  ).toBe("Paquete de prueba");
  expect(
    (
      await db.query(`select * from public.preset_items where preset_id=$1`, [
        id,
      ])
    ).rows,
  ).toHaveLength(1);
});
it("lector no puede consultar costos, modificar propuestas ni usar RPC privilegiadas", async () => {
  await asUser(reader);
  expect((await db.query("select * from public.services")).rows).toHaveLength(
    0,
  );
  expect((await db.query("select * from public.quotes")).rows).toHaveLength(0);
  await expect(draft([])).rejects.toThrow("Permisos insuficientes");
  await expect(
    db.query(`select public.save_preset($1,null,0,'Intento','',null)`, [org]),
  ).rejects.toThrow("Permisos insuficientes");
});
it("otro estudio no puede usar cliente ajeno aunque conozca su UUID", async () => {
  await asUser(other);
  await expect(
    db.query(
      `select public.save_quote_draft($1,null,0,$2::jsonb,'[{}]'::jsonb)`,
      [otherOrg, JSON.stringify(quoteHeader())],
    ),
  ).rejects.toThrow("Cliente no disponible");
});

async function issuedFixture() {
  const { line } = await commercialFixture();
  const lines = (
    await db.query<{ id: string }>(
      `select id from public.business_lines where organization_id=$1 and id<>$2`,
      [org, line],
    )
  ).rows;
  const items = [
    {
      business_line_id: line,
      name: "Arquitectura contratada",
      description: "Alcance A",
      quantity: "1",
      unit: "fixed",
      unit_price_cents: 2000000,
      discount_rate: "0",
    },
    {
      business_line_id: lines[0].id,
      name: "Visualización contratada",
      description: "Alcance B",
      quantity: "1",
      unit: "fixed",
      unit_price_cents: 500000,
      discount_rate: "0",
    },
  ];
  const id = await draft(items, null, 0, {
    ...quoteHeader(),
    apply_vat: false,
  });
  const version = (
    await db.query<{ version: number }>(
      `select version from public.quotes where id=$1`,
      [id],
    )
  ).rows[0].version;
  const prepared = (
    await db.query<{
      data: {
        id: string;
        storage_path: string;
        snapshot: Record<string, unknown>;
      };
    }>(`select public.prepare_quote_version($1,$2,$3,$4::jsonb) data`, [
      org,
      id,
      version,
      JSON.stringify(defaultDocumentOptions),
    ])
  ).rows[0].data;
  await db.query(
    `insert into storage.objects(bucket_id,name) values('estudio-documents',$1)`,
    [prepared.storage_path],
  );
  await db.query(`select public.finalize_quote_version($1,$2,$3)`, [
    org,
    prepared.id,
    "a".repeat(64),
  ]);
  return { id, version, prepared, items };
}
it("emisión conserva snapshot sin costos internos y bloquea modificación/eliminación del objeto", async () => {
  const { prepared } = await issuedFixture();
  expect(prepared.snapshot).not.toHaveProperty("external_cost_cents");
  expect(prepared.snapshot.quote).not.toHaveProperty("external_cost_cents");
  expect(
    (
      await db.query(
        `update storage.objects set name='alterado.pdf' where name=$1 returning id`,
        [prepared.storage_path],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(`delete from storage.objects where name=$1 returning id`, [
        prepared.storage_path,
      ])
    ).rows,
  ).toHaveLength(0);
  await expect(
    db.query(`update public.quote_versions set snapshot='{}' where id=$1`, [
      prepared.id,
    ]),
  ).rejects.toThrow();
  await expect(
    db.query(`select public.finalize_quote_version($1,$2,$3)`, [
      org,
      prepared.id,
      "b".repeat(64),
    ]),
  ).rejects.toThrow("otra huella");
  await asUser(other);
  expect(
    (
      await db.query(`select * from storage.objects where name=$1`, [
        prepared.storage_path,
      ])
    ).rows,
  ).toHaveLength(0);
});
it("editar el borrador no cambia el PDF emitido y obliga a emitir edición vigente antes de enviar", async () => {
  const { id, version, prepared, items } = await issuedFixture();
  await draft(items, id, version, {
    ...quoteHeader(),
    name: "Proyecto modificado",
    apply_vat: false,
  });
  const newVersion = (
    await db.query<{ version: number }>(
      `select version from public.quotes where id=$1`,
      [id],
    )
  ).rows[0].version;
  await expect(
    db.query(`select public.mark_quote_sent($1,$2,$3,$4)`, [
      org,
      id,
      newVersion,
      prepared.id,
    ]),
  ).rejects.toThrow("versión vigente");
  const stored = (
    await db.query<{ snapshot: Record<string, unknown> }>(
      `select snapshot from public.quote_versions where id=$1`,
      [prepared.id],
    )
  ).rows[0].snapshot;
  expect(stored).toEqual(prepared.snapshot);
});
it("aceptar proyecto mixto programa 12,500 + 12,500 con cobrado cero; luego registra y revierte pago", async () => {
  const { id, version, prepared } = await issuedFixture();
  await db.query(`select public.mark_quote_sent($1,$2,$3,$4)`, [
    org,
    id,
    version,
    prepared.id,
  ]);
  const sentVersion = (
    await db.query<{ version: number }>(
      `select version from public.quotes where id=$1`,
      [id],
    )
  ).rows[0].version;
  const project = (
    await db.query<{ id: string }>(
      `select public.accept_quote($1,$2,$3,'2026-10-19','2026-11-15') id`,
      [org, id, sentVersion],
    )
  ).rows[0].id;
  const plans = (
    await db.query<{ id: string; amount: string; collected: string }>(
      `select id,amount_cents::text amount,collected_cents::text collected from public.payment_schedule_balances where project_id=$1 order by label`,
      [project],
    )
  ).rows;
  expect(plans.map((p) => p.amount)).toEqual(["1250000", "1250000"]);
  expect(plans.map((p) => p.collected)).toEqual(["0", "0"]);
  const packages = (
    await db.query<{ id: string }>(
      `select id from public.project_service_packages where project_id=$1`,
      [project],
    )
  ).rows;
  expect(packages).toHaveLength(2);
  expect(
    (
      await db.query<{ total: string }>(
        `select sum(contracted_net_cents)::text total from public.package_financials where package_id in(select id from public.project_service_packages where project_id=$1)`,
        [project],
      )
    ).rows[0].total,
  ).toBe("2500000");
  await expect(
    db.query(`select public.accept_quote($1,$2,$3,'2026-10-19','2026-11-15')`, [
      org,
      id,
      sentVersion,
    ]),
  ).rejects.toThrow("Conflicto");
  const key = crypto.randomUUID();
  const payment = (
    await db.query<{ id: string }>(
      `select public.record_payment($1,$2,1250000,'2026-10-19','Referencia de prueba',$3) id`,
      [org, plans[0].id, key],
    )
  ).rows[0].id;
  expect(
    (
      await db.query<{ id: string }>(
        `select public.record_payment($1,$2,1250000,'2026-10-19','Referencia de prueba',$3) id`,
        [org, plans[0].id, key],
      )
    ).rows[0].id,
  ).toBe(payment);
  expect(
    (
      await db.query<{ collected: string }>(
        `select collected_cents::text collected from public.payment_schedule_balances where id=$1`,
        [plans[0].id],
      )
    ).rows[0].collected,
  ).toBe("1250000");
  await expect(
    db.query(`select public.record_payment($1,$2,1,'2026-10-19','Exceso',$3)`, [
      org,
      plans[0].id,
      crypto.randomUUID(),
    ]),
  ).rejects.toThrow("saldo pendiente");
  await db.query(
    `select public.reverse_payment($1,$2,1,'Corrección autorizada de prueba')`,
    [org, payment],
  );
  expect(
    (
      await db.query<{ collected: string }>(
        `select collected_cents::text collected from public.payment_schedule_balances where id=$1`,
        [plans[0].id],
      )
    ).rows[0].collected,
  ).toBe("0");
  expect(
    (
      await db.query(
        `select * from public.payments where id=$1 and state='reversed'`,
        [payment],
      )
    ).rows,
  ).toHaveLength(1);
  await asUser(reader);
  expect(
    (
      await db.query(
        `select * from public.project_service_packages where project_id=$1`,
        [project],
      )
    ).rows,
  ).toHaveLength(2);
  expect(
    (await db.query("select * from public.package_financials")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select * from public.payment_schedule_balances")).rows,
  ).toHaveLength(0);
});
it("contactos se editan con versión y se archivan/restauran sin perder relación", async () => {
  await asUser(owner);
  const contact = (
    await db.query<{ id: string }>(
      "insert into public.client_contacts(organization_id,client_id,name,email,position) values($1,$2,'Contacto de prueba','contacto@example.test','Coordinación') returning id",
      [org, client],
    )
  ).rows[0].id;
  expect(
    (
      await db.query(
        "update public.client_contacts set phone='4520000000' where id=$1 and version=1 returning version",
        [contact],
      )
    ).rows,
  ).toEqual([{ version: 2 }]);
  expect(
    (
      await db.query(
        "update public.client_contacts set name='Edición concurrente' where id=$1 and version=1 returning id",
        [contact],
      )
    ).rows,
  ).toHaveLength(0);
  await db.query(
    "update public.client_contacts set deleted_at=now() where id=$1",
    [contact],
  );
  await db.query(
    "update public.client_contacts set deleted_at=null where id=$1",
    [contact],
  );
  expect(
    (
      await db.query<{ version: number; phone: string; client_id: string }>(
        "select version,phone,client_id from public.client_contacts where id=$1",
        [contact],
      )
    ).rows[0],
  ).toEqual({ version: 4, phone: "4520000000", client_id: client });
});
it("una política anónima amplia no permite leer documentos privados", async () => {
  await db.exec(
    "reset role;grant usage on schema storage to anon;grant select on storage.objects to anon;create policy test_broad_anon on storage.objects for select to anon using(true);set role anon;",
  );
  expect(
    (
      await db.query(
        "select * from storage.objects where bucket_id='estudio-documents'",
      )
    ).rows,
  ).toHaveLength(0);
});
it("cambiar o archivar un concepto no cambia el texto persistido de una cotización", async () => {
  const { line } = await commercialFixture();
  const concept = (
    await db.query<{ id: string; body: string }>(
      "insert into public.concepts(organization_id,name,body) values($1,'Alcance guardado','Descripción original con acentos.') returning id,body",
      [org],
    )
  ).rows[0];
  const id = await draft([
    {
      business_line_id: line,
      name: "Partida personalizada",
      description: insertConcept("Texto propio.", concept.body),
      quantity: "1",
      unit: "fixed",
      unit_price_cents: 10000,
      discount_rate: "0",
    },
  ]);
  await db.query(
    "update public.concepts set body='Texto actualizado',deleted_at=now() where id=$1 and version=1",
    [concept.id],
  );
  expect(
    (
      await db.query<{ description: string }>(
        "select description from public.quote_items where quote_id=$1",
        [id],
      )
    ).rows[0].description,
  ).toBe("Texto propio.\n\nDescripción original con acentos.");
  expect(
    (
      await db.query(
        "update public.concepts set body=$1 where id=$2 and version=1 returning id",
        ["Edición atrasada", concept.id],
      )
    ).rows,
  ).toHaveLength(0);
  await db.query(
    "update public.concepts set deleted_at=null where id=$1 and version=2",
    [concept.id],
  );
  expect(
    (
      await db.query<{ version: number }>(
        "select version from public.concepts where id=$1",
        [concept.id],
      )
    ).rows[0].version,
  ).toBe(3);
  await asUser(reader);
  expect((await db.query("select * from public.concepts")).rows).toHaveLength(
    0,
  );
  await asUser(other);
  expect((await db.query("select * from public.concepts")).rows).toHaveLength(
    0,
  );
});
async function currentQuote(id: string) {
  return (
    await db.query<{
      version: number;
      status: string;
      issued_version_id: string | null;
      valid_until: string;
    }>(
      "select version,status,issued_version_id,valid_until::text from public.quotes where id=$1",
      [id],
    )
  ).rows[0];
}
it("revisión de enviada conserva PDF anterior y exige nueva edición antes de registrar envío", async () => {
  const { id, version, prepared } = await issuedFixture();
  await db.query("select public.mark_quote_sent($1,$2,$3,$4)", [
    org,
    id,
    version,
    prepared.id,
  ]);
  const sent = await currentQuote(id);
  const validUntil = new Date(Date.now() + 45 * 86400000)
    .toISOString()
    .slice(0, 10);
  await db.query("select public.change_quote_lifecycle($1,$2,$3,$4,$5,$6)", [
    org,
    id,
    sent.version,
    "revise",
    "El cliente solicitó ajustar el alcance",
    validUntil,
  ]);
  const revised = await currentQuote(id);
  expect(revised).toMatchObject({
    status: "draft",
    issued_version_id: null,
    version: sent.version + 1,
    valid_until: validUntil,
  });
  expect(
    (
      await db.query<{ snapshot: unknown; state: string }>(
        "select snapshot,state from public.quote_versions where id=$1",
        [prepared.id],
      )
    ).rows[0],
  ).toEqual({ snapshot: prepared.snapshot, state: "issued" });
  await expect(
    db.query("select public.mark_quote_sent($1,$2,$3,$4)", [
      org,
      id,
      revised.version,
      prepared.id,
    ]),
  ).rejects.toThrow("versión vigente");
  await expect(
    db.query("select public.change_quote_lifecycle($1,$2,$3,$4,$5,null)", [
      org,
      id,
      sent.version,
      "reject",
      "Edición atrasada",
    ]),
  ).rejects.toThrow("Conflicto");
});
it("rechazo y vencimiento validan el estado, la fecha y el motivo y quedan registrados", async () => {
  const { line } = await commercialFixture();
  const item = {
    business_line_id: line,
    name: "Alcance de prueba",
    quantity: "1",
    unit: "fixed",
    unit_price_cents: 10000,
    discount_rate: "0",
  };
  const id = await draft([item]);
  const original = await currentQuote(id);
  await expect(
    db.query("select public.change_quote_lifecycle($1,$2,$3,$4,$5,null)", [
      org,
      id,
      original.version,
      "expire",
      "Vencimiento anticipado",
    ]),
  ).rejects.toThrow("vigencia");
  await expect(
    db.query("select public.change_quote_lifecycle($1,$2,$3,$4,$5,null)", [
      org,
      id,
      original.version,
      "reject",
      "",
    ]),
  ).rejects.toThrow("motivo");
  await db.query("select public.change_quote_lifecycle($1,$2,$3,$4,$5,null)", [
    org,
    id,
    original.version,
    "reject",
    "El cliente declinó la propuesta",
  ]);
  const rejected = await currentQuote(id);
  expect(rejected.status).toBe("rejected");
  expect(
    (
      await db.query<{ reason: string }>(
        "select reason from public.quote_status_events where quote_id=$1 order by created_at desc limit 1",
        [id],
      )
    ).rows[0].reason,
  ).toBe("El cliente declinó la propuesta");
  const expiredId = await draft([item], null, 0, {
    ...quoteHeader(),
    valid_until: "2000-01-01",
  });
  await db.query("select public.change_quote_lifecycle($1,$2,$3,$4,$5,null)", [
    org,
    expiredId,
    (await currentQuote(expiredId)).version,
    "expire",
    "Vigencia concluida sin aceptación",
  ]);
  expect((await currentQuote(expiredId)).status).toBe("expired");
  await expect(
    db.query("select public.change_quote_lifecycle($1,$2,$3,$4,$5,$6)", [
      org,
      expiredId,
      (await currentQuote(expiredId)).version,
      "revise",
      "Revisión con fecha incorrecta",
      "2000-01-01",
    ]),
  ).rejects.toThrow("vigencia válida");
});
it("cotización aceptada no se puede reabrir ni rechazar y otros roles no cambian estados", async () => {
  const { id, version, prepared } = await issuedFixture();
  await db.query("select public.mark_quote_sent($1,$2,$3,$4)", [
    org,
    id,
    version,
    prepared.id,
  ]);
  await db.query(
    "select public.accept_quote($1,$2,$3,'2026-10-19','2026-11-15')",
    [org, id, (await currentQuote(id)).version],
  );
  const accepted = await currentQuote(id);
  for (const intent of ["revise", "reject", "expire"])
    await expect(
      db.query("select public.change_quote_lifecycle($1,$2,$3,$4,$5,$6)", [
        org,
        id,
        accepted.version,
        intent,
        "Intento de cambiar el contrato",
        quoteHeader().valid_until,
      ]),
    ).rejects.toThrow("aceptada");
  await asUser(reader);
  await expect(
    db.query("select public.change_quote_lifecycle($1,$2,$3,$4,$5,null)", [
      org,
      id,
      accepted.version,
      "reject",
      "Acceso indebido",
    ]),
  ).rejects.toThrow("Permisos insuficientes");
  await asUser(other);
  await expect(
    db.query("select public.change_quote_lifecycle($1,$2,$3,$4,$5,null)", [
      otherOrg,
      id,
      accepted.version,
      "reject",
      "Cruce de organización",
    ]),
  ).rejects.toThrow("Conflicto");
});
it("documento independiente conserva contexto, PDF emitido y revisiones sin tocar cotizaciones", async () => {
  await asUser(owner);
  const header = {
    title: "Carta de seguimiento",
    kind: "letter",
    body: "Para {{cliente.nombre}}. {{despacho.nombre}} · {{fecha}}",
    client_id: client,
    project_id: null,
    margins: defaultDocumentOptions.margins,
  };
  const id = (
    await db.query<{ id: string }>(
      "select public.save_studio_document($1,null,0,$2::jsonb) id",
      [org, JSON.stringify(header)],
    )
  ).rows[0].id;
  const prepared = (
    await db.query<{
      data: { id: string; storage_path: string; snapshot: unknown };
    }>("select public.prepare_studio_document($1,$2,1) data", [org, id])
  ).rows[0].data;
  const snapshot = standaloneSnapshotSchema.parse(prepared.snapshot);
  expect(snapshot.title).toBe("Carta de seguimiento");
  expect(resolveDocumentBody(snapshot)).not.toContain("{{");
  expect(snapshot).not.toHaveProperty("quote");
  await db.query(
    "insert into storage.objects(bucket_id,name) values('estudio-documents',$1)",
    [prepared.storage_path],
  );
  await db.query("select public.finalize_studio_document($1,$2,$3)", [
    org,
    prepared.id,
    "c".repeat(64),
  ]);
  await db.query("select public.save_studio_document($1,$2,1,$3::jsonb)", [
    org,
    id,
    JSON.stringify({ ...header, body: "Contenido revisado" }),
  ]);
  expect(
    (
      await db.query<{ snapshot: unknown }>(
        "select snapshot from public.generated_documents where id=$1",
        [prepared.id],
      )
    ).rows[0].snapshot,
  ).toEqual(prepared.snapshot);
  expect(
    (
      await db.query("delete from storage.objects where name=$1 returning id", [
        prepared.storage_path,
      ])
    ).rows,
  ).toHaveLength(0);
  await expect(
    db.query(
      "update public.generated_documents set snapshot='{}' where id=$1",
      [prepared.id],
    ),
  ).rejects.toThrow();
  await expect(
    db.query("select public.save_studio_document($1,$2,1,$3::jsonb)", [
      org,
      id,
      JSON.stringify(header),
    ]),
  ).rejects.toThrow("Conflicto");
  await asUser(reader);
  expect(
    (await db.query("select * from public.studio_documents")).rows,
  ).toHaveLength(0);
  await asUser(other);
  expect(
    (await db.query("select * from public.generated_documents")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query("select * from storage.objects where name=$1", [
        prepared.storage_path,
      ])
    ).rows,
  ).toHaveLength(0);
});
it("documentos rechazan referencias entre estudios y proyecto de otro cliente", async () => {
  await asUser(other);
  const foreign = (
    await db.query<{ id: string }>(
      "insert into public.clients(organization_id,name) values($1,'Cliente externo') returning id",
      [otherOrg],
    )
  ).rows[0].id;
  await asUser(owner);
  const header = {
    title: "Oficio de prueba",
    kind: "official",
    body: "Contenido",
    client_id: foreign,
    project_id: null,
    margins: defaultDocumentOptions.margins,
  };
  await expect(
    db.query("select public.save_studio_document($1,null,0,$2::jsonb)", [
      org,
      JSON.stringify(header),
    ]),
  ).rejects.toThrow("Cliente no disponible");
  await expect(
    db.query("select public.save_studio_document($1,null,0,$2::jsonb)", [
      org,
      JSON.stringify({
        ...header,
        client_id: client,
        project_id: crypto.randomUUID(),
      }),
    ]),
  ).rejects.toThrow("Proyecto no disponible");
  const another = (
    await db.query<{ id: string }>(
      "insert into public.clients(organization_id,name) values($1,'Segundo cliente local') returning id",
      [org],
    )
  ).rows[0].id;
  const project = (
    await db.query<{ id: string }>(
      "select id from public.projects where organization_id=$1 limit 1",
      [org],
    )
  ).rows[0].id;
  await expect(
    db.query("select public.save_studio_document($1,null,0,$2::jsonb)", [
      org,
      JSON.stringify({ ...header, client_id: another, project_id: project }),
    ]),
  ).rejects.toThrow("otro cliente");
  await expect(
    db.query("select public.save_studio_document($1,null,0,$2::jsonb)", [
      org,
      JSON.stringify({
        ...header,
        client_id: client,
        margins: { ...header.margins, top: 0 },
      }),
    ]),
  ).rejects.toThrow("Márgenes inválidos");
});

it("eliminación lógica respeta rol, estudio y versión y conserva PDFs y trazabilidad", async () => {
  const { id, version, prepared } = await issuedFixture();
  for (const user of [other, reader]) {
    await asUser(user);
    await expect(
      db.query("select public.archive_quote($1,$2,$3)", [org, id, version]),
    ).rejects.toThrow("Permisos");
  }
  await asUser(owner);
  await expect(
    db.query("update public.quotes set deleted_at=now() where id=$1", [id]),
  ).rejects.toThrow();
  await expect(
    db.query("select public.archive_quote($1,$2,$3)", [org, id, version + 1]),
  ).rejects.toThrow("cambió");
  await db.query("select public.mark_quote_sent($1,$2,$3,$4)", [
    org,
    id,
    version,
    prepared.id,
  ]);
  const v = (
    await db.query<{ version: number }>(
      "select version from public.quotes where id=$1",
      [id],
    )
  ).rows[0].version;
  await db.query("select public.archive_quote($1,$2,$3)", [org, id, v]);
  expect(
    (
      await db.query(
        "select id from public.quotes where id=$1 and deleted_at is null",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query("select id from public.quote_items where quote_id=$1", [
        id,
      ])
    ).rows,
  ).toHaveLength(2);
  expect(
    (await db.query("select id from public.clients where id=$1", [client]))
      .rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query<{ snapshot: unknown }>(
        "select snapshot from public.quote_versions where id=$1",
        [prepared.id],
      )
    ).rows[0].snapshot,
  ).toEqual(prepared.snapshot);
  expect(
    (
      await db.query("select id from storage.objects where name=$1", [
        prepared.storage_path,
      ])
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "select id from public.audit_events where entity_id=$1 and action='archived'",
        [id],
      )
    ).rows,
  ).toHaveLength(1);
  await expect(
    db.query("select public.archive_quote($1,$2,$3)", [org, id, v]),
  ).rejects.toThrow("cambió");
  await expect(
    db.query(
      "select public.change_quote_lifecycle($1,$2,$3,'revise','Nueva revisión',null)",
      [org, id, v + 1],
    ),
  ).rejects.toThrow();
  await expect(
    db.query("select public.accept_quote($1,$2,$3,current_date,current_date)", [
      org,
      id,
      v + 1,
    ]),
  ).rejects.toThrow("eliminada");
  expect(
    (
      await db.query(
        "select id from public.projects where quote_version_id=$1",
        [prepared.id],
      )
    ).rows,
  ).toHaveLength(0);
});
it("cotización aceptada no se elimina ni altera sus obligaciones o pagos", async () => {
  const { id, version, prepared } = await issuedFixture();
  await db.query("select public.mark_quote_sent($1,$2,$3,$4)", [
    org,
    id,
    version,
    prepared.id,
  ]);
  const v = (
    await db.query<{ version: number }>(
      "select version from public.quotes where id=$1",
      [id],
    )
  ).rows[0].version;
  const project = (
    await db.query<{ id: string }>(
      "select public.accept_quote($1,$2,$3,current_date,current_date) id",
      [org, id, v],
    )
  ).rows[0].id;
  const plans = (
    await db.query(
      "select * from public.payment_schedules where project_id=$1 order by id",
      [project],
    )
  ).rows;
  await expect(
    db.query("select public.archive_quote($1,$2,$3)", [org, id, v + 1]),
  ).rejects.toThrow("proyecto");
  expect(
    (
      await db.query(
        "select id from public.quotes where id=$1 and deleted_at is null",
        [id],
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "select * from public.payment_schedules where project_id=$1 order by id",
        [project],
      )
    ).rows,
  ).toEqual(plans);
});
it("copia la clave real del catálogo a partida y snapshot sin modificar versiones previas", async () => {
  const { line, service } = await commercialFixture();
  await db.query("update public.services set code='ARQ-01' where id=$1", [
    service,
  ]);
  const id = await draft([
    {
      service_id: service,
      business_line_id: line,
      name: "Estudio",
      description: "Alcance",
      quantity: "1",
      unit: "fixed",
      unit_price_cents: 10000,
      discount_rate: "0",
    },
  ]);
  await db.query("update public.services set code='ARQ-02' where id=$1", [
    service,
  ]);
  expect(
    (
      await db.query<{ code: string }>(
        "select code from public.quote_items where quote_id=$1",
        [id],
      )
    ).rows[0].code,
  ).toBe("ARQ-01");
  const v = (
    await db.query<{ version: number }>(
      "select version from public.quotes where id=$1",
      [id],
    )
  ).rows[0].version;
  const result = (
    await db.query<{ data: { snapshot: { items: { code: string }[] } } }>(
      "select public.prepare_quote_version($1,$2,$3,$4::jsonb) data",
      [org, id, v, JSON.stringify(defaultDocumentOptions)],
    )
  ).rows[0].data;
  expect(result.snapshot.items[0].code).toBe("ARQ-01");
});

it("proyecto manual es idempotente y comparte total, anticipos, fechas y saldo sin cobros ficticios", async () => {
  await asUser(owner);
  const request = crypto.randomUUID();
  const create = () =>
    db.query<{ id: string }>(
      "select public.create_project_record($1,$2,'Obra existente',current_date,100000,$3) id",
      [org, client, request],
    );
  const id = (await create()).rows[0].id;
  expect((await create()).rows[0].id).toBe(id);
  const initial = (
    await db.query<{ collected_cents: number }>(
      "select collected_cents from public.project_financial_summary where project_id=$1",
      [id],
    )
  ).rows[0];
  expect(Number(initial.collected_cents)).toBe(0);
  const plan = (
    await db.query<{ id: string }>(
      "select id from public.payment_schedules where project_id=$1",
      [id],
    )
  ).rows[0].id;
  await db.query(
    "select public.record_payment($1,$2,25000,(now() at time zone 'America/Mexico_City')::date-1,'Anticipo',$3)",
    [org, plan, crypto.randomUUID()],
  );
  const result = (
    await db.query<{
      amount_cents: string;
      collected_cents: string;
      balance_cents: string;
    }>(
      "select amount_cents::text,collected_cents::text,balance_cents::text from public.project_financial_summary where project_id=$1",
      [id],
    )
  ).rows[0];
  expect(result).toEqual({
    amount_cents: "100000",
    collected_cents: "25000",
    balance_cents: "75000",
  });
  await asUser(reader);
  expect(
    (
      await db.query(
        "select * from public.project_financial_summary where project_id=$1",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
  await expect(
    db.query(
      "select public.create_project_record($1,$2,'No permitido',current_date,0,$3)",
      [org, client, crypto.randomUUID()],
    ),
  ).rejects.toThrow("Permisos");
});
it("pendientes por proyecto se completan y reabren con versión, RLS y auditoría", async () => {
  await asUser(owner);
  const project = (
    await db.query<{ id: string }>(
      "select public.create_project_record($1,$2,'Obra sin importe',current_date,0,$3) id",
      [org, client, crypto.randomUUID()],
    )
  ).rows[0].id;
  await db.query(
    "select public.define_project_amount($1,$2,1,50000,current_date)",
    [org, project],
  );
  await expect(
    db.query(
      "select public.define_project_amount($1,$2,1,70000,current_date)",
      [org, project],
    ),
  ).rejects.toThrow("cambió");
  const id = (
    await db.query<{ id: string }>(
      "insert into public.project_notes(organization_id,project_id,body,kind) values($1,$2,'Corregir plano de iluminación','task') returning id",
      [org, project],
    )
  ).rows[0].id;
  await db.query(
    "update public.project_notes set completed_at=now() where id=$1 and version=1",
    [id],
  );
  expect(
    (
      await db.query(
        "select id from public.project_notes_context where id=$1 and completed_at is null",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "update public.project_notes set body='Conflicto' where id=$1 and version=1 returning id",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
  await db.query(
    "update public.project_notes set completed_at=null where id=$1 and version=2",
    [id],
  );
  expect(
    (
      await db.query(
        "select id from public.project_notes_context where id=$1 and completed_at is null",
        [id],
      )
    ).rows,
  ).toHaveLength(1);
  await asUser(other);
  expect(
    (await db.query("select id from public.project_notes where id=$1", [id]))
      .rows,
  ).toHaveLength(0);
  await expect(
    db.query(
      "insert into public.project_notes(organization_id,project_id,body) values($1,$2,'Referencia cruzada')",
      [otherOrg, project],
    ),
  ).rejects.toThrow();
  await asUser(reader);
  expect(
    (
      await db.query(
        "update public.project_notes set completed_at=now() where id=$1 returning id",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
});
it("fotografías privadas requieren archivo completo y se conservan inmutables al publicar", async () => {
  await asUser(owner);
  const project = (
    await db.query<{ id: string }>(
      "select public.create_project_record($1,$2,'Visita de obra',current_date,0,$3) id",
      [org, client, crypto.randomUUID()],
    )
  ).rows[0].id;
  const observation = crypto.randomUUID(),
    photo = crypto.randomUUID(),
    path = org + "/" + observation + "/" + photo + ".jpg";
  await db.query(
    "insert into public.project_observations(id,organization_id,project_id,body,observed_on) values($1,$2,$3,'Revisar acabado',(now() at time zone 'America/Mexico_City')::date)",
    [observation, org, project],
  );
  await db.query(
    "insert into public.project_photos(id,organization_id,observation_id,storage_path,byte_size) values($1,$2,$3,$4,500)",
    [photo, org, observation, path],
  );
  await expect(
    db.query("select public.publish_project_observation($1,$2)", [
      org,
      observation,
    ]),
  ).rejects.toThrow("sin guardar");
  await asUser(reader);
  expect(
    (
      await db.query("select id from public.project_observations where id=$1", [
        observation,
      ])
    ).rows,
  ).toHaveLength(0);
  await asUser(owner);
  await db.query(
    "insert into storage.objects(bucket_id,name) values('project-photos',$1)",
    [path],
  );
  await db.query("select public.publish_project_observation($1,$2)", [
    org,
    observation,
  ]);
  expect(
    (
      await db.query("delete from storage.objects where name=$1 returning id", [
        path,
      ])
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "update storage.objects set name='overwrite.jpg' where name=$1 returning id",
        [path],
      )
    ).rows,
  ).toHaveLength(0);
  await expect(
    db.query("select public.discard_project_observation($1,$2)", [
      org,
      observation,
    ]),
  ).rejects.toThrow("publicada");
  await expect(
    db.query(
      "insert into public.project_photos(id,organization_id,observation_id,storage_path,byte_size) values($1,$2,$3,$4,500)",
      [crypto.randomUUID(), org, observation, "invalid"],
    ),
  ).rejects.toThrow();
  await asUser(reader);
  expect(
    (await db.query("select id from storage.objects where name=$1", [path]))
      .rows,
  ).toHaveLength(1);
  await asUser(other);
  expect(
    (await db.query("select id from storage.objects where name=$1", [path]))
      .rows,
  ).toHaveLength(0);
});

async function photoDraft() {
  await asUser(owner);
  const project = (
    await db.query<{ id: string }>(
      "select public.create_project_record($1,$2,'Carga directa de prueba',current_date,0,$3) id",
      [org, client, crypto.randomUUID()],
    )
  ).rows[0].id;
  const observation = crypto.randomUUID(),
    photo = crypto.randomUUID();
  const path = `${org}/${observation}/${photo}.jpg`;
  await db.query(
    "insert into public.project_observations(id,organization_id,project_id,body,observed_on) values($1,$2,$3,'Prueba de fotos',(now() at time zone 'America/Mexico_City')::date)",
    [observation, org, project],
  );
  await db.query(
    "insert into public.project_photos(id,organization_id,observation_id,storage_path,byte_size) values($1,$2,$3,$4,500)",
    [photo, org, observation, path],
  );
  return { project, observation, photo, path };
}
it("Storage temporal es privado: solo autor con permiso y ruta preparada, nunca lectores/anon/otro estudio", async () => {
  const draft = await photoDraft();
  await db.exec("reset role");
  const bucket = (
    await db.query<{
      public: boolean;
      file_size_limit: number;
      allowed_mime_types: string[];
    }>(
      "select public,file_size_limit,allowed_mime_types from storage.buckets where id='project-photo-uploads'",
    )
  ).rows[0];
  expect(bucket).toMatchObject({
    public: false,
    allowed_mime_types: ["image/jpeg"],
  });
  expect(Number(bucket.file_size_limit)).toBe(2097152);
  await asUser(owner);
  await db.query(
    "insert into storage.objects(bucket_id,name) values('project-photo-uploads',$1)",
    [draft.path],
  );
  expect(
    (
      await db.query(
        "select id from storage.objects where bucket_id='project-photo-uploads' and name=$1",
        [draft.path],
      )
    ).rows,
  ).toHaveLength(1);
  await expect(
    db.query(
      "insert into storage.objects(bucket_id,name) values('project-photo-uploads','ruta-no-preparada.jpg')",
    ),
  ).rejects.toThrow();
  for (const user of [reader, other]) {
    await asUser(user);
    expect(
      (
        await db.query(
          "select id from storage.objects where bucket_id='project-photo-uploads' and name=$1",
          [draft.path],
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.query(
        "insert into storage.objects(bucket_id,name) values('project-photo-uploads',$1)",
        [draft.path + ".otra"],
      ),
    ).rejects.toThrow();
    expect(
      (
        await db.query(
          "delete from storage.objects where bucket_id='project-photo-uploads' and name=$1 returning id",
          [draft.path],
        )
      ).rows,
    ).toHaveLength(0);
  }
  // Otro colaborador del mismo estudio tampoco puede leer borradores ajenos.
  await db.exec(
    `reset role; insert into public.memberships(organization_id,user_id,role) values('${org}','${other}','collaborator');`,
  );
  await asUser(other);
  expect(
    (
      await db.query(
        "select id from storage.objects where bucket_id='project-photo-uploads' and name=$1",
        [draft.path],
      )
    ).rows,
  ).toHaveLength(0);
  await db.exec(
    `reset role; delete from public.memberships where organization_id='${org}' and user_id='${other}'; set role anon;`,
  );
  expect(
    (
      await db.query(
        "select id from storage.objects where bucket_id='project-photo-uploads' and name=$1",
        [draft.path],
      )
    ).rows,
  ).toHaveLength(0);
  await asUser(owner);
});
it("un temporal no permite publicar: requiere copia definitiva y conserva inmutabilidad después", async () => {
  const draft = await photoDraft();
  await db.query(
    "insert into storage.objects(bucket_id,name) values('project-photo-uploads',$1)",
    [draft.path],
  );
  await expect(
    db.query("select public.publish_project_observation($1,$2)", [
      org,
      draft.observation,
    ]),
  ).rejects.toThrow("sin guardar");
  await db.query(
    "insert into storage.objects(bucket_id,name) values('project-photos',$1)",
    [draft.path],
  );
  // Solo el autor puede leer definitivos en preparación para verificar reintentos.
  expect(
    (
      await db.query(
        "select id from storage.objects where bucket_id='project-photos' and name=$1",
        [draft.path],
      )
    ).rows,
  ).toHaveLength(1);
  await asUser(reader);
  expect(
    (
      await db.query(
        "select id from storage.objects where bucket_id='project-photos' and name=$1",
        [draft.path],
      )
    ).rows,
  ).toHaveLength(0);
  await asUser(owner);
  await db.query("update public.project_photos set byte_size=450 where id=$1", [
    draft.photo,
  ]);
  await expect(
    db.query(
      "update public.project_photos set storage_path='otro.jpg' where id=$1",
      [draft.photo],
    ),
  ).rejects.toThrow(/permission/i);
  await db.query("select public.publish_project_observation($1,$2)", [
    org,
    draft.observation,
  ]);
  expect(
    (
      await db.query(
        "update public.project_photos set byte_size=400 where id=$1 returning id",
        [draft.photo],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "delete from storage.objects where bucket_id='project-photos' and name=$1 returning id",
        [draft.path],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.query(
        "delete from storage.objects where bucket_id='project-photo-uploads' and name=$1 returning id",
        [draft.path],
      )
    ).rows,
  ).toHaveLength(1);
  await asUser(reader);
  expect(
    (
      await db.query(
        "select id from storage.objects where bucket_id='project-photos' and name=$1",
        [draft.path],
      )
    ).rows,
  ).toHaveLength(1);
  await asUser(owner);
});
it("limita cinco fotos por observación y bloquea cargas en proyectos archivados", async () => {
  const draft = await photoDraft();
  for (let i = 0; i < 4; i++) {
    const photo = crypto.randomUUID();
    await db.query(
      "insert into public.project_photos(id,organization_id,observation_id,storage_path,byte_size) values($1,$2,$3,$4,2097152)",
      [
        photo,
        org,
        draft.observation,
        `${org}/${draft.observation}/${photo}.jpg`,
      ],
    );
  }
  const sixth = crypto.randomUUID();
  await expect(
    db.query(
      "insert into public.project_photos(id,organization_id,observation_id,storage_path,byte_size) values($1,$2,$3,$4,1)",
      [
        sixth,
        org,
        draft.observation,
        `${org}/${draft.observation}/${sixth}.jpg`,
      ],
    ),
  ).rejects.toThrow("cinco");
  await expect(
    db.query("update public.project_photos set byte_size=2097153 where id=$1", [
      draft.photo,
    ]),
  ).rejects.toThrow();
  await db.exec(
    `reset role; update public.projects set deleted_at=now() where id='${draft.project}';`,
  );
  await asUser(owner);
  await expect(
    db.query(
      "insert into storage.objects(bucket_id,name) values('project-photo-uploads',$1)",
      [draft.path],
    ),
  ).rejects.toThrow();
});

it("preparación RPC atómica e idempotente conserva orden y no duplica observación ante reintentos", async () => {
  const draft = await photoDraft();
  const id = crypto.randomUUID();
  const args = [org, draft.project, id, "Visita directa"];
  const sql =
    "select public.prepare_project_observation($1,$2,$3,$4,(now() at time zone 'America/Mexico_City')::date,array[100,200,300,400,500]) plan";
  const first = (
    await db.query<{
      plan: { observation: string; photos: { path: string; size: number }[] };
    }>(sql, args)
  ).rows[0].plan;
  const second = (await db.query<{ plan: typeof first }>(sql, args)).rows[0]
    .plan;
  expect(first).toEqual(second);
  expect(first.observation).toBe(id);
  expect(first.photos.map((p) => p.size)).toEqual([100, 200, 300, 400, 500]);
  expect(
    (
      await db.query("select id from public.project_observations where id=$1", [
        id,
      ])
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.query(
        "select id from public.project_photos where observation_id=$1",
        [id],
      )
    ).rows,
  ).toHaveLength(5);
  await expect(
    db.query(sql, [org, draft.project, id, "Contenido cambiado"]),
  ).rejects.toThrow("otro registro");
  await expect(
    db.query(
      "select public.prepare_project_observation($1,$2,$3,'Inválida',current_date,array[100,0])",
      [org, draft.project, crypto.randomUUID()],
    ),
  ).rejects.toThrow();
  const empty = (
    await db.query<{ plan: { photos: unknown[] } }>(
      "select public.prepare_project_observation($1,$2,$3,'Sin fotos',(now() at time zone 'America/Mexico_City')::date,array[]::integer[]) plan",
      [org, draft.project, crypto.randomUUID()],
    )
  ).rows[0].plan;
  expect(empty.photos).toEqual([]);
});
it("RPC de preparación rechaza lector, estudio ajeno y más de cinco imágenes sin crear registros", async () => {
  const draft = await photoDraft();
  const id = crypto.randomUUID();
  const sql =
    "select public.prepare_project_observation($1,$2,$3,'No permitida',(now() at time zone 'America/Mexico_City')::date,array[100])";
  await asUser(reader);
  await expect(db.query(sql, [org, draft.project, id])).rejects.toThrow(
    "Permisos",
  );
  await asUser(other);
  await expect(db.query(sql, [otherOrg, draft.project, id])).rejects.toThrow(
    "Proyecto",
  );
  await asUser(owner);
  await expect(
    db.query(
      "select public.prepare_project_observation($1,$2,$3,'Exceso',current_date,array[1,2,3,4,5,6])",
      [org, draft.project, id],
    ),
  ).rejects.toThrow();
  expect(
    (
      await db.query("select id from public.project_observations where id=$1", [
        id,
      ])
    ).rows,
  ).toHaveLength(0);
});
