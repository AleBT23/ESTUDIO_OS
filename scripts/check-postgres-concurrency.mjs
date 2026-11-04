// Requiere binarios locales de PostgreSQL. No acepta una URL de conexión.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  realpath,
} from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import postgres from "postgres";
const run = promisify(execFile);
const exe = (name) =>
  path.join(
    process.env.ESTUDIO_PG_BIN ||
      ".local/pg-validation/node_modules/@embedded-postgres/windows-x64/native/bin",
    name + (process.platform === "win32" ? ".exe" : ""),
  );
await run(exe("postgres"), ["--version"], { windowsHide: true });
const root = path.resolve(".local", "concurrency");
await mkdir(root, { recursive: true });
const dir = await mkdtemp(path.join(root, "run-")),
  cluster = path.join(dir, "data");
const password = randomUUID(),
  pwfile = path.join(dir, "init-pass"),
  owner = randomUUID();
const listener = createServer();
await new Promise((resolve, reject) =>
  listener.once("error", reject).listen(0, "127.0.0.1", resolve),
);
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));
const clients = [];
function connect() {
  const sql = postgres({
    host: "127.0.0.1",
    port,
    database: "postgres",
    username: "validator",
    password,
    ssl: false,
    max: 1,
    connect_timeout: 5,
    onnotice: () => {},
  });
  clients.push(sql);
  return sql;
}
let started = false;
try {
  await writeFile(pwfile, password + "\n", { mode: 0o600 });
  await run(
    exe("initdb"),
    [
      "-D",
      cluster,
      "-U",
      "validator",
      "--auth=scram-sha-256",
      "--pwfile=" + pwfile,
      "--encoding=UTF8",
      "--locale=C",
    ],
    { windowsHide: true },
  );
  await rm(pwfile);
  await new Promise((resolve, reject) => {
    const child = spawn(
      exe("pg_ctl"),
      [
        "-D",
        cluster,
        "-l",
        path.join(dir, "postgres.log"),
        "-o",
        "-h 127.0.0.1 -p " + port,
        "-w",
        "start",
      ],
      { windowsHide: true, stdio: "ignore" },
    );
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error("No se pudo iniciar PostgreSQL local: " + code)),
    );
  });
  started = true;
  const admin = connect();
  const [server] =
    await admin`select current_setting('data_directory') as dir,version() as version`;
  assert.equal(await realpath(server.dir), await realpath(cluster));
  await admin.unsafe(await readFile("tests/fixtures/pg-bootstrap.sql", "utf8"));
  await admin`alter default privileges in schema public grant execute on functions to anon,authenticated`;
  await admin`insert into auth.users(id) values(${owner})`;
  const migrations = (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort();
  for (const file of migrations) {
    const sql = await readFile(path.join("supabase/migrations", file), "utf8");
    await admin.begin((tx) => tx.unsafe(sql));
  }
  const first = connect(),
    second = connect();
  for (const db of [first, second]) {
    await db`select set_config('request.jwt.claim.sub',${owner},false)`;
    await db`set role authenticated`;
    await db`set statement_timeout='15s'`;
  }
  const [{ id: org }] =
    await first`select public.create_workspace('Prueba de concurrencia') id`;
  const [{ pid }] = await second`select pg_backend_pid() pid`;
  // El segundo escritor debe estar bloqueado antes de confirmar el primero.
  async function race(write) {
    let pending;
    try {
      await first.begin(async (tx) => {
        await write(tx);
        pending = write(second).then(
          () => null,
          (e) => e,
        );
        for (let attempt = 0; attempt < 100; attempt++) {
          const [activity] =
            await admin`select wait_event_type from pg_stat_activity where pid=${pid}`;
          if (activity.wait_event_type === "Lock") return;
          await delay(30);
        }
        throw Error("El segundo escritor no llegó a esperar el bloqueo.");
      });
      const failure = await pending;
      assert.ok(failure, "La segunda escritura excedente debía rechazarse");
    } finally {
      if (pending) await pending;
    }
  }
  const account = randomUUID();
  await first`insert into finance_cases(id,organization_id,name,area,revenue_cents,cost_cents) values(${account},${org},'Honorarios','architecture',100,0)`;
  await race(
    (db) =>
      db`insert into finance_entries(id,organization_id,case_id,direction,amount_cents,paid_on) values(${randomUUID()},${org},${account},'in',75,current_date-1)`,
  );
  const [balance] =
    await first`select received_cents::int collected,receivable_cents::int outstanding from finance_case_balances where id=${account}`;
  assert.deepEqual({ ...balance }, { collected: 75, outstanding: 25 });
  const work = randomUUID(),
    item = randomUUID();
  await first`insert into works(id,organization_id,name) values(${work},${org},'Obra concurrente')`;
  await first`insert into work_budget_items(id,organization_id,work_id,chapter,description,unit,quantity,unit_price_cents) values(${item},${org},${work},'Mediciones','Piso','m2',1,3)`;
  await race(
    (db) =>
      db`insert into work_estimates(id,organization_id,work_id,item_id,measured_on,quantity) values(${randomUUID()},${org},${work},${item},current_date,0.75)`,
  );
  const [measure] =
    await first`select count(*)::int entries,sum(amount_cents)::int earned from work_estimates where item_id=${item}`;
  assert.deepEqual({ ...measure }, { entries: 1, earned: 2 });
  const [customer] =
    await first`insert into clients(organization_id,name) values(${org},'Cliente de concurrencia') returning id`;
  const [project] =
    await first`select create_project_record(${org},${customer.id},'Reparto concurrente',current_date,0,${randomUUID()}) id`;
  const pack = randomUUID();
  await admin`insert into project_service_packages(id,organization_id,project_id,business_line_id,name,scope) select ${pack},${org},${project.id},id,'Paquete','[]'::jsonb from business_lines where organization_id=${org} limit 1`;
  await admin`insert into package_financials(organization_id,package_id,contracted_net_cents) values(${org},${pack},10001)`;
  await race(
    (db) =>
      db`insert into collaborator_fees(id,organization_id,project_id,package_id,member_id,label,rate_bps) values(${randomUUID()},${org},${project.id},${pack},${owner},'Diseño',6000)`,
  );
  const [fee] =
    await first`select sum(cost_cents)::int cost from finance_cases where package_id=${pack}`;
  assert.equal(fee.cost, 6001);
  console.log(
    JSON.stringify({
      postgres: server.version,
      migrations: migrations.length,
      verified: [
        "cobros concurrentes",
        "estimaciones concurrentes",
        "repartos concurrentes",
      ],
    }),
  );
} finally {
  await Promise.allSettled(clients.map((c) => c.end({ timeout: 2 })));
  if (started)
    await run(exe("pg_ctl"), ["-D", cluster, "-m", "fast", "-w", "stop"], {
      windowsHide: true,
    });
  if (path.dirname(dir) === root)
    await rm(dir, { recursive: true, force: true });
}
