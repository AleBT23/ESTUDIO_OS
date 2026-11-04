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
    `${await readFile("tests/fixtures/pg-bootstrap.sql","utf8")} insert into auth.users values('${owner}'),('${other}'),('${reader}');`,
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
  expect(rows).toHaveLength(37);
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

it("separa cobros parciales, anticipos, costo y fondos de obra con aislamiento", async () => {
  await asUser(owner);
  const service = crypto.randomUUID();
  const managed = crypto.randomUUID();
  const create = (id:string, area:string, custody:boolean) => db.query(
    "insert into finance_cases(id,organization_id,name,area,managed,revenue_cents,cost_cents) values($1,$2,'Estudio de suelos',$3,$4,1200000,960000)",
    [id,org,area,custody]);
  await create(service,"service",false);
  await create(managed,"construction",true);
  await expect(create(crypto.randomUUID(),"architecture",true)).rejects.toThrow();
  const enter = (id:string,target:string,direction:string,amount:number,advance=false) => db.query(
    "insert into finance_entries(id,organization_id,case_id,direction,amount_cents,paid_on,advance) values($1,$2,$3,$4,$5,current_date-1,$6)",
    [id,org,target,direction,amount,advance]);
  const first=crypto.randomUUID();
  await enter(first,service,"in",300000,true);
  await expect(enter(first,service,"in",300000,true)).rejects.toThrow();
  await enter(crypto.randomUUID(),service,"in",200000);
  await enter(crypto.randomUUID(),service,"out",160000);
  await expect(enter(crypto.randomUUID(),service,"out",800001)).rejects.toThrow(/saldo/);
  const balance = (id:string) => db.query("select receivable_cents::int,payable_cents::int,expected_margin_cents::int,cash_cents::int from finance_case_balances where id=$1",[id]);
  expect((await balance(service)).rows[0]).toEqual({receivable_cents:700000,payable_cents:800000,expected_margin_cents:240000,cash_cents:340000});
  await enter(crypto.randomUUID(),managed,"in",100000,true);
  expect((await balance(managed)).rows[0]).toMatchObject({expected_margin_cents:null,cash_cents:100000});
  const totals = await db.query("select area,managed,received_cents,cash_cents,expected_margin_cents from finance_area_indicators where organization_id=$1 and source='operations'",[org]);
  expect(totals.rows).toEqual(expect.arrayContaining([
    {area:"service",managed:false,received_cents:"500000",cash_cents:"340000",expected_margin_cents:"240000"},
    {area:"construction",managed:true,received_cents:"100000",cash_cents:"100000",expected_margin_cents:null}
  ]));
  for (const user of [other,reader]) {
    await asUser(user);
    expect((await balance(service)).rows).toHaveLength(0);
    await expect(enter(crypto.randomUUID(),service,"in",1)).rejects.toThrow();
  }
  await asUser(owner);
});

it("calcula por obra y custodia, sin mezclar obras ni organizaciones", async () => {
 await asUser(owner);
 const work=crypto.randomUUID(),otherWork=crypto.randomUUID();
 for(const id of [work,otherWork]) await db.query("insert into works(id,organization_id,name) values($1,$2,'Obra de prueba')",[id,org]);
 for(const [target,managed,amount] of [[work,true,7000],[work,false,3000],[otherWork,true,1000]] as const){
 const id=crypto.randomUUID();
 await db.query("insert into finance_cases(id,organization_id,name,area,managed,work_id,revenue_cents,cost_cents) values($1,$2,'Acuerdo','construction',$3,$4,$5,100)",[id,org,managed,target,amount]);
 await db.query("insert into finance_entries(id,organization_id,case_id,direction,paid_on,amount_cents) values($1,$2,$3,'in',current_date-1,$4)",[crypto.randomUUID(),org,id,amount]);
 }
 const balances=()=>db.query("select managed,cash_cents,expected_margin_cents from work_balances where work_id=$1 order by managed",[work]);
 expect((await balances()).rows).toEqual([{managed:false,cash_cents:"3000",expected_margin_cents:"2900"},{managed:true,cash_cents:"7000",expected_margin_cents:null}]);
 await asUser(other); expect((await balances()).rows).toHaveLength(0);
 await asUser(owner);
});

it("un reverso conserva el importe y el actor y libera el saldo una sola vez",async()=>{
 await asUser(owner);
 const id=crypto.randomUUID(),entry=crypto.randomUUID();
 await db.query("insert into finance_cases(id,organization_id,name,area,revenue_cents,cost_cents) values($1,$2,'Costo independiente','service',0,12345)",[id,org]);
 const pay=(key:string)=>db.query("insert into finance_entries(id,organization_id,case_id,direction,paid_on,amount_cents) values($1,$2,$3,'out',current_date-1,12345)",[key,org,id]);
 await pay(entry);
 const reverse=()=>db.query("update finance_entries set reversal_reason='Referencia equivocada' where id=$1 returning id",[entry]);
 await asUser(other);expect((await reverse()).rows).toHaveLength(0);
 await asUser(owner);await reverse();await expect(reverse()).rejects.toThrow();
 await expect(db.query("update finance_entries set amount_cents=0 where id=$1",[entry])).rejects.toThrow();
 expect((await db.query("select amount_cents::int,reversed_by from finance_entries where id=$1",[entry])).rows[0]).toEqual({amount_cents:12345,reversed_by:owner});
 expect((await db.query("select payable_cents::int,paid_cents::int from finance_case_balances where id=$1",[id])).rows[0]).toEqual({payable_cents:12345,paid_cents:0});
 await pay(crypto.randomUUID());
});

it("presupuesta cantidades fraccionarias redondeadas por partida sin registrar pagos",async()=>{
 await asUser(owner);const work=crypto.randomUUID();
 await db.query("insert into works(id,organization_id,name) values($1,$2,'Obra presupuestada')",[work,org]);
 const add=()=>db.query("insert into work_budget_items(id,organization_id,work_id,chapter,description,unit,quantity,unit_price_cents) values($1,$2,$3,'Materiales','Acabado','m2',1.125,100)",[crypto.randomUUID(),org,work]);
 await add();await add();
 const sum=()=>db.query("select base_cents from work_budget_totals where work_id=$1",[work]);
 expect((await sum()).rows).toEqual([{base_cents:"226"}]);
 expect((await db.query("select * from work_balances where work_id=$1",[work])).rows).toHaveLength(0);
 await asUser(reader);expect((await sum()).rows).toHaveLength(0);await expect(add()).rejects.toThrow();
 await asUser(owner);
});

it("facturar deja intactos caja y cartera, y el folio identifica duplicados dentro del estudio", async()=>{
 await asUser(owner);const id=crypto.randomUUID();
 await db.query("insert into finance_cases(id,organization_id,name,area,revenue_cents,cost_cents) values($1,$2,'Honorarios','architecture',10000,0)",[id,org]);
 const add=(ref:string)=>db.query("insert into case_invoices(id,organization_id,case_id,reference,issued_on,amount_cents) values($1,$2,$3,$4,current_date,4000)",[crypto.randomUUID(),org,id,ref]);
 await add("A-25");await expect(add(" a-25 ")).rejects.toThrow();
 const total=()=>db.query("select invoiced_cents from case_invoice_totals where case_id=$1",[id]);
 expect((await total()).rows).toEqual([{invoiced_cents:"4000"}]);
 expect((await db.query("select received_cents::int,receivable_cents::int from finance_case_balances where id=$1",[id])).rows).toEqual([{received_cents:0,receivable_cents:10000}]);
 await asUser(other);expect((await total()).rows).toHaveLength(0);await expect(add("B-25")).rejects.toThrow();
 await asUser(owner);
});

it("vincula subcontratistas del propio estudio y conserva el nombre en el acuerdo",async()=>{
 await asUser(owner);const supplier=crypto.randomUUID();
 await db.query("insert into suppliers(id,organization_id,name,kind) values($1,$2,'Topografía Norte','subcontractor')",[supplier,org]);
 const add=(organization:string)=>db.query("insert into finance_cases(id,organization_id,name,area,cost_cents,revenue_cents,supplier_id) values($1,$2,'Levantamiento','service',12300,0,$3) returning provider",[crypto.randomUUID(),organization,supplier]);
 expect((await add(org)).rows).toEqual([{provider:"Topografía Norte"}]);
 await asUser(other);await expect(add(otherOrg)).rejects.toThrow();expect((await db.query('select id from suppliers where id=$1',[supplier])).rows).toHaveLength(0);await asUser(owner);
});

it("las comunicaciones y la bitácora usan su expediente, categorías y permisos",async()=>{
 await asUser(owner);const work=crypto.randomUUID();
 await db.query("insert into works(id,organization_id,name) values($1,$2,'Visita de campo')",[work,org]);
 const add=(kind:string,c:string|null,w:string|null)=>db.query("insert into journal_entries(id,organization_id,client_id,work_id,kind,occurred_on,body) values($1,$2,$3,$4,$5,current_date,'Acuerdos registrados')",[crypto.randomUUID(),org,c,w,kind]);
 await add("call",client,null);await add("incident",null,work);
 await expect(add("call",null,work)).rejects.toThrow();await expect(add("visit",client,work)).rejects.toThrow();
 await asUser(other);expect((await db.query("select * from journal_entries where organization_id=$1",[org])).rows).toHaveLength(0);
 await expect(add("call",client,null)).rejects.toThrow();await asUser(owner);
});

it("el entregable conserva revisiones ordenadas y se cierra al aprobar",async()=>{
 await asUser(owner);const project=(await db.query<{id:string}>("select public.create_project_record($1,$2,'Proyecto de revisiones',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const id=crypto.randomUUID();
 await db.query("insert into project_deliverables(id,organization_id,project_id,stage,name,due_on,assignee) values($1,$2,$3,'Ejecutivo','Plano de cimentación',current_date,$4)",[id,org,project,owner]);
 const add=(version:number,state:string)=>db.query("insert into deliverable_revisions(id,organization_id,project_id,deliverable_id,revision,state,notes) values($1,$2,$3,$4,$5,$6,'Comentarios del plano')",[crypto.randomUUID(),org,project,id,version,state]);
 await expect(add(1,"approved")).rejects.toThrow();
 await add(1,"review");await expect(add(1,"review")).rejects.toThrow();
 await add(2,"changes");await add(3,"review");await add(4,"approved");await expect(add(5,"review")).rejects.toThrow();
 await asUser(reader);expect((await db.query("select state,revision from deliverable_status where id=$1",[id])).rows).toEqual([{state:"approved",revision:4}]);await expect(add(5,"review")).rejects.toThrow();
 await asUser(other);expect((await db.query("select * from deliverable_revisions where deliverable_id=$1",[id])).rows).toHaveLength(0);await asUser(owner);
});

it("el calendario deriva cobros efectivos pendientes, respeta permisos y retira el aviso al liquidar",async()=>{
 await asUser(owner);const project=(await db.query<{id:string}>("select public.create_project_record($1,$2,'Proyecto con vencimiento',current_date,4000,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const dues=()=>db.query<{id:string}>("select id from agenda_events where organization_id=$1 and project_id=$2 and kind='collection'",[org,project]);
 const schedule=(await dues()).rows[0].id;
 await asUser(reader);expect((await dues()).rows).toHaveLength(0);
 await asUser(owner);await db.query("select public.record_payment($1,$2,1500,current_date-1,'Parcial',$3)",[org,schedule,crypto.randomUUID()]);expect((await dues()).rows).toHaveLength(1);
 await db.query("select public.record_payment($1,$2,2500,current_date-1,'Liquidación',$3)",[org,schedule,crypto.randomUUID()]);expect((await dues()).rows).toHaveLength(0);
});

it("estima el avance parcial con redondeo acumulado y protege la partida de reintentos y sobreestimación",async()=>{
 await asUser(owner);
 const work=crypto.randomUUID(),item=crypto.randomUUID();
 await db.query("insert into works(id,organization_id,name) values($1,$2,'Estimación de prueba')",[work,org]);
 await db.query("insert into work_budget_items(id,organization_id,work_id,chapter,description,unit,quantity,unit_price_cents) values($1,$2,$3,'Acabados','Pintura','m2',1,3)",[item,org,work]);
 const add=(id:string,q:string)=>db.query("insert into work_estimates(id,organization_id,work_id,item_id,measured_on,quantity) values($1,$2,$3,$4,current_date,$5) on conflict do nothing",[id,org,work,item,q]);
 const first=crypto.randomUUID();await add(first,"0.5");await add(first,"0.5");
 const progress=()=>db.query("select budget,earned,outstanding from work_item_progress where id=$1",[item]);
 expect((await progress()).rows).toEqual([{budget:"3",earned:"2",outstanding:"1"}]);
 await asUser(other);expect((await progress()).rows).toHaveLength(0);await asUser(owner);
 await expect(add(crypto.randomUUID(),"0.6")).rejects.toThrow();
 await add(crypto.randomUUID(),"0.5");
 expect((await db.query("select count(*)::int entries,sum(amount_cents)::int total from work_estimates where item_id=$1",[item])).rows).toEqual([{entries:2,total:3}]);
 expect((await db.query("select * from work_balances where work_id=$1",[work])).rows).toHaveLength(0);
 await asUser(other);expect((await db.query("select * from work_estimates where item_id=$1",[item])).rows).toHaveLength(0);await asUser(owner);
});

it("asocia recursos a la partida y rechaza consumos de otra obra u organización",async()=>{
 await asUser(owner);
 const work=crypto.randomUUID(),second=crypto.randomUUID(),item=crypto.randomUUID();
 for(const id of [work,second])await db.query("insert into works(id,organization_id,name) values($1,$2,'Control de consumos')",[id,org]);
 await db.query("insert into work_budget_items(id,organization_id,work_id,chapter,description,unit,quantity,unit_price_cents) values($1,$2,$3,'Campo','Levantamiento','jornada',1,100)",[item,org,work]);
 const add=(w:string,category:string)=>db.query("insert into work_resource_usage(id,organization_id,work_id,item_id,category,description,used_on,quantity,unit) values($1,$2,$3,$4,$5,'Equipo en campo',current_date,2.5,'horas')",[crypto.randomUUID(),org,w,item,category]);
 for(const t of ["labor","equipment","material"])await add(work,t);
 await expect(add(second,"labor")).rejects.toThrow();await expect(add(work,"financial")).rejects.toThrow();
 expect((await db.query("select estimated_quantity::int from work_budget_items where id=$1",[item])).rows).toEqual([{estimated_quantity:0}]);
 await asUser(other);expect((await db.query("select * from work_resource_usage where item_id=$1",[item])).rows).toHaveLength(0);await asUser(owner);
});

it("completar un pendiente semanal genera una única ocurrencia y conserva prioridad y responsable",async()=>{
 await asUser(owner);
 const project=(await db.query<{id:string}>("select public.create_project_record($1,$2,'Agenda semanal',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const id=(await db.query<{id:string}>("insert into project_notes(organization_id,project_id,kind,body,due_on,assignee,priority,repeat_days) values($1,$2,'task','Visita semanal','2026-12-29',$3,'high',7) returning id",[org,project,owner])).rows[0].id;
 const toggle=(done:boolean)=>db.query("update project_notes set completed_at=case when $2 then now() else null end where id=$1",[id,done]);
 await toggle(true);await toggle(false);await toggle(true);
 const rows=await db.query("select due_on::text due,priority,assignee,repeat_days from project_notes_context where project_id=$1 and completed_at is null",[project]);
 expect(rows.rows).toEqual([{due:"2027-01-05",priority:"high",assignee:owner,repeat_days:7}]);
 await expect(db.query("update project_notes set assignee=$2 where id=$1",[id,other])).rejects.toThrow();
 await expect(db.query("update project_notes set due_on=null where id=$1",[id])).rejects.toThrow();
});

it("publica comprobantes solo tras cargar el objeto y limita acceso, sustitución y borrado",async()=>{
 await asUser(owner);
 const account=crypto.randomUUID(),entry=crypto.randomUUID(),receipt=crypto.randomUUID(),hash="a".repeat(64),path=[org,entry,hash].join("/");
 await db.query("insert into finance_cases(id,organization_id,name,area,revenue_cents,cost_cents) values($1,$2,'Reembolso','service',100,0)",[account,org]);
 await db.query("insert into finance_entries(id,organization_id,case_id,direction,amount_cents,paid_on) values($1,$2,$3,'in',100,current_date-1)",[entry,org,account]);
 const put=(name:string)=>db.query("insert into storage.objects(bucket_id,name) values('finance-receipts',$1)",[name]);
 await expect(put(path)).rejects.toThrow();
 await db.query("insert into finance_receipts(id,organization_id,entry_id,filename,mime,sha256,size_bytes) values($1,$2,$3,'Nota.pdf','application/pdf',$4,10)",[receipt,org,entry,hash]);
 const list=()=>db.query("select id from available_receipts where entry_id=$1",[entry]);expect((await list()).rows).toHaveLength(0);
 await asUser(other);await expect(put(path)).rejects.toThrow();await asUser(owner);await put(path);
 expect((await list()).rows).toEqual([{id:receipt}]);
 expect((await db.query("delete from storage.objects where name=$1 returning name",[path])).rows).toHaveLength(0);
 expect((await db.query("update storage.objects set name=name where name=$1 returning name",[path])).rows).toHaveLength(0);
 for(const user of [reader,other]){await asUser(user);expect((await list()).rows).toHaveLength(0);expect((await db.query("select name from storage.objects where name=$1",[path])).rows).toHaveLength(0);}
 await asUser(owner);
});

it("el contrato firmado conserva el cliente del proyecto y no duplica sus cobros",async()=>{
 await asUser(owner);
 const proj=(await db.query<{id:string}>("select public.create_project_record($1,$2,'Proyecto contratado',current_date,5000,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const another=(await db.query<{id:string}>("insert into clients(organization_id,name) values($1,'Cliente distinto') returning id",[org])).rows[0].id;
 const create=(customer:string,reference:string)=>db.query("insert into contracts(id,organization_id,client_id,project_id,reference,title,signed_on,scope) values($1,$2,$3,$4,$5,'Servicios técnicos',current_date,'Planos ejecutivos')",[crypto.randomUUID(),org,customer,proj,reference]);
 await create(client,"CT-A");await expect(create(client," ct-a ")).rejects.toThrow();await expect(create(another,"CT-B")).rejects.toThrow();
 expect((await db.query("select collected_cents::int,balance_cents::int from project_financial_summary where project_id=$1",[proj])).rows).toEqual([{collected_cents:0,balance_cents:5000}]);
 for(const user of [reader,other]){await asUser(user);expect((await db.query("select id from contracts where project_id=$1",[proj])).rows).toHaveLength(0);await expect(create(client,"CT-C")).rejects.toThrow();}
 await asUser(owner);
});

it("el cliente solo consulta entregas aprobadas y publicadas hasta que se revoca su acceso",async()=>{
 const external=crypto.randomUUID();await db.exec("reset role");await db.query("insert into auth.users(id) values($1)",[external]);await asUser(owner);
 const project=(await db.query<{id:string}>("select public.create_project_record($1,$2,'Portal privado',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const delivery=crypto.randomUUID();
 await db.query("insert into project_deliverables(id,organization_id,project_id,stage,name,due_on) values($1,$2,$3,'Planos','Entrega autorizada',current_date)",[delivery,org,project]);
 const publish=()=>db.query("insert into portal_deliveries(id,organization_id,project_id,deliverable_id,resource_url) values($1,$2,$3,$4,'https://example.test/plano')",[crypto.randomUUID(),org,project,delivery]);
 await expect(publish()).rejects.toThrow();for(const [rev,state] of [[1,"review"],[2,"approved"]])await db.query("insert into deliverable_revisions(id,organization_id,project_id,deliverable_id,revision,state,notes) values($1,$2,$3,$4,$5,$6,'Nota interna')",[crypto.randomUUID(),org,project,delivery,rev,state]);await publish();
 const list=()=>db.query("select title from my_portal_deliveries");await asUser(external);expect((await list()).rows).toHaveLength(0);await asUser(owner);
 await db.query("insert into client_portal_access(organization_id,client_id,user_id) values($1,$2,$3)",[org,client,external]);await asUser(external);expect((await list()).rows).toEqual([{title:"Entrega autorizada"}]);expect((await db.query("select * from deliverable_revisions where deliverable_id=$1",[delivery])).rows).toHaveLength(0);
 await asUser(owner);await db.query("update portal_deliveries set visible=false where deliverable_id=$1",[delivery]);await asUser(external);expect((await list()).rows).toHaveLength(0);
 await asUser(owner);await db.query("update portal_deliveries set visible=true where deliverable_id=$1",[delivery]);await db.query("update client_portal_access set enabled=false where user_id=$1",[external]);await asUser(external);expect((await list()).rows).toHaveLength(0);await asUser(owner);
});

it("el colaborador registra tiempo propio por tarea, con corrección versionada y aislamiento",async()=>{
 const worker=crypto.randomUUID();await db.exec("reset role");await db.query("insert into auth.users(id) values($1)",[worker]);await db.query("insert into memberships(organization_id,user_id,role) values($1,$2,'collaborator')",[org,worker]);await asUser(owner);
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Control de tiempo',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const task=(await db.query<{id:string}>("insert into project_notes(organization_id,project_id,body) values($1,$2,'Revisión') returning id",[org,project])).rows[0].id;
 const add=(id:string)=>db.query("insert into project_time(id,organization_id,project_id,task_id,worked_on,minutes,description) values($1,$2,$3,$4,current_date,45,'Revisión de planos')",[id,org,project,task]);
 const managerEntry=crypto.randomUUID(),entry=crypto.randomUUID();await add(managerEntry);await asUser(worker);await add(entry);
 expect((await db.query("select id from project_time where project_id=$1",[project])).rows).toEqual([{id:entry}]);
 await db.query("update project_time set minutes=60 where id=$1 and version=1",[entry]);
 expect((await db.query("update project_time set minutes=70 where id=$1 and version=1 returning id",[entry])).rows).toHaveLength(0);
 expect((await db.query("select (previous_values->>'minutes')::int minutes,actor_id from time_corrections where time_id=$1",[entry])).rows).toEqual([{minutes:45,actor_id:worker}]);
 await asUser(owner);expect((await db.query("select sum(minutes)::int minutes from project_time where project_id=$1",[project])).rows).toEqual([{minutes:105}]);
 await asUser(reader);await expect(add(crypto.randomUUID())).rejects.toThrow();expect((await db.query("select * from time_corrections where time_id=$1",[entry])).rows).toHaveLength(0);await asUser(owner);
});

it("el reparto compromete un único costo, limita los porcentajes y concilia pagos parciales",async()=>{
 await asUser(owner);const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Reparto por paquete',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const pack=crypto.randomUUID();await db.exec("reset role");
 await db.query("insert into project_service_packages(id,organization_id,project_id,business_line_id,name,scope) select $1,$2,$3,id,'Visualización','[]'::jsonb from business_lines where organization_id=$2 limit 1",[pack,org,project]);
 await db.query("insert into package_financials(organization_id,package_id,contracted_net_cents) values($1,$2,10001)",[org,pack]);await asUser(owner);
 const fee=crypto.randomUUID();const add=(id:string,bps:number)=>db.query("insert into collaborator_fees(id,organization_id,project_id,package_id,member_id,label,rate_bps) values($1,$2,$3,$4,$5,'Modelado', $6) on conflict do nothing",[id,org,project,pack,owner,bps]);
 await add(fee,5000);await add(fee,5000);await expect(add(crypto.randomUUID(),5001)).rejects.toThrow();
 expect((await db.query("select allocated_bps from package_financials where package_id=$1",[pack])).rows).toEqual([{allocated_bps:5000}]);
 await add(crypto.randomUUID(),5000);expect((await db.query("select sum(cost_cents)::int total from finance_cases where package_id=$1",[pack])).rows).toEqual([{total:10001}]);
 await db.query("insert into finance_entries(id,organization_id,case_id,direction,amount_cents,paid_on) values($1,$2,$3,'out',2000,current_date-1)",[crypto.randomUUID(),org,fee]);
 expect((await db.query("select cost_cents::int,paid_cents::int,payable_cents::int from finance_case_balances where id=$1",[fee])).rows).toEqual([{cost_cents:5001,paid_cents:2000,payable_cents:3001}]);
 await asUser(reader);expect((await db.query("select * from collaborator_fees where id=$1",[fee])).rows).toHaveLength(0);await asUser(owner);
});

it("el reporte por periodo separa cobros sin atribuir y concilia pagos y horas del paquete",async()=>{
 await asUser(owner);const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Productividad',current_date,10000,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const pack=crypto.randomUUID();await db.exec("reset role");
 await db.query("insert into project_service_packages(id,organization_id,project_id,business_line_id,name,scope) select $1,$2,$3,id,'Paquete','[]'::jsonb from business_lines where organization_id=$2 limit 1",[pack,org,project]);await asUser(owner);
 const account=crypto.randomUUID();await db.query("insert into finance_cases(id,organization_id,project_id,package_id,name,area,revenue_cents,cost_cents) values($1,$2,$3,$4,'Extra','architecture',5000,1500)",[account,org,project,pack]);
 await db.query("insert into project_time(id,organization_id,project_id,package_id,worked_on,minutes,description) values($1,$2,$3,$4,current_date-1,120,'Entrega')",[crypto.randomUUID(),org,project,pack]);
 for(const [direction,amount] of [["in",5000],["out",1500]])await db.query("insert into finance_entries(id,organization_id,case_id,direction,amount_cents,paid_on) values($1,$2,$3,$4,$5,current_date-1)",[crypto.randomUUID(),org,account,direction,amount]);
 await db.query("select record_payment($1,id,2000,current_date-1,'Parcial',$3) from payment_schedules where organization_id=$1 and project_id=$2",[org,project,crypto.randomUUID()]);
 const report=(days:number)=>db.query("select line_id is null as unattributed,received,paid,minutes,net_hourly from cash_productivity($1,current_date-$3::integer,current_date,$2,$4)",[org,client,days,project]);
 expect((await report(1)).rows).toEqual([{unattributed:false,received:"5000",paid:"1500",minutes:"120",net_hourly:"1750"},{unattributed:true,received:"2000",paid:"0",minutes:"0",net_hourly:null}]);
 expect((await report(0)).rows).toHaveLength(0);
 await asUser(reader);expect((await report(1)).rows).toHaveLength(0);await asUser(owner);
});

it("aceptar la cotización complementaria añade paquetes y planes solo al proyecto original",async()=>{
 const {id,version,prepared}=await issuedFixture();
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Proyecto con extra',current_date,5000,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const request=crypto.randomUUID();await db.query("insert into scope_changes(id,organization_id,client_id,project_id,description,days_impact) values($1,$2,$3,$4,'Ampliación de alcance',3)",[request,org,client,project]);
 await db.query("update scope_changes set quote_id=$1 where id=$2",[id,request]);
 await db.query("select mark_quote_sent($1,$2,$3,$4)",[org,id,version,prepared.id]);
 const ver=(await db.query<{version:number}>("select version from quotes where id=$1",[id])).rows[0].version;
 const accept=()=>db.query("select accept_quote($1,$2,$3,current_date,current_date) id",[org,id,ver]);
 expect((await accept()).rows).toEqual([{id:project}]);await expect(accept()).rejects.toThrow();
 expect((await db.query("select count(*)::int packages from project_service_packages where project_id=$1 and scope_change_id=$2",[project,request])).rows).toEqual([{packages:2}]);
 expect((await db.query("select amount_cents::int amount from payment_schedules where project_id=$1 and scope_change_id is null",[project])).rows).toEqual([{amount:5000}]);
 expect((await db.query("select sum(amount_cents)=(select total_cents from quotes where id=$2) reconciles from payment_schedules where scope_change_id=$1",[request,id])).rows).toEqual([{reconciles:true}]);
 expect((await db.query("select collected_cents::int collected from project_financial_summary where project_id=$1",[project])).rows).toEqual([{collected:0}]);
 expect((await db.query("select id from projects where quote_version_id=$1",[prepared.id])).rows).toHaveLength(0);
 await asUser(other);expect((await db.query("select * from scope_changes where id=$1",[request])).rows).toHaveLength(0);await asUser(owner);
});

it("las versiones de plantilla conservan su texto al editar el documento de origen",async()=>{
 await asUser(owner);const header={title:"Carta técnica",kind:"letter",body:"Para {{cliente.nombre}}",client_id:client,project_id:null,margins:defaultDocumentOptions.margins};
 const source=(await db.query<{id:string}>("select save_studio_document($1,null,0,$2::jsonb) id",[org,JSON.stringify(header)])).rows[0].id;
 const publish=(rev:number,v:number)=>db.query("insert into document_templates(id,organization_id,source_id,source_version,name,version) values($1,$2,$3,$4,'Carta base',$5)",[crypto.randomUUID(),org,source,rev,v]);
 await publish(1,1);await db.query("select save_studio_document($1,$2,1,$3::jsonb)",[org,source,JSON.stringify({...header,body:"Versión revisada para {{cliente.nombre}}"})]);
 await expect(publish(1,2)).rejects.toThrow();await publish(2,2);await expect(publish(2,2)).rejects.toThrow();
 expect((await db.query("select body from document_templates where source_id=$1 order by version",[source])).rows).toEqual([{body:header.body},{body:"Versión revisada para {{cliente.nombre}}"}]);
 expect((await db.query("select version from latest_document_templates where organization_id=$1 and name='Carta base'",[org])).rows).toEqual([{version:2}]);
 await asUser(other);expect((await db.query("select * from document_templates where source_id=$1",[source])).rows).toHaveLength(0);await asUser(owner);
});

it("el calendario editorial protege la organización, las fechas y las ediciones concurrentes", async () => {
  await asUser(owner);
  const id = crypto.randomUUID();
  const create = (status: string) => db.query("insert into editorial_items(id,organization_id,title,channel,status,portfolio) values($1,$2,'Expediente de entrega','Web',$3,true)", [id,org,status]);
  await expect(create("scheduled")).rejects.toThrow();
  await create("idea");
  const publish = () => db.query("update editorial_items set status='published',publication_on=current_date,url='https://example.org/obra',results='Tres consultas' where id=$1 and version=1 returning version", [id]);
  expect((await publish()).rows).toEqual([{ version: 2 }]);
  expect((await publish()).rows).toHaveLength(0);
  await expect(db.query("update editorial_items set url='javascript:alert(1)' where id=$1",[id])).rejects.toThrow();
  await asUser(other);
  expect((await db.query("select id from editorial_items where id=$1",[id])).rows).toHaveLength(0);
  await asUser(reader);
  expect((await db.query("update editorial_items set title='Modificado' where id=$1 returning id",[id])).rows).toHaveLength(0);
  await asUser(owner);
});

it("cada ejecución conserva su propio avance y solo admite pasos definidos",async()=>{
 await asUser(owner);
 const procedure=crypto.randomUUID(), a=crypto.randomUUID(), b=crypto.randomUUID();
 const create=(steps:string[])=>db.query("insert into studio_procedures(id,organization_id,name,steps) values($1,$2,'Entrega', $3)",[procedure,org,steps]);
 await expect(create([])).rejects.toThrow();await create(["Revisar planos","Entregar expediente"]);
 for(const run of [a,b])await db.query("insert into procedure_runs(id,organization_id,procedure_id,name) values($1,$2,$3,'Entrega final')",[run,org,procedure]);
 const check=(step:number)=>db.query("insert into procedure_checks(organization_id,run_id,step) values($1,$2,$3)",[org,a,step]);
 await check(1);await expect(check(3)).rejects.toThrow();
 expect((await db.query("select step from procedure_checks where run_id=$1",[b])).rows).toHaveLength(0);
 await asUser(reader);await expect(check(2)).rejects.toThrow();
 await asUser(other);expect((await db.query("select id from procedure_runs where procedure_id=$1",[procedure])).rows).toHaveLength(0);
 await asUser(owner);await db.query("delete from procedure_checks where run_id=$1 and step=1",[a]);
 expect((await db.query("select step from procedure_checks where run_id=$1",[a])).rows).toHaveLength(0);
});

it("la biblioteca preserva adjuntos históricos y busca solo la revisión vigente",async()=>{
 await asUser(owner);
 const id=crypto.randomUUID();
 const add=(version:number,title:string)=>db.query("insert into library_revisions(id,resource_id,organization_id,version,title,tags,filename,attachment) values($1,$2,$3,$4,$5,'BIM','plano.ifc',decode('0102ff','hex'))",[version===1?id:crypto.randomUUID(),id,org,version,title]);
 await add(1,"Primera familia");await expect(add(3,"Revisión adelantada")).rejects.toThrow();
 await add(2,"Segunda familia");await expect(add(2,"Edición concurrente")).rejects.toThrow();
 const search=(term:string)=>db.query("select version from current_library_resources where resource_id=$1 and search_text ilike $2",[id,"%"+term+"%"]);
 expect((await search("Primera")).rows).toHaveLength(0);expect((await search("bim")).rows).toEqual([{version:2}]);
 await asUser(reader);expect((await db.query("select encode(attachment,'hex') bytes from library_revisions where id=$1",[id])).rows).toEqual([{bytes:"0102ff"}]);await expect(add(3,"Sin permiso")).rejects.toThrow();
 await asUser(other);expect((await search("BIM")).rows).toHaveLength(0);expect((await db.query("select attachment from library_revisions where id=$1",[id])).rows).toHaveLength(0);await asUser(owner);
});

it("las fases aplicadas conservan su versión aunque administración revise la plantilla",async()=>{
 await asUser(owner);
 const templates=(await db.query<{id:string;name:string;phases:string[]}>("select id,name,phases from phase_templates where organization_id=$1 order by name",[org])).rows;
 const architectural=templates.find(t=>t.name==="Arquitectura")!;
 expect(architectural.phases).not.toEqual(templates.find(t=>t.name==="Visualización")!.phases);
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Prueba de fases',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const id=crypto.randomUUID();
 await db.query("insert into project_phase_plans(id,organization_id,project_id,template_id,template_version) values($1,$2,$3,$4,1)",[id,org,project,architectural.id]);
 await db.query("update phase_templates set phases=array['Diagnóstico','Entrega'] where id=$1",[architectural.id]);
 expect((await db.query("select phases,template_version from project_phase_plans where id=$1",[id])).rows).toEqual([{phases:architectural.phases,template_version:1}]);
 expect((await db.query("update project_phase_plans set completed=1 where id=$1 and completed=0 returning completed",[id])).rows).toEqual([{completed:1}]);
 await expect(db.query("update project_phase_plans set completed=1000 where id=$1",[id])).rejects.toThrow();
 await asUser(other);expect((await db.query("select id from project_phase_plans where id=$1",[id])).rows).toHaveLength(0);await asUser(owner);
});

it("la agenda reprograma el seguimiento comercial y retira publicaciones y oportunidades cerradas",async()=>{
 await asUser(owner);
 const opp=(await db.query<{id:string}>("insert into opportunities(organization_id,client_id,business_line_id,name,next_follow_up) select $1,$2,id,'Visita comercial',current_date from business_lines where organization_id=$1 limit 1 returning id",[org,client])).rows[0].id;
 const pub=crypto.randomUUID();
 await db.query("insert into editorial_items(id,organization_id,title,channel,status,publication_on) values($1,$2,'Publicación de proyecto','Web','scheduled',current_date)",[pub,org]);
 const items=()=>db.query("select kind from agenda_events where organization_id=$1 and id in ($2,$3) and due_on=current_date order by kind",[org,opp,pub]);
 expect((await items()).rows).toEqual([{kind:"follow_up"},{kind:"publication"}]);
 await asUser(reader);expect((await items()).rows).toHaveLength(0);await asUser(owner);
 await db.query("update opportunities set next_follow_up=current_date+1 where id=$1",[opp]);
 await db.query("update editorial_items set status='published' where id=$1",[pub]);expect((await items()).rows).toHaveLength(0);
 expect((await db.query("select id from agenda_events where id=$1 and due_on=current_date+1",[opp])).rows).toHaveLength(1);
 await db.query("update opportunities set stage='won' where id=$1",[opp]);expect((await db.query("select id from agenda_events where id=$1",[opp])).rows).toHaveLength(0);
});

it("leer un aviso es personal y una reprogramación genera un aviso sin leer",async()=>{
 await asUser(owner);
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Avisos internos',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const id=(await db.query<{id:string}>("insert into project_notes(organization_id,project_id,kind,body,due_on) values($1,$2,'task','Revisar expediente',current_date-2) returning id",[org,project])).rows[0].id;
 const inbox=()=>db.query("select read_at is not null as seen from agenda_notifications where id=$1",[id]);
 const mark=()=>db.query("insert into agenda_notification_reads(organization_id,kind,event_id,due_on) select organization_id,kind,id,due_on from agenda_events where id=$1",[id]);
 await mark();expect((await inbox()).rows).toEqual([{seen:true}]);
 await asUser(reader);expect((await inbox()).rows).toEqual([{seen:false}]);await mark();
 await db.query("delete from agenda_notification_reads where event_id=$1",[id]);expect((await inbox()).rows).toEqual([{seen:false}]);
 await asUser(other);expect((await inbox()).rows).toHaveLength(0);
 await asUser(owner);expect((await inbox()).rows).toEqual([{seen:true}]);
 await db.query("update project_notes set due_on=current_date-1 where id=$1",[id]);expect((await inbox()).rows).toEqual([{seen:false}]);
 await db.query("update project_notes set due_on=current_date+2 where id=$1",[id]);expect((await inbox()).rows).toHaveLength(0);await expect(mark()).rejects.toThrow();
});

it("los favoritos siguen los permisos y nombres actuales del registro",async()=>{
 await asUser(owner);
 const id=(await db.query<{id:string}>("insert into clients(organization_id,name) values($1,'Cliente favorito') returning id",[org])).rows[0].id;
 const mark=()=>db.query("insert into studio_favorites(organization_id,source,record_id) values($1,'clients',$2)",[org,id]);
 const result=()=>db.query("select label,favorite from personal_search_results where organization_id=$1 and source='clients' and id=$2",[org,id]);
 await mark();await db.query("update clients set name='Cliente actualizado' where id=$1",[id]);
 expect((await result()).rows).toEqual([{label:"Cliente actualizado",favorite:true}]);
 await asUser(reader);expect((await result()).rows).toEqual([{label:"Cliente actualizado",favorite:false}]);await mark();
 await db.query("delete from studio_favorites where record_id=$1",[id]);
 await asUser(other);expect((await result()).rows).toHaveLength(0);await expect(mark()).rejects.toThrow();
 await asUser(owner);expect((await result()).rows[0]).toMatchObject({favorite:true});
 await db.query("update clients set deleted_at=now() where id=$1",[id]);expect((await result()).rows).toHaveLength(0);
});

it("la actividad conserva registro y reverso con permisos financieros",async()=>{
 await asUser(owner);
 const account=crypto.randomUUID(),entry=crypto.randomUUID();
 await db.query("insert into finance_cases(id,organization_id,name,area,revenue_cents,cost_cents) values($1,$2,'Estudio externo','service',5000,0)",[account,org]);
 await db.query("insert into finance_entries(id,organization_id,case_id,direction,amount_cents,paid_on) values($1,$2,$3,'in',2000,current_date-1)",[entry,org,account]);
 await db.query("update finance_entries set reversal_reason='Corrección de importe' where id=$1",[entry]);
 const history=()=>db.query("select action,target_id from studio_activity where organization_id=$1 and id=$2 order by occurred_at,action",[org,entry]);
 expect((await history()).rows).toEqual([{action:"received",target_id:account},{action:"reversed",target_id:account}]);
 await asUser(reader);expect((await history()).rows).toHaveLength(0);
 await asUser(other);expect((await history()).rows).toHaveLength(0);await asUser(owner);
});

it("el cierre exige subtareas completas y la siguiente recurrencia comienza con pasos abiertos",async()=>{
 await asUser(owner);
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Desglose de tareas',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const task=(await db.query<{id:string}>("insert into project_notes(organization_id,project_id,kind,body,due_on,repeat_days) values($1,$2,'task','Revisión semanal',current_date,7) returning id",[org,project])).rows[0].id;
 const step=crypto.randomUUID();await db.query("insert into task_subtasks(id,organization_id,task_id,label) values($1,$2,$3,'Revisar cotas')",[step,org,task]);
 const close=()=>db.query("update project_notes set completed_at=now() where id=$1",[task]);
 await expect(close()).rejects.toThrow(/subtareas/);
 await db.query("update task_subtasks set done=true where id=$1",[step]);await close();
 expect((await db.query("select s.label,s.done from task_subtasks s join project_notes n on n.id=s.task_id where n.previous_occurrence=$1",[task])).rows).toEqual([{label:"Revisar cotas",done:false}]);
 await expect(db.query("update task_subtasks set done=false where id=$1",[step])).rejects.toThrow(/Reabre/);
 await asUser(other);expect((await db.query("select id from task_subtasks where id=$1",[step])).rows).toHaveLength(0);await asUser(owner);
});

it("una dependencia no puede cerrar en desorden, formar ciclos ni cruzar proyectos",async()=>{
 await asUser(owner);
 const project=async()=> (await db.query<{id:string}>("select create_project_record($1,$2,'Tareas enlazadas',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const task=async(p:string)=>(await db.query<{id:string}>("insert into project_notes(organization_id,project_id,kind,body) values($1,$2,'task','Revisión') returning id",[org,p])).rows[0].id;
 const p=await project(),a=await task(p),b=await task(p),c=await task(p),otherTask=await task(await project());
 const link=(id:string,prev:string)=>db.query("update project_notes set predecessor_id=$2 where id=$1",[id,prev]);
 const close=(id:string)=>db.query("update project_notes set completed_at=now() where id=$1",[id]);
 await link(b,a);await link(c,b);
 await expect(link(a,c)).rejects.toThrow(/ciclo/);await expect(link(a,otherTask)).rejects.toThrow(/mismo proyecto/);
 await expect(close(b)).rejects.toThrow(/tarea previa/);await close(a);await close(b);
 await expect(db.query("update project_notes set completed_at=null where id=$1",[a])).rejects.toThrow(/dependientes/);
 await db.query("update project_notes set completed_at=null where id=$1",[b]);await db.query("update project_notes set predecessor_id=null where id=$1",[b]);
 await db.query("update project_notes set completed_at=null where id=$1",[a]);
});

it("el tablero refleja el cierre compartido y rechaza movimientos con una versión anterior",async()=>{
 await asUser(owner);
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Tablero',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const id=(await db.query<{id:string}>("insert into project_notes(organization_id,project_id,kind,body) values($1,$2,'task','Revisar plantas') returning id",[org,project])).rows[0].id;
 const board=()=>db.query("select lane,version from project_task_board where id=$1",[id]);
 expect((await board()).rows).toEqual([{lane:"pending",version:1}]);
 await db.query("update project_notes set in_progress=true where id=$1 and version=1",[id]);
 expect((await board()).rows).toEqual([{lane:"working",version:2}]);
 expect((await db.query("update project_notes set completed_at=now() where id=$1 and version=1 returning id",[id])).rows).toHaveLength(0);
 await db.query("update project_notes set completed_at=now() where id=$1 and version=2",[id]);
 expect((await board()).rows).toEqual([{lane:"done",version:3}]);
 await asUser(reader);expect((await board()).rows).toHaveLength(1);expect((await db.query("update project_notes set completed_at=null where id=$1 returning id",[id])).rows).toHaveLength(0);
 await asUser(other);expect((await board()).rows).toHaveLength(0);await asUser(owner);
});

it("el presupuesto del proyecto cuenta cada cotización aceptada una sola vez aunque tenga dos paquetes",async()=>{
 const issue=async(project?:string)=>{
 const {id,version,prepared}=await issuedFixture();
 if(project){const change=crypto.randomUUID();await db.query("insert into scope_changes(id,organization_id,client_id,project_id,description,days_impact) values($1,$2,$3,$4,'Alcance adicional',1)",[change,org,client,project]);
 await db.query("update scope_changes set quote_id=$1 where id=$2",[id,change]);}
 await db.query("select mark_quote_sent($1,$2,$3,$4)",[org,id,version,prepared.id]);
 return (await db.query<{id:string}>("select accept_quote($1,id,version,current_date,current_date) id from quotes where id=$2",[org,id])).rows[0].id;
 };
 const project=await issue();expect(await issue(project)).toBe(project);
 const report=()=>db.query("select quote_count::int,net_cents,external_cost_cents,expected_profit_cents,margin_percent,estimated_hours,estimated_hourly_cents from project_quote_estimates where project_id=$1",[project]);
 expect((await report()).rows).toEqual([{quote_count:2,net_cents:"5000000",external_cost_cents:"5000",expected_profit_cents:"4995000",margin_percent:"99.90",estimated_hours:"24.0000",estimated_hourly_cents:"208333"}]);
 await asUser(reader);expect((await report()).rows).toHaveLength(0);await asUser(owner);
});

it("el reporte atribuye acuerdos de una obra al proyecto y cliente sin mezclar sus fondos",async()=>{
 await asUser(owner);
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Proyecto con ejecución',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const work=crypto.randomUUID();await db.query("insert into works(id,organization_id,name,project_id) values($1,$2,'Obra vinculada',$3)",[work,org,project]);
 for(const [managed,amount] of [[false,1250],[true,3000]] as const){
 const account=crypto.randomUUID();
 await db.query("insert into finance_cases(id,organization_id,work_id,name,area,managed,revenue_cents,cost_cents) values($1,$2,$3,'Acuerdo por obra','construction',$4,$5,0)",[account,org,work,managed,amount]);
 await db.query("insert into finance_entries(id,organization_id,case_id,direction,amount_cents,paid_on) values($1,$2,$3,'in',$4,current_date)",[crypto.randomUUID(),org,account,amount]);
 }
 const report=(customer:string|null,proj:string|null)=>db.query("select managed,received from cash_productivity($1,current_date,current_date,$2,$3,$4) order by managed",[org,customer,proj,work]);
 const expected=[{managed:false,received:"1250"},{managed:true,received:"3000"}];
 expect((await report(null,null)).rows).toEqual(expected);expect((await report(client,project)).rows).toEqual(expected);
 expect((await report(client,crypto.randomUUID())).rows).toHaveLength(0);
 await asUser(reader);expect((await report(client,project)).rows).toHaveLength(0);await asUser(owner);
});

it("las asociaciones opcionales respetan el cliente y el proyecto realmente vinculados a la obra",async()=>{
 await asUser(owner);
 const customer=(await db.query<{id:string}>("insert into clients(organization_id,name) values($1,'Segundo cliente de obra') returning id",[org])).rows[0].id;
 const project=async(c:string)=>(await db.query<{id:string}>("select create_project_record($1,$2,'Encargo asociado',current_date,0,$3) id",[org,c,crypto.randomUUID()])).rows[0].id;
 const first=await project(client),sameClient=await project(client),second=await project(customer);
 const work=async(c:string|null,p:string|null)=>(await db.query<{id:string}>("insert into works(id,organization_id,name,client_id,project_id) values($1,$2,'Obra asociada',$3,$4) returning id",[crypto.randomUUID(),org,c,p])).rows[0].id;
 const agreement=(c:string|null,p:string|null,w:string|null)=>db.query("insert into finance_cases(id,organization_id,name,area,client_id,project_id,work_id,revenue_cents,cost_cents) values($1,$2,'Acuerdo de control','construction',$3,$4,$5,1000,0)",[crypto.randomUUID(),org,c,p,w]);
 await expect(work(customer,first)).rejects.toThrow(/work_project_client/);
 const byProject=await work(null,first),byClient=await work(customer,null);
 await expect(agreement(customer,first,null)).rejects.toThrow(/agreement_project_client/);
 await expect(agreement(null,sameClient,byProject)).rejects.toThrow(/obra/);
 await expect(agreement(customer,null,byProject)).rejects.toThrow(/obra/);
 await expect(agreement(null,first,byClient)).rejects.toThrow(/obra/);
 await agreement(null,second,byClient);await agreement(null,null,byProject);await agreement(null,null,null);
});

it("los vencimientos del acuerdo siguen el saldo parcial, la liquidación y el reverso", async () => {
  await asUser(owner);
  const account = crypto.randomUUID();
  await db.query("insert into finance_cases(id,organization_id,name,area,revenue_cents,cost_cents,collect_on,pay_on) values($1,$2,'Estudio de suelos','service',100,60,current_date-1,current_date-1)", [account,org]);
  const notices = async () => (await db.query<{kind:string}>("select kind from agenda_notifications where id=$1 order by kind",[account])).rows.map(r=>r.kind);
  const movement = async (amount:number) => {
    const id=crypto.randomUUID();
    await db.query("insert into finance_entries(id,organization_id,case_id,direction,amount_cents,paid_on) values($1,$2,$3,'in',$4,current_date-1)",[id,org,account,amount]);
    return id;
  };
  await movement(40);
  expect(await notices()).toEqual(["agreement_collection","agreement_payment"]);
  const finalPayment=await movement(60);
  expect(await notices()).toEqual(["agreement_payment"]);
  await db.query("update finance_entries set reversal_reason='Captura duplicada' where id=$1",[finalPayment]);
  expect(await notices()).toEqual(["agreement_collection","agreement_payment"]);
  await db.query("update finance_cases set pay_on=null where id=$1",[account]);
  expect(await notices()).toEqual(["agreement_collection"]);
  await asUser(reader);expect(await notices()).toEqual([]);
  await asUser(other);expect(await notices()).toEqual([]);
  await asUser(owner);
});

it("reprograma un recordatorio privado y genera una sola recurrencia al cerrarlo", async () => {
  await asUser(owner);
  const id=crypto.randomUUID();
  await db.query("insert into personal_reminders(id,organization_id,label,due_on,repeat_days) values($1,$2,'Renovar licencia','2026-03-01',7)",[id,org]);
  const events=()=>db.query("select due_on::text from agenda_events where organization_id=$1 and kind='personal' and label='Renovar licencia'",[org]);
  expect((await events()).rows).toEqual([{due_on:"2026-03-01"}]);
  await db.query("update personal_reminders set due_on='2026-03-02' where id=$1 and version=1",[id]);
  const close=()=>db.query("update personal_reminders set completed=true where id=$1 and version=2 returning id",[id]);
  expect((await close()).rows).toHaveLength(1);expect((await close()).rows).toHaveLength(0);
  expect((await events()).rows).toEqual([{due_on:"2026-03-09"}]);
  await asUser(reader);expect((await events()).rows).toHaveLength(0);
  await expect(db.query("insert into personal_reminders(organization_id,label,due_on) values($1,'Privado',current_date)",[org])).rejects.toThrow();
  await asUser(other);expect((await events()).rows).toHaveLength(0);
  await asUser(owner);
});

it("el expediente atribuye los acuerdos sin duplicar al cliente de la obra o del proyecto", async () => {
 await asUser(owner);
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Casa del cliente',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const work=crypto.randomUUID();
 await db.query("insert into works(id,organization_id,project_id,name) values($1,$2,$3,'Obra del cliente')",[work,org,project]);
 const account=crypto.randomUUID();
 await db.query("insert into finance_cases(id,organization_id,work_id,name,area,managed,revenue_cents,cost_cents) values($1,$2,$3,'Acopio de material','construction',true,900,750)",[account,org,work]);
 const visible=()=>db.query("select client_id,managed,receivable,payable from client_agreements where id=$1",[account]);
 expect((await visible()).rows).toEqual([{client_id:client,managed:true,receivable:"900",payable:"750"}]);
 await asUser(reader);expect((await visible()).rows).toHaveLength(0);
 await asUser(other);expect((await visible()).rows).toHaveLength(0);await asUser(owner);
});

it("archiva y recupera el documento con control de versión, permisos y auditoría",async()=>{
 await asUser(owner);
 const header={title:"Acta de archivo",kind:"letter",body:"Texto del documento",margins:defaultDocumentOptions.margins};
 const {id}=(await db.query<{id:string}>("select save_studio_document($1,null,0,$2::jsonb) id",[org,JSON.stringify(header)])).rows[0];
 const issued=(await db.query<{data:{id:string;storage_path:string;snapshot:unknown}}>("select prepare_studio_document($1,$2,1) data",[org,id])).rows[0].data;
 await db.query("insert into storage.objects(bucket_id,name) values('estudio-documents',$1)",[issued.storage_path]);
 await db.query("select finalize_studio_document($1,$2,$3)",[org,issued.id,"d".repeat(64)]);
 const change=(v:number,archive:boolean)=>db.query("select set_studio_document_archived($1,$2,$3,$4)",[org,id,v,archive]);
 await asUser(reader);await expect(change(1,true)).rejects.toThrow();
 await asUser(other);await expect(change(1,true)).rejects.toThrow();
 await asUser(owner);await change(1,true);
 await expect(change(1,false)).rejects.toThrow();
 await expect(db.query("select prepare_studio_document($1,$2,2)",[org,id])).rejects.toThrow();
 expect((await db.query("select snapshot,storage_path,state from generated_documents where id=$1",[issued.id])).rows).toEqual([{snapshot:issued.snapshot,storage_path:issued.storage_path,state:"issued"}]);
 await change(2,false);
 expect((await db.query("select title,body,version,deleted_at from studio_documents where id=$1",[id])).rows).toEqual([{title:header.title,body:header.body,version:3,deleted_at:null}]);
 expect((await db.query("select action from audit_events where entity_id=$1 order by action",[id])).rows).toEqual([{action:"archived"},{action:"created"},{action:"restored"}]);
});

it("divide un saldo parcialmente cobrado, conserva la cartera y protege el cambio de reintentos", async () => {
 await asUser(owner);
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Reprogramación',current_date-1,1000,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const schedule=(await db.query<{id:string}>("select id from payment_schedules where project_id=$1",[project])).rows[0].id;
 await db.query("select record_payment($1,$2,300,current_date-1,'Abono',$3)",[org,schedule,crypto.randomUUID()]);
 const key=crypto.randomUUID();
 const move=(request:string,amount:number)=>db.query<{id:string}>("select replan_schedule($1,$2,$3,current_date-1,1000,700,$4,current_date+10) id",[org,schedule,request,amount]);
 await asUser(reader);await expect(move(key,300)).rejects.toThrow();
 await asUser(other);await expect(move(key,300)).rejects.toThrow();await asUser(owner);
 await expect(move(key,701)).rejects.toThrow();
 const split=(await move(key,500)).rows[0].id;
 expect((await move(key,500)).rows[0].id).toBe(split);
 await expect(move(key,400)).rejects.toThrow();
 await expect(move(crypto.randomUUID(),300)).rejects.toThrow();
 expect((await db.query("select amount_cents::int amount,collected_cents::int collected,balance_cents::int balance from payment_schedule_balances where project_id=$1 order by due_date",[project])).rows).toEqual([{amount:500,collected:300,balance:200},{amount:500,collected:0,balance:500}]);
 expect((await db.query("select replan_schedule($1,$2,$3,current_date+10,500,500,500,current_date+12) id",[org,split,crypto.randomUUID()])).rows).toEqual([{id:split}]);
 expect((await db.query("select due_on=current_date+12 updated from agenda_events where id=$1 and kind='collection'",[split])).rows).toEqual([{updated:true}]);
 const history=()=>db.query("select project_id,project_name,amount_cents from schedule_change_history where schedule_id=$1",[schedule]);
 expect((await history()).rows).toEqual([{project_id:project,project_name:"Reprogramación",amount_cents:"500"}]);
 await asUser(reader);expect((await history()).rows).toHaveLength(0);await asUser(owner);
});

it("el recibo separa el origen, resuelve la obra y refleja el reverso sin exponer fondos a lectores",async()=>{
 await asUser(owner);
 const proj=(await db.query<{id:string}>("select create_project_record($1,$2,'Proyecto de recibo',current_date-1,1000,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const payment=(await db.query<{id:string}>("select record_payment($1,id,725,current_date-1,'Transferencia',$3) id from payment_schedules where project_id=$2",[org,proj,crypto.randomUUID()])).rows[0].id;
 const work=crypto.randomUUID(),account=crypto.randomUUID();
 await db.query("insert into works(id,organization_id,project_id,name) values($1,$2,$3,'Obra de recibo')",[work,org,proj]);
 await db.query("insert into finance_cases(id,organization_id,work_id,name,area,managed,revenue_cents,cost_cents) values($1,$2,$3,'Material','construction',true,0,600)",[account,org,work]);
 await db.query("insert into finance_entries(id,organization_id,case_id,direction,paid_on,amount_cents) values($1,$2,$3,'out',current_date-1,350)",[payment,org,account]);
 await db.query("update finance_entries set reversal_reason='Concepto equivocado' where id=$1",[payment]);
 const rows=()=>db.query("select source,amount,direction,managed,reversed,project_name from movement_receipts where id=$1 order by source",[payment]);
 expect((await rows()).rows).toEqual([{source:"acuerdo",amount:"350",direction:"out",managed:true,reversed:true,project_name:"Proyecto de recibo"},{source:"proyecto",amount:"725",direction:"in",managed:false,reversed:false,project_name:"Proyecto de recibo"}]);
 await asUser(reader);expect((await rows()).rows).toHaveLength(0);await asUser(other);expect((await rows()).rows).toHaveLength(0);await asUser(owner);
});

it("concilia costo, pagos y reversos por proveedor separando fondos administrados y propios",async()=>{
 await asUser(owner);
 const supplier=crypto.randomUUID();await db.query("insert into suppliers(id,organization_id,name,kind) values($1,$2,'Topografía del sur','subcontractor')",[supplier,org]);
 for(const managed of [true,false]){
 const agreement=crypto.randomUUID(),entry=crypto.randomUUID();
 await db.query("insert into finance_cases(id,organization_id,name,area,managed,revenue_cents,cost_cents,supplier_id) values($1,$2,'Topografía','construction',$3,0,840,$4)",[agreement,org,managed,supplier]);
 await db.query("insert into finance_entries(id,organization_id,case_id,paid_on,direction,amount_cents) values($1,$2,$3,current_date-1,'out',40)",[entry,org,agreement]);
 if(managed)await db.query("update finance_entries set reversal_reason='Pago duplicado' where id=$1",[entry]);
 }
 const find=()=>db.query("select label,favorite from personal_search_results where source='suppliers' and id=$1",[supplier]);
 await db.query("insert into studio_favorites(organization_id,source,record_id) values($1,'suppliers',$2)",[org,supplier]);
 expect((await find()).rows).toEqual([{label:"Topografía del sur",favorite:true}]);
 const report=()=>db.query("select managed,cost,paid,payable from supplier_totals where supplier_id=$1 order by managed",[supplier]);
 expect((await report()).rows).toEqual([{managed:false,cost:"840",paid:"40",payable:"800"},{managed:true,cost:"840",paid:"0",payable:"840"}]);
 await asUser(reader);expect((await report()).rows).toHaveLength(0);await asUser(other);expect((await report()).rows).toHaveLength(0);await asUser(owner);
});

it("desglosa pagos efectivos por área, categoría y fondos y concilia con el flujo",async()=>{
 await asUser(owner);
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Clasificación de egresos',current_date-1,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const work=crypto.randomUUID();
 await db.query("insert into works(id,organization_id,project_id,name) values($1,$2,$3,'Obra de egresos')",[work,org,project]);
 for(const managed of [true,false]){
 const account=crypto.randomUUID();await db.query("insert into finance_cases(id,organization_id,work_id,name,area,managed,revenue_cents,cost_cents) values($1,$2,$3,'Suministros','construction',$4,900,900)",[account,org,work,managed]);
 const entry=(direction:string,category:string|null)=>db.query<{id:string}>("insert into finance_entries(id,organization_id,case_id,direction,amount_cents,expense_category,paid_on) values($1,$2,$3,$4,90,$5,current_date-1) returning id",[crypto.randomUUID(),org,account,direction,category]);
 await entry("out","material");await entry("out",null);await entry("in",null);
 await expect(entry("in","material")).rejects.toThrow();
 const reversed=(await entry("out","external")).rows[0].id;await db.query("update finance_entries set reversal_reason='Duplicado en pago' where id=$1",[reversed]);
 }
 const report=()=>db.query<{managed:boolean;category:string|null;paid:string}>("select managed,category,paid from expense_breakdown($1,current_date-1,current_date-1,$2,$3,$4) order by managed,category",[org,client,project,work]);
 const rows=(await report()).rows;
 expect(rows).toEqual([false,true].flatMap(managed=>[{managed,category:"material",paid:"90"},{managed,category:null,paid:"90"}]));
 expect((await db.query("select managed,paid from cash_productivity($1,current_date-1,current_date-1,$2,$3,$4) order by managed",[org,client,project,work])).rows).toEqual([{managed:false,paid:"180"},{managed:true,paid:"180"}]);
 await asUser(reader);expect((await report()).rows).toHaveLength(0);await asUser(other);expect((await report()).rows).toHaveLength(0);await asUser(owner);
});

it("valora minutos por tarifa vigente, distingue cero de falta de tarifa y protege los costos internos",async()=>{
 await asUser(owner);
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Horas imputadas','2026-01-01',0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const time=(day:string,minutes:number)=>db.query("insert into project_time(id,organization_id,project_id,worked_on,minutes,description) values($1,$2,$3,$4,$5,'Diseño interior')",[crypto.randomUUID(),org,project,day,minutes]);
 const rate=(day:string,cents:number)=>db.query("insert into member_cost_rates(id,organization_id,member_id,effective_on,hourly_cents) values($1,$2,$3,$4,$5)",[crypto.randomUUID(),org,owner,day,cents]);
 await time("2026-01-01",10);await rate("2026-01-02",0);await time("2026-01-02",60);
 await rate("2026-01-03",101);await time("2026-01-03",15);await time("2026-01-03",15);
 await rate("2026-01-04",240);await time("2026-01-04",60);
 const report=(start:string|null)=>db.query("select * from time_cost_report($1,$2,null,$3,$4)",[org,start,client,project]);
 expect((await report(null)).rows).toEqual([{rated_minutes:"150",unrated_minutes:"10",estimated_cost:"291"}]);
 expect((await report("2026-01-04")).rows).toEqual([{rated_minutes:"60",unrated_minutes:"0",estimated_cost:"240"}]);
 await expect(rate("2026-01-04",1000)).rejects.toThrow();
 await asUser(other);expect((await report(null)).rows).toHaveLength(0);await asUser(reader);expect((await report(null)).rows).toHaveLength(0);await expect(rate("2026-01-05",99)).rejects.toThrow();await asUser(owner);
});

it("solo el propietario cambia roles no propietarios y el cambio se aplica a los permisos financieros",async()=>{
 await asUser(owner);
 const change=(member:string,expected:string,desired:string)=>db.query("select change_studio_member_role($1,$2,$3,$4)",[org,member,expected,desired]);
 const history=()=>db.query("select old_role,new_role,actor_id from member_role_changes where organization_id=$1 and member_id=$2 order by changed_at",[org,reader]);
 const financial=()=>db.query("select id from finance_cases where organization_id=$1 limit 1",[org]);
 await asUser(reader);expect((await financial()).rows).toHaveLength(0);await expect(change(reader,"reader","admin")).rejects.toThrow();
 await asUser(other);await expect(change(reader,"reader","admin")).rejects.toThrow();
 await asUser(owner);await expect(change(owner,"owner","reader")).rejects.toThrow();await expect(change(reader,"reader","owner")).rejects.toThrow();
 await change(reader,"reader","admin");await expect(change(reader,"reader","collaborator")).rejects.toThrow();
 await asUser(reader);expect((await financial()).rows).toHaveLength(1);expect((await history()).rows).toHaveLength(0);
 await expect(change(reader,"admin","reader")).rejects.toThrow();
 await asUser(owner);await change(reader,"admin","reader");
 expect((await history()).rows).toEqual([{old_role:"reader",new_role:"admin",actor_id:owner},{old_role:"admin",new_role:"reader",actor_id:owner}]);
 await asUser(reader);expect((await financial()).rows).toHaveLength(0);await asUser(owner);
});

it("solo una cuenta con el correo confirmado acepta la invitación y no puede elevar ni duplicar su membresía",async()=>{
 const guest=crypto.randomUUID(),orgId=org,email=guest+"@example.test";
 await db.exec("reset role");await db.query("insert into auth.users(id,email) values($1,$2)",[guest,email]);await asUser(owner);
 const issue=async()=>{const id=crypto.randomUUID();await db.query("insert into studio_invitations(id,organization_id,email,role) values($1,$2,$3,'collaborator')",[id,orgId,email]);return id;};
 const accept=(id:string)=>db.query("select accept_studio_invitation($1) org",[id]);
 const inbox=()=>db.query("select id from my_studio_invitations()");
 const revoked=await issue();await db.query("select revoke_studio_invitation($1,$2)",[org,revoked]);const id=await issue();
 await asUser(guest);expect((await inbox()).rows).toEqual([]);await expect(accept(id)).rejects.toThrow();
 await db.exec("reset role");await db.query("update auth.users set email_confirmed_at=now() where id=$1",[guest]);await asUser(other);
 await expect(accept(id)).rejects.toThrow();await asUser(guest);expect((await inbox()).rows).toEqual([{id}]);await expect(accept(revoked)).rejects.toThrow();
 expect((await accept(id)).rows).toEqual([{org}]);expect((await accept(id)).rows).toEqual([{org}]);
 expect((await db.query("select role from memberships where user_id=$1",[guest])).rows).toEqual([{role:"collaborator"}]);
 await expect(issue()).rejects.toThrow();expect((await inbox()).rows).toEqual([]);
 await asUser(owner);const expired=await issue();await db.exec("reset role");
 await db.query("update studio_invitations set expires_at=now()-interval '1 minute' where id=$1",[expired]);
 await asUser(guest);await expect(accept(expired)).rejects.toThrow(/no disponible/);expect((await inbox()).rows).toEqual([]);
 await asUser(owner);await db.query("select revoke_studio_invitation($1,$2)",[org,expired]);const second=await issue();await asUser(guest);await expect(accept(second)).rejects.toThrow(/perteneces/);await asUser(owner);
});

it("edita la ficha y sincroniza el cierre con agenda sin modificar acuerdos de cobro",async()=>{
 await asUser(owner);const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Casa original','2026-02-01',10000,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const edit=(v:number,start:string,end:string|null,lead:string|null,state:string)=>db.query("select edit_project_details($1,$2,$3,'Casa del valle','Valle norte',$4,$5,$6,$7)",[org,project,v,start,end,lead,state]);
 await expect(edit(1,"2026-03-01","2026-02-28",owner,"active")).rejects.toThrow();
 await expect(edit(1,"2026-02-01",null,crypto.randomUUID(),"active")).rejects.toThrow();
 await edit(1,"2026-02-02","2026-05-01",owner,"active");
 const notice=()=>db.query("select label,due_on::text from agenda_events where kind='project_end' and id=$1",[project]);
 expect((await notice()).rows).toEqual([{label:"Casa del valle",due_on:"2026-05-01"}]);
 await expect(edit(1,"2026-02-01",null,null,"closed")).rejects.toThrow();
 await asUser(reader);expect((await notice()).rows).toHaveLength(1);await expect(edit(2,"2026-02-02",null,null,"closed")).rejects.toThrow();
 await asUser(owner);await edit(2,"2026-02-02","2026-05-01",owner,"closed");expect((await notice()).rows).toHaveLength(0);
 expect((await db.query("select amount_cents::int,due_date::text from payment_schedules where project_id=$1",[project])).rows).toEqual([{amount_cents:10000,due_date:"2026-02-01"}]);
});
it("protege adjuntos comerciales y restaura los bytes originales con control de versión", async () => {
  await asUser(owner);
  const project = (await db.query<{id:string}>("select create_project_record($1,$2,'Proyecto con archivos','2026-03-01',100,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
  const commercial = crypto.randomUUID(), technical = crypto.randomUUID();
  await db.query("insert into dossier_files(id,organization_id,client_id,title,url) values($1,$2,$3,'Referencia','https://example.test/')",[commercial,org,client]);
  const insert = (id:string, tenant:string) => db.query("insert into dossier_files(id,organization_id,project_id,title,filename,attachment) values($1,$2,$3,'Plano','plano.pdf',decode('25504446','hex'))",[id,tenant,project]);
  await asUser(other); await expect(insert(crypto.randomUUID(),otherOrg)).rejects.toThrow();
  await asUser(reader); await expect(insert(technical,org)).rejects.toThrow();
  await asUser(owner); await db.query("select change_studio_member_role($1,$2,'reader','collaborator')",[org,reader]);
  await asUser(reader); await insert(technical,org);
  expect((await db.query("select id from dossier_files order by id")).rows).toEqual([{id:technical}]);
  await asUser(owner); await db.query("select change_studio_member_role($1,$2,'collaborator','reader')",[org,reader]);
  await db.query("update dossier_files set deleted_at=now() where id=$1 and version=1",[technical]);
  expect((await db.query("update dossier_files set deleted_at=null where id=$1 and version=1 returning id",[technical])).rows).toEqual([]);
  await db.query("update dossier_files set deleted_at=null where id=$1 and version=2",[technical]);
  await asUser(reader);
  expect((await db.query("select encode(attachment,'hex') bytes from dossier_files where deleted_at is null")).rows).toEqual([{bytes:"25504446"}]);
  await asUser(owner);
});
it("un cliente anterior puede editar el preset sin perder sus condiciones", async () => {
  await asUser(owner);
  const {service} = await commercialFixture();
  const items=JSON.stringify([{service_id:service,quantity:"1"}]);
  const id=(await db.query<{id:string}>("select save_preset_terms($1,null,0,'Vivienda','',$2::jsonb,'50% al inicio') id",[org,items])).rows[0].id;
  await db.query("select save_preset($1,$2,1,'Vivienda ampliada','',$3::jsonb)",[org,id,items]);
  await expect(db.query("select save_preset_terms($1,$2,1,'Obsoleta','',$3::jsonb,'Otro')",[org,id,items])).rejects.toThrow("Conflicto");
  expect((await db.query("select conditions,version from service_presets where id=$1",[id])).rows).toEqual([{conditions:"50% al inicio",version:2}]);
  await db.query("select save_preset_terms($1,$2,2,'Vivienda','',$3::jsonb,'')",[org,id,items]);
  expect((await db.query("select conditions from service_presets where id=$1",[id])).rows).toEqual([{conditions:""}]);
});
it("restaura una propuesta emitida conservando su versión documental y audita la recuperación", async () => {
  await asUser(owner);
  const {id,version,prepared}=await issuedFixture();
  await db.query("select archive_quote($1,$2,$3)",[org,id,version]);
  const restore=(v:number)=>db.query("select restore_quote($1,$2,$3)",[org,id,v]);
  await asUser(reader); await expect(restore(version+1)).rejects.toThrow("Permisos");
  await asUser(other); await expect(restore(version+1)).rejects.toThrow("Permisos");
  await asUser(owner); await expect(restore(version)).rejects.toThrow("cambió");
  await restore(version+1); await expect(restore(version+1)).rejects.toThrow("cambió");
  expect((await db.query("select version from quotes where id=$1 and deleted_at is null",[id])).rows).toEqual([{version:version+2}]);
  expect((await db.query<{snapshot:unknown}>("select snapshot from quote_versions where id=$1",[prepared.id])).rows[0].snapshot).toEqual(prepared.snapshot);
  expect((await db.query("select actor_id from audit_events where entity_id=$1 and action='restored'",[id])).rows).toEqual([{actor_id:owner}]);
});
it("cancelar saldo conserva los cobros y excluye la deuda de agenda y cartera", async()=>{
 await asUser(owner);
 const proj=(await db.query<{id:string}>("select create_project_record($1,$2,'Convenio de cierre',current_date-1,1000,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const schedule=(await db.query<{id:string}>("select id from payment_schedules where project_id=$1",[proj])).rows[0].id;
 const request=crypto.randomUUID(),cancel=(balance:number,reason:string)=>db.query("select cancel_schedule_balance($1,$2,$3,current_date-1,1000,$4,$5)",[org,schedule,request,balance,reason]);
 const pay=(amount:number)=>db.query("select record_payment($1,$2,$3,current_date-1,'Cobro',$4)",[org,schedule,amount,crypto.randomUUID()]);
 await pay(350);await expect(cancel(1000,"Convenio")).rejects.toThrow("cambiaron");
 await asUser(reader);await expect(cancel(650,"Convenio")).rejects.toThrow("Permisos");
 await asUser(owner);await cancel(650,"Convenio");await cancel(650,"Convenio");await expect(cancel(650,"Motivo diferente")).rejects.toThrow("otro cambio");
 expect((await db.query("select amount_cents::int vigente,collected_cents::int cobros,balance_cents::int saldo from payment_schedule_balances where id=$1",[schedule])).rows).toEqual([{vigente:350,cobros:350,saldo:0}]);
 await expect(pay(1)).rejects.toThrow("saldo");
 expect((await db.query("select id from agenda_events where kind='collection' and id=$1",[schedule])).rows).toEqual([]);
 expect((await db.query("select previous_amount,amount_cents,reason from schedule_cancellation_history where id=$1",[request])).rows).toEqual([{previous_amount:"1000",amount_cents:"650",reason:"Convenio"}]);
 await asUser(other);expect((await db.query("select id from schedule_cancellations where id=$1",[request])).rows).toEqual([]);await asUser(owner);
});
it("concilia cobros y pagos por área sin convertir el saldo administrado en ingresos propios",async()=>{
 await asUser(owner);
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Reporte por área',current_date-1,1000,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 await db.query("select record_payment($1,id,125,current_date-1,'Abono de proyecto',$3) from payment_schedules where project_id=$2",[org,project,crypto.randomUUID()]);
 for(const [area,managed] of [["architecture",false],["service",false],["construction",true],["construction",false]] as const){
  const id=crypto.randomUUID();
  await db.query("insert into finance_cases(id,organization_id,project_id,name,area,managed,revenue_cents,cost_cents) values($1,$2,$3,'Prueba por área',$4,$5,1000,600)",[id,org,project,area,managed]);
  for(const [dir,cents] of [["in",700],["out",200]] as const)await db.query("insert into finance_entries(id,organization_id,case_id,direction,amount_cents,paid_on) values($1,$2,$3,$4,$5,current_date-1)",[crypto.randomUUID(),org,id,dir,cents]);
 }
 const report=()=>db.query<{area:string,managed:boolean,received:string,paid:string,net:string}>("select * from area_cash_report($1,current_date-1,current_date-1,$2,$3)",[org,client,project]);
 const rows=(await report()).rows;
 expect(rows.filter(r=>r.area!=="project_plan").map(r=>[r.area,r.managed,r.net])).toEqual([["architecture",false,"500"],["construction",false,"500"],["construction",true,"500"],["service",false,"500"]]);
 expect(rows.find(r=>r.area==="project_plan")).toMatchObject({received:"125",paid:"0",managed:false});
 expect(rows.filter(r=>!r.managed).reduce((sum,r)=>sum+BigInt(r.net),0n)).toBe(1625n);
 await asUser(reader);expect((await report()).rows).toEqual([]);await asUser(other);expect((await report()).rows).toEqual([]);await asUser(owner);
});
it("la aceptación mixta copia solo la plantilla automática y conserva su revisión",async()=>{
 await asUser(owner);
 const t=(await db.query<{id:string,phases:string[],business_line_id:string}>("select id,phases,business_line_id from phase_templates where organization_id=$1 and service_id is null order by name limit 1",[org])).rows[0];
 await asUser(reader);
 expect((await db.query("update phase_templates set on_quote_acceptance=true where id=$1 returning id",[t.id])).rows).toEqual([]);
 await asUser(owner);
 const enabled=(await db.query<{version:number}>("update phase_templates set on_quote_acceptance=true,tasks=array['Revisar levantamiento','Preparar propuesta'] where id=$1 returning version",[t.id])).rows[0].version;
 const alternate=crypto.randomUUID();await db.query("insert into phase_templates(id,organization_id,business_line_id,name,phases) values($1,$2,$3,'Prueba alternativa',array['Inicio'])",[alternate,org,t.business_line_id]);
 await expect(db.query("update phase_templates set on_quote_acceptance=true where id=$1",[alternate])).rejects.toThrow();
 const {id,version,prepared}=await issuedFixture();
 await db.query("select mark_quote_sent($1,$2,$3,$4)",[org,id,version,prepared.id]);
 const proj=(await db.query<{id:string}>("select accept_quote($1,id,version,current_date,current_date) id from quotes where id=$2",[org,id])).rows[0].id;
 const plans=()=>db.query("select template_id,template_version,phases,completed from project_phase_plans where project_id=$1",[proj]);
 const tasks=()=>db.query("select body,lane from project_task_board where project_id=$1 order by body",[proj]);
 expect((await plans()).rows).toEqual([{template_id:t.id,template_version:enabled,phases:t.phases,completed:0}]);
 expect((await tasks()).rows).toEqual([{body:"Preparar propuesta",lane:"pending"},{body:"Revisar levantamiento",lane:"pending"}]);
 await db.query("update phase_templates set on_quote_acceptance=false,phases=array['Nueva fase'],tasks=array['Otra tarea'] where id=$1",[t.id]);
 expect((await plans()).rows).toEqual([{template_id:t.id,template_version:enabled,phases:t.phases,completed:0}]);
 expect((await tasks()).rows).toEqual([{body:"Preparar propuesta",lane:"pending"},{body:"Revisar levantamiento",lane:"pending"}]);
});
it("el expediente vincula proyectos y obras indirectas y restringe documentos comerciales por rol",async()=>{
 await asUser(owner);
 const {id:quote,version}=await issuedFixture();
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Ficha relacionada',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const work=crypto.randomUUID();await db.query("insert into works(id,organization_id,project_id,name) values($1,$2,$3,'Obra sin cliente directo')",[work,org,project]);
 const list=()=>db.query("select id,kind from client_related_records where client_id=$1 and id in ($2,$3,$4) order by kind",[client,project,quote,work]);
 expect((await list()).rows).toEqual([{id:project,kind:"project"},{id:quote,kind:"quote"},{id:work,kind:"work"}]);
 await asUser(reader);expect((await list()).rows).toEqual([{id:project,kind:"project"}]);await asUser(other);expect((await list()).rows).toEqual([]);
 await asUser(owner);await db.query("select archive_quote($1,$2,$3)",[org,quote,version]);expect((await list()).rows).toHaveLength(2);
});
it("la cartera clasifica vencimientos y saldo real por dirección y custodia",async()=>{
 await asUser(owner);
 const id=crypto.randomUUID(),scheduleProject=(await db.query<{id:string}>("select create_project_record($1,$2,'Cartera de prueba',current_date-7,200,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const today="(now() at time zone (select timezone from organizations where id=$2))::date";
 await db.query("insert into finance_cases(id,organization_id,project_id,name,area,managed,revenue_cents,cost_cents,collect_on) values($1,$2,$3,'Antigüedad obra','construction',true,1000,800,"+today+"-31)",[id,org,scheduleProject]);
 const list=()=>db.query("select source,direction,managed,balance_cents,age_group from open_obligations where project_id=$1 order by source,direction",[scheduleProject]);
 const pay=(direction:string,amount:number)=>db.query("insert into finance_entries(id,organization_id,case_id,direction,amount_cents,paid_on) values($1,$2,$3,$4,$5,current_date-1)",[crypto.randomUUID(),org,id,direction,amount]);
 await pay("in",250);
 expect((await list()).rows).toEqual([{source:"agreement",direction:"in",managed:true,balance_cents:"750",age_group:"late_60"},{source:"agreement",direction:"out",managed:true,balance_cents:"800",age_group:"undated"},{source:"schedule",direction:"in",managed:false,balance_cents:"200",age_group:"late_30"}]);
 for(const [days,group] of [[-61,"late_over_60"],[-60,"late_60"],[-30,"late_30"],[0,"today"],[1,"upcoming"]] as const){
  await db.query("update finance_cases set pay_on="+today+"+$3::int where id=$1",[id,org,days]);expect((await list()).rows[1]).toMatchObject({age_group:group});
 }
 await pay("out",800);expect((await list()).rows).toHaveLength(2);
 await asUser(reader);expect((await list()).rows).toHaveLength(0);await asUser(other);expect((await list()).rows).toHaveLength(0);await asUser(owner);
});
it("importa clientes solo a staging habilitado, evita duplicados y revierte el lote ante conflictos",async()=>{
 await asUser(owner);
 const a={id:"cl-a",name:"Cliente legado A",email:"legado_a@example.test"},b={id:"cl-b",name:"Cliente legado B"};
 const apply=(rows:unknown[])=>db.query<{result:{inserted:number;unchanged:number}}>("select stage_legacy_clients($1,$2::jsonb,'company') result",[org,JSON.stringify(rows)]);
 await expect(apply([a,b])).rejects.toThrow("no habilitado");
 await db.exec("reset role");await db.query("insert into private.legacy_staging_targets values($1)",[org]);await asUser(reader);
 await expect(apply([a,b])).rejects.toThrow("no habilitado");await expect(db.query("insert into private.legacy_staging_targets values($1)",[otherOrg])).rejects.toThrow();
 await asUser(owner);expect((await apply([a,b])).rows[0].result).toEqual({inserted:2,unchanged:0});
 expect((await apply([a,b])).rows[0].result).toEqual({inserted:0,unchanged:2});
 await expect(apply([a,{...b,id:a.id}])).rejects.toThrow("repetido");
 await expect(apply([{id:"rollback",name:"Copia descartada"},{...a,name:"Nombre diferente"}])).rejects.toThrow("datos distintos");
 expect((await db.query("select id from clients where legacy_id='rollback'")).rows).toEqual([]);
 await expect(apply([{id:"cl-c",name:"Cliente independiente",email:a.email}])).rejects.toThrow("Posible duplicado");
 await asUser(other);await expect(apply([a])).rejects.toThrow("no habilitado");await asUser(owner);
});
it("emite variables comerciales desde una cotización concreta y conserva el vínculo con clientes anteriores",async()=>{
 await asUser(owner);
 const {prepared}=await issuedFixture();
 const header={title:"Carta de anticipo",kind:"letter",body:"{{cotizacion.folio}} · {{cotizacion.total}} · {{cotizacion.anticipo}}",margins:defaultDocumentOptions.margins,client_id:null,project_id:null};
 const save=(h:object,id:string|null=null,v=0)=>db.query<{id:string}>("select save_studio_document($1,$2,$3,$4::jsonb) id",[org,id,v,JSON.stringify(h)]);
 await expect(save({...header,quote_version_id:prepared.id,client_id:crypto.randomUUID()})).rejects.toThrow("no corresponde");
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Otro proyecto del cliente',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 await expect(save({...header,quote_version_id:prepared.id,project_id:project})).rejects.toThrow("no corresponde");
 const id=(await save({...header,quote_version_id:prepared.id})).rows[0].id;
 await save(header,id,1);
 const {snapshot}=(await db.query<{snapshot:unknown}>("select prepare_studio_document($1,$2,2)->'snapshot' snapshot",[org,id])).rows[0];
 const parsed=standaloneSnapshotSchema.parse(snapshot);
 expect(parsed.quote?.folio).toBe(prepared.snapshot.folio);
 expect(resolveDocumentBody(parsed)).toContain("$25,000.00");
 expect(resolveDocumentBody(parsed)).toContain("$12,500.00");
 await asUser(other);expect((await db.query("select id from document_quote_context where id=$1",[prepared.id])).rows).toEqual([]);await asUser(owner);
});
it("exporta el detalle con reversos sin modificar el flujo y excluye movimientos de otro proyecto",async()=>{
 await asUser(owner);const proj=(await db.query<{id:string}>("select create_project_record($1,$2,'Detalle contable',current_date-1,1000,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const entry=(await db.query<{id:string}>("select record_payment($1,id,300,current_date-1,'Referencia de proyecto',$3) id from payment_schedules where project_id=$2",[org,proj,crypto.randomUUID()])).rows[0].id;
 const account=crypto.randomUUID();await db.query("insert into finance_cases(id,organization_id,project_id,name,area,managed,revenue_cents,cost_cents) values($1,$2,$3,'Gastos de obra','construction',true,0,600)",[account,org,proj]);
 const out=crypto.randomUUID();await db.query("insert into finance_entries(id,organization_id,case_id,direction,amount_cents,expense_category,paid_on) values($1,$2,$3,'out',100,'labor',current_date-1)",[out,org,account]);
 await db.query("update finance_entries set reversal_reason='Duplicado' where id=$1",[out]);
 const ledger=()=>db.query<{rows:{id:string;reversed:boolean}[]}>("select cash_ledger_export($1,current_date-1,current_date-1,$2,$3) rows",[org,client,proj]);
 const list=(await ledger()).rows[0].rows;
 expect(list).toHaveLength(2);expect(list.find(r=>r.id===entry)).toMatchObject({area:"project_plan",amount:"300",managed:false,reversed:false,reference:"Referencia de proyecto"});
 expect(list.find(r=>r.id===out)).toMatchObject({area:"construction",amount:"100",managed:true,reversed:true,expense_category:"labor",reversal_reason:"Duplicado"});
 await asUser(reader);await expect(ledger()).rejects.toThrow("Permisos");await asUser(other);await expect(ledger()).rejects.toThrow("Permisos");await asUser(owner);
});
it("conserva el diseño copiado aunque cambie el preset y revierte escrituras inválidas", async () => {
  await asUser(owner);
  const {line, service} = await commercialFixture();
  const layout = {sections:["cover","budget"],margins:{top:32,bottom:30,left:20,right:30}};
  const parts = JSON.stringify([{service_id:service,quantity:"1"}]);
  const savePreset = (id:string|null, version:number, options:unknown) =>
    db.query<{id:string}>("select save_preset_with_layout($1,$2,$3,'Diseño','',$4::jsonb,'',$5::jsonb) id",[org,id,version,parts,JSON.stringify(options)]);
  const preset = (await savePreset(null,0,layout)).rows[0].id;
  const copy = (await db.query<{document_layout:unknown}>("select document_layout from preset_specs where id=$1",[preset])).rows[0].document_layout;
  const items = [{business_line_id:line,name:"Plano",quantity:"1",unit:"unit",unit_price_cents:100,discount_rate:"0"}];
  const quote = (await db.query<{id:string}>("select save_quote_with_layout($1,null,0,$2::jsonb,$3::jsonb) id",[org,JSON.stringify({...quoteHeader(),document_layout:copy}),JSON.stringify(items)])).rows[0].id;
  await savePreset(preset,1,{...layout,sections:["budget"]});
  await expect(savePreset(preset,2,{...layout,sections:["scope"]})).rejects.toThrow("PDF");
  await expect(savePreset(preset,2,{...layout,letterhead_revision:crypto.randomUUID()})).rejects.toThrow("Membrete");
  expect((await db.query("select version from preset_specs where id=$1",[preset])).rows).toEqual([{version:2}]);
  const version = (await db.query<{version:number}>("select version from quotes where id=$1",[quote])).rows[0].version;
  await draft(items,quote,version);
  const read = () => db.query("select options from sales_document_layouts where quote_id=$1",[quote]);
  expect((await read()).rows).toEqual([{options:layout}]);
  await asUser(reader);
  expect((await read()).rows).toEqual([]);
  await asUser(owner);
});
it("conserva el historial comercial con autor real y restringe lecturas y escrituras", async () => {
  await asUser(owner);
  const {line} = await commercialFixture();
  const opportunity = (await db.query<{id:string}>("insert into opportunities(organization_id,client_id,business_line_id,name) values($1,$2,$3,'Seguimiento') returning id",[org,client,line])).rows[0].id;
  const add = () => db.query("insert into opportunity_interactions(organization_id,opportunity_id,kind,body) values($1,$2,'call','Acordamos visita')",[org,opportunity]);
  const read = () => db.query("select actor_id,kind,body from opportunity_interactions where opportunity_id=$1",[opportunity]);
  await add();
  expect((await read()).rows).toEqual([{actor_id:owner,kind:"call",body:"Acordamos visita"}]);
  await expect(db.query("update opportunity_interactions set body='Cambio' where opportunity_id=$1",[opportunity])).rejects.toThrow();
  for (const user of [reader,other]){
    await asUser(user);
    expect((await read()).rows).toEqual([]);
    await expect(add()).rejects.toThrow();
  }
  await asUser(owner);
  await db.query("update opportunities set deleted_at=now() where id=$1",[opportunity]);
  await expect(add()).rejects.toThrow();
  expect((await read()).rows).toHaveLength(1);
});
it("agrupa categorías por estudio y respeta el texto original de cada servicio",async()=>{
  const {service:first}=await commercialFixture();
  const {service:second}=await commercialFixture();
  await db.query("update services set category=' Topografía ' where id=$1",[first]);
  await db.query("update services set category='TOPOGRAFÍA' where id=$1",[second]);
  const categories=()=>db.query("select name from service_categories where organization_id=$1 and category_key='topografía'",[org]);
  expect((await categories()).rows).toEqual([{name:"Topografía"}]);
  expect((await db.query("select category from services where id=$1 and category_key='topografía'",[first])).rows).toEqual([{category:" Topografía "}]);
  await db.query("update services set category='' where id=$1",[first]);
  expect((await db.query("select category_key from services where id=$1",[first])).rows).toEqual([{category_key:null}]);
  await asUser(other);expect((await categories()).rows).toEqual([]);
  await asUser(reader);expect((await categories()).rows).toEqual([]);await asUser(owner);
});
it("importa servicios a un destino aislado conservando precio, porcentaje, archivo e identidad",async()=>{
 const {line}=await commercialFixture();
 const item={id:"leg-service-1",name:"Supervisión histórica",price:8.25,unit:"pct",active:false,description:"Porcentaje de obra"};
 const apply=(row:object)=>db.query<{result:string}>("select stage_legacy_service($1,$2,$3::jsonb) result",[org,line,JSON.stringify(row)]);
 await db.exec("reset role");await db.query("delete from private.legacy_staging_targets where organization_id=$1",[org]);await asUser(owner);
 await expect(apply(item)).rejects.toThrow("no habilitado");
 await db.exec("reset role");await db.query("insert into private.legacy_staging_targets values($1)",[org]);await asUser(reader);
 await expect(apply(item)).rejects.toThrow("no habilitado");await asUser(owner);
 expect((await apply(item)).rows[0].result).toBe("inserted");
 expect((await apply(item)).rows[0].result).toBe("unchanged");
 expect((await db.query("select price_cents::int price,deleted_at is not null archived from services where organization_id=$1 and legacy_id=$2",[org,item.id])).rows).toEqual([{price:825,archived:true}]);
 await expect(apply({...item,id:"otro"})).rejects.toThrow("ambiguo");
 await expect(apply({...item,price:8.5})).rejects.toThrow("distintos");
 await expect(apply({...item,price:0.123})).rejects.toThrow("Precio");
 await expect(apply({...item,price:125})).rejects.toThrow("Precio");
});
it("el ensayo de presets conserva el orden, exige referencias activas y evita reescrituras",async()=>{
 const {line}=await commercialFixture(),preset={id:"p-hist",name:"Preset histórico",serviceIds:["srv-B","srv-A"]};
 const apply=(p:object)=>db.query<{result:string}>("select stage_legacy_preset($1,$2::jsonb) result",[org,JSON.stringify(p)]);
 await db.exec("reset role"); await db.query("insert into private.legacy_staging_targets values($1) on conflict do nothing",[org]);await asUser(owner);
 await expect(apply(preset)).rejects.toThrow("Faltan servicios");
 expect((await db.query("select id from service_presets where legacy_id=$1",[preset.id])).rows).toEqual([]);
 for(const id of preset.serviceIds) await db.query("select stage_legacy_service($1,$2,$3::jsonb)",[org,line,JSON.stringify({id,name:"Servicio "+id,active:true,unit:"m2",price:40})]);
 await asUser(reader);await expect(apply(preset)).rejects.toThrow("no habilitado");await asUser(owner);
 expect((await apply(preset)).rows[0].result).toBe("inserted");
 expect((await apply(preset)).rows[0].result).toBe("unchanged");
 expect((await db.query("select s.legacy_id,i.quantity::int qty from service_presets p join preset_items i on i.preset_id=p.id join services s on i.service_id=s.id where p.legacy_id=$1 order by i.position",[preset.id])).rows).toEqual([{legacy_id:"srv-B",qty:1},{legacy_id:"srv-A",qty:1}]);
 await expect(apply({...preset,serviceIds:["srv-A","srv-B"]})).rejects.toThrow("distintos");
});
it("archiva literalmente una propuesta para cotejo sin crear proyectos, contratos ni cobros",async()=>{
 await asUser(owner);
 const cid="hist-cl-"+crypto.randomUUID();
 const cli=(await db.query<{id:string}>("insert into clients(organization_id,legacy_id,name,kind) values($1,$2,'Archivo de prueba','company') returning id",[org,cid])).rows[0].id;
 const record={id:"historica-077",proposalNumber:"COT-2024-001",clientId:cid,items:[{unit:"pct"}],grandTotal:3200000,notes:"Texto íntegro"};
 const save=(row:object)=>db.query<{result:string}>("select stage_historical_quote($1,$2::jsonb,$3,'MXN') result",[org,JSON.stringify(row),"a".repeat(64)]);
 const totals=()=>db.query("select (select count(*) from quotes) quotes,(select count(*) from projects) projects,(select count(*) from finance_cases) agreements,(select count(*) from payments) payments");
 const read=()=>db.query("select payload,client_id from legacy_proposal_archive where organization_id=$1 and legacy_id=$2",[org,record.id]);
 await db.exec("reset role");await db.query("insert into private.legacy_staging_targets values($1) on conflict do nothing",[org]);await asUser(owner);
 const before=(await totals()).rows;
 expect((await save(record)).rows[0].result).toBe("inserted");expect((await save(record)).rows[0].result).toBe("unchanged");
 await expect(save({...record,grandTotal:1})).rejects.toThrow("distintos");
 expect((await read()).rows).toEqual([{payload:record,client_id:cli}]);
 expect((await totals()).rows).toEqual(before);
 await expect(db.query("update legacy_proposal_archive set folio='X' where legacy_id=$1",[record.id])).rejects.toThrow();
 for(const user of [other,reader]){await asUser(user);expect((await read()).rows).toEqual([]);await expect(save(record)).rejects.toThrow("no habilitado");}
 await asUser(owner);
});
it("importa un concepto sin alterar espacios, acentos ni saltos de línea y protege ediciones locales",async()=>{
 const item={id:"legacy-concept",name:"Alcance histórico",text:"Intervención · m²\nSegunda línea  "};
 const apply=(v:object)=>db.query<{result:string}>("select stage_legacy_concept($1,$2::jsonb) result",[org,JSON.stringify(v)]);
 await db.exec("reset role");await db.query("insert into private.legacy_staging_targets values($1) on conflict do nothing",[org]);await asUser(reader);
 await expect(apply(item)).rejects.toThrow("no habilitado");await asUser(owner);
 expect((await apply(item)).rows[0].result).toBe("inserted");
 expect((await apply(item)).rows[0].result).toBe("unchanged");
 expect((await db.query("select body from concepts where organization_id=$1 and legacy_id=$2",[org,item.id])).rows).toEqual([{body:item.text}]);
 await expect(apply({...item,id:"duplicate"})).rejects.toThrow("ambiguo");
 await db.query("update concepts set body='Nueva revisión' where organization_id=$1 and legacy_id=$2",[org,item.id]);
 await expect(apply(item)).rejects.toThrow("distintos");
});
it("exporta una instantánea verificable del estudio sin adjuntos binarios ni registros ajenos",async()=>{
 const download=(organization:string,section:string)=>db.query<{file:string}>("select export_workspace($1,$2) file",[organization,section]);
 await asUser(owner);
 const file=JSON.parse((await download(org,"todo")).rows[0].file);
 expect(file).toMatchObject({format:"estudio-os-workspace",version:1,organization_id:org,section:"todo"});
 expect(file.collections.clients.rows.some((row:{id:string})=>row.id===client)).toBe(true);
 for(const collection of Object.values(file.collections) as {count:number;rows:{organization_id:string}[]}[]){
   expect(collection.count).toBe(collection.rows.length);
   expect(collection.rows.every(row=>row.organization_id===org)).toBe(true);
 }
 expect(file.collections.dossier_files.count).toBeGreaterThan(0);
 expect(file.collections.dossier_files.rows.every((row:object)=>!("attachment" in row))).toBe(true);
 const financial=JSON.parse((await download(org,"finanzas")).rows[0].file);
 expect(financial.collections.finance_cases.count).toBeGreaterThan(0);
 expect(financial.collections.clients).toBeUndefined();
 await expect(download(org,"inexistente")).rejects.toThrow("Sección");
 await expect(download(otherOrg,"todo")).rejects.toThrow("propietario");
 await asUser(reader);await expect(download(org,"todo")).rejects.toThrow("propietario");await asUser(owner);
});
it("gestiona paquetes por línea sin crear obligaciones ni cambiar el alcance contratado",async()=>{
 const {line}=await commercialFixture();
 const project=(await db.query<{id:string}>("select create_project_record($1,$2,'Proyecto manual con paquetes',current_date,0,$3) id",[org,client,crypto.randomUUID()])).rows[0].id;
 const second=(await db.query<{id:string}>("select id from business_lines where organization_id=$1 and id<>$2 limit 1",[org,line])).rows[0].id;
 const save=(id:string,version:number,workLine:string,title:string)=>db.query("select save_work_package($1,$2,$3,$4,$5,$6,'Coordinar entrega')",[org,project,id,version,workLine,title]);
 const one=crypto.randomUUID(),two=crypto.randomUUID();
 await asUser(reader);await expect(save(one,0,line,"Anteproyecto")).rejects.toThrow("Permisos");await asUser(owner);
 await save(one,0,line,"Anteproyecto");await save(one,0,line,"Anteproyecto");await save(two,0,second,"Visualización");
 await expect(save(one,0,line,"Duplicado")).rejects.toThrow("utilizado");
 await save(one,1,line,"Anteproyecto revisado");await expect(save(one,1,line,"Obsoleto")).rejects.toThrow("cambió");
 expect((await db.query("select count(*)::int n from project_service_packages where project_id=$1 and manual",[project])).rows).toEqual([{n:2}]);
 expect((await db.query("select id from payment_schedules where project_id=$1",[project])).rows).toEqual([]);
 expect((await db.query("select package_id from package_financials where package_id in ($1,$2)",[one,two])).rows).toEqual([]);
 await db.query("select edit_project_details(organization_id,id,version,name,location,start_date,target_end,lead_id,'closed') from projects where id=$1",[project]);
 await expect(save(one,2,line,"Actualización tardía")).rejects.toThrow("disponible");
});
it("conserva tarifa interna entre clientes de distintas versiones y la excluye del snapshot público",async()=>{
 const {line}=await commercialFixture(),items=[{business_line_id:line,name:"Diseño",unit:"fixed",quantity:"1",unit_price_cents:2500000,discount_rate:"0"}];
 const header={...quoteHeader(),hourly_cost_cents:80000};
 const quote=await draft(items,null,0,header);
 const read=async()=>(await db.query<{version:number;rate:number|null}>("select version,hourly_cost_cents::int rate from quotes where id=$1",[quote])).rows[0];
 let row=await read();expect(row.rate).toBe(80000);
 expect((await db.query("select labor_cents,profit_cents,margin_pct from quote_fee_estimates where id=$1",[quote])).rows).toEqual([{labor_cents:"960000",profit_cents:"1537500",margin_pct:"61.50"}]);
 await draft(items,quote,row.version);row=await read();expect(row.rate).toBe(80000);
 await expect(draft(items,quote,row.version,{...header,estimated_hours:"999999999999"})).rejects.toThrow();
 expect(await read()).toEqual(row);
 const prepared=(await db.query<{snap:string}>("select (prepare_quote_version($1,$2,$3,$4::jsonb)->'snapshot')::text snap",[org,quote,row.version,JSON.stringify(defaultDocumentOptions)])).rows[0].snap;
 expect(prepared).not.toMatch(/hourly_cost|external_cost|estimated_hours/);
});
