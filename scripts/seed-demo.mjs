import { config } from "dotenv";
import postgres from "postgres";
config({ path: ".env.local", quiet: true });
if (
  process.env.APP_ENV !== "development" ||
  !process.env.DATABASE_URL ||
  !process.env.DEMO_ORGANIZATION_ID
)
  throw new Error(
    "Solo desarrollo: configura APP_ENV=development, DATABASE_URL y DEMO_ORGANIZATION_ID de un estudio exclusivo para pruebas.",
  );
const sql = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  await sql`insert into public.clients(organization_id,name,kind,source,legacy_id) values(${process.env.DEMO_ORGANIZATION_ID},'Cliente de demostración','person','Datos sintéticos','demo-client-001') on conflict(organization_id,legacy_id) do nothing`;
  console.log(
    "Cliente sintético creado únicamente en el estudio de demostración.",
  );
} finally {
  await sql.end();
}
