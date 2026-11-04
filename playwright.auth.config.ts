import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: ".env.e2e.local", quiet: true });
const baseURL = "http://127.0.0.1:3419";
if (!process.argv.includes("--list")) {
  const missing = [
    "ESTUDIO_TEST_PUBLISHABLE_KEY",
    "ESTUDIO_TEST_ADMIN_EMAIL",
    "ESTUDIO_TEST_ADMIN_PASSWORD",
    "ESTUDIO_TEST_READER_EMAIL",
    "ESTUDIO_TEST_READER_PASSWORD",
  ].filter((k) => !process.env[k]);
  if (missing.length)
    throw new Error(
      "Falta configurar el Supabase local de prueba. Variables requeridas: " +
        missing.join(", "),
    );
}
export default defineConfig({
  testDir: "tests/authenticated",
  workers: 1,
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "npm run dev -- --port 3419",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 90000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.ESTUDIO_TEST_PUBLISHABLE_KEY ?? "",
      ESTUDIO_LOCAL_BUILD: "1",
      APP_ENV: "staging",
      DATABASE_URL: "",
    },
  },
});
