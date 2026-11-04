import { config } from "dotenv";
import postgres from "postgres";
import { readFile } from "node:fs/promises";
import { localMigrations, migrationPlan } from "./migration-inventory.mjs";
config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error(
    "Configura DATABASE_URL en .env.local. No se modificó ninguna base.",
  );
const planOnly = process.argv.length === 3 && process.argv[2] === "--plan";
if (process.argv.length > 2 && !planOnly)
  throw new Error("Opción de migración no reconocida.");
if (!planOnly && !["development", "staging"].includes(process.env.APP_ENV))
  throw new Error(
    "Producción requiere respaldo, revisión y aprobación antes de aplicar migraciones. Usa staging para validar.",
  );
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  connect_timeout: 15,
  ssl: {
    ca: await readFile(".local/supabase-ca.crt", "utf8"),
    rejectUnauthorized: true,
  },
});
try {
  const migrations = await localMigrations("supabase/migrations");
  async function readPlan(tx) {
    const [{ ledger }] =
      await tx`select to_regclass('estudio_migrations.applied')::text ledger`;
    const applied = ledger
      ? await tx`select name,sha256 from estudio_migrations.applied order by name`
      : [];
    return migrationPlan(migrations, applied);
  }
  const report = await sql.begin(
    "isolation level repeatable read read only",
    readPlan,
  );
  if (planOnly) {
    console.log(JSON.stringify(report, null, 2));
    if (!report.compatible) process.exitCode = 1;
  } else {
    if (!report.compatible)
      throw new Error("Historial incompatible. Revisa npm run db:plan.");
    await sql`create schema if not exists estudio_migrations`;
    await sql`create table if not exists estudio_migrations.applied(name text primary key, sha256 text not null, applied_at timestamptz not null default now())`;
    for (const { name, body, sha256: hash } of migrations) {
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(19001901)`;
        const prior =
          await tx`select sha256 from estudio_migrations.applied where name=${name}`;
        if (prior.length) {
          if (prior[0].sha256 !== hash)
            throw new Error(`Migración aplicada fue modificada: ${name}`);
          return;
        }
        await tx.unsafe(body);
        await tx`insert into estudio_migrations.applied(name,sha256) values(${name},${hash})`;
      });
      console.log(`Verificada: ${name}`);
    }
  }
} finally {
  await sql.end();
}
