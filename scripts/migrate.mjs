import { config } from "dotenv";
import postgres from "postgres";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
config({ path: ".env.local", quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error(
    "Configura DATABASE_URL en .env.local. No se modificó ninguna base.",
  );
if (process.env.APP_ENV === "production")
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
  await sql`create schema if not exists estudio_migrations`;
  await sql`create table if not exists estudio_migrations.applied(name text primary key, sha256 text not null, applied_at timestamptz not null default now())`;
  for (const name of (await readdir("supabase/migrations"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const body = await readFile(`supabase/migrations/${name}`, "utf8");
    const hash = createHash("sha256").update(body).digest("hex");
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
} finally {
  await sql.end();
}
