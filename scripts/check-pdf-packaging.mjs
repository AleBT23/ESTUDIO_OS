// Comprueba archivos realmente trazados y genera un PDF sintético aislado.
// No carga .env, no usa Supabase y no modifica los archivos de dependencias.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const entry = fileURLToPath(import.meta.resolve("pdfkit"));
const packageRoot = path.resolve(path.dirname(entry), "..");
const manifest = JSON.parse(await fs.readFile(path.join(packageRoot, "package.json"), "utf8"));
const requirePdfKit = createRequire(entry);
const aliases = Object.keys(manifest.exports).filter(key => key.startsWith("./standard-fonts/")).map(key => "#" + key.slice(2));
assert(aliases.length, "PDFKit no declara las fuentes esperadas: revisar el contrato de empaquetado.");
const needed = aliases.map(key => requirePdfKit.resolve(key));
const normalize = value => path.resolve(value).replaceAll(String.fromCharCode(92), "/");
const traces = [];
for (const route of ["cotizaciones", "documentos-estudio"]) {
  const file = path.join(root, ".next/server/app/api", route, "[id]/preview/route.js.nft.json");
  const trace = JSON.parse(await fs.readFile(file, "utf8"));
  const files = trace.files.map(name => path.resolve(path.dirname(file), name));
  const included = new Set(files.map(normalize));
  for (const font of needed) assert(included.has(normalize(font)), "Falta fuente CJS de PDFKit en el trazado de " + route + ": " + path.basename(font));
  traces.push(files);
}
const prefix = path.join(os.tmpdir(), "estudio-pdf-package-");
const temporary = await fs.mkdtemp(prefix);
const targetRoot = path.join(temporary, "node_modules/pdfkit");
try {
  for (const source of traces[0].filter(file => normalize(file).startsWith(normalize(packageRoot) + "/"))) {
    const relative = path.relative(packageRoot, source);
    assert(!relative.startsWith("..") && !path.isAbsolute(relative));
    const destination = path.join(targetRoot, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
  }
  for (const dependency of Object.keys(manifest.dependencies)) {
    const source = path.join(root, "node_modules", dependency);
    const destination = path.join(temporary, "node_modules", dependency);
    await fs.access(source);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.symlink(source, destination, process.platform === "win32" ? "junction" : "dir");
  }
  const isolatedEntry = path.join(targetRoot, path.relative(packageRoot, entry));
  const { default: PDFDocument } = await import(pathToFileURL(isolatedEntry).href);
  const document = new PDFDocument({ autoFirstPage: false });
  const chunks = [];
  const completed = new Promise((resolve, reject) => {
    document.on("data", bytes => chunks.push(bytes));
    document.on("end", resolve);
    document.on("error", reject);
  });
  document.addPage().font("Helvetica").text("PRUEBA SINTETICA DE EMPAQUETADO");
  document.end();
  await completed;
  assert.equal(Buffer.concat(chunks).subarray(0, 4).toString(), "%PDF");
  console.log("Empaquetado PDF correcto: dos rutas, " + needed.length + " fuentes CJS y PDF sintético aislado válido.");
} finally {
  // Ruta temporal recién creada, verificada antes de retirar solo este ensayo.
  assert(path.dirname(temporary) === os.tmpdir() && path.basename(temporary).startsWith("estudio-pdf-package-"));
  await fs.rm(temporary, { recursive: true, force: true });
}
