import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const base = ".audit/legacy/tabulador de precios v2";
const files = [];
for (const name of (await readdir(base)).sort()) {
  const bytes = await readFile(path.join(base, name));
  const code = bytes.toString("utf8");
  files.push({
    name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    lines: code.split("\n").length,
    functions: [...code.matchAll(/^(?:async )?function (\w+)\(/gm)].map(
      (m) => m[1],
    ),
  });
}
const rar = await readFile("legacy/tabulador de precios v2.rar");
await mkdir("tests/fixtures", { recursive: true });
await writeFile(
  "tests/fixtures/legacy-inventory.json",
  JSON.stringify(
    {
      format: 1,
      archive: {
        path: "legacy/tabulador de precios v2.rar",
        sha256: createHash("sha256").update(rar).digest("hex"),
      },
      files,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Inventario: ${files.length} archivos; RAR preservado.`);
