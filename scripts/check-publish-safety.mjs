import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: root,
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean);
const forbidden =
  /(^|\/)(?:\.env(?:\..*)?|\.local|\.audit|\.netlify|\.vercel|legacy|backups?|respaldos|certificates|certs|output)(?:\/|$)|\.(?:pem|key|crt|cer|pfx|p12|jks|dump|backup|bak|rar|zip|7z|tar|tgz|db|sqlite3?|log|sql\.gz)$/i;
const findings = new Set();
const textExtensions =
  /\.(?:[cm]?[jt]sx?|json|md|toml|ya?ml|sql|ps1|vbs|html|css|txt)$/i;
let privateValues = [];
try {
  const local = await readFile(path.join(root, ".env.local"), "utf8");
  privateValues = local
    .split(/\r?\n/)
    .filter((line) =>
      /^(?:DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|NETLIFY_AUTH_TOKEN)=/.test(
        line,
      ),
    )
    .map((line) =>
      line
        .slice(line.indexOf("=") + 1)
        .trim()
        .replace(/^["']|["']$/g, ""),
    )
    .filter((value) => value.length > 12);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
for (const relative of new Set(candidates)) {
  const normalized = relative.replaceAll("\\", "/");
  if (normalized !== ".env.example" && forbidden.test(normalized))
    findings.add(normalized + ": archivo privado no excluido");
  if (!textExtensions.test(normalized) && normalized !== ".env.example")
    continue;
  const full = path.join(root, relative);
  if ((await stat(full)).size > 4 * 1024 * 1024) continue;
  const content = await readFile(full, "utf8");
  if (
    privateValues.some((value) => content.includes(value)) ||
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content) ||
    /sb_secret_[A-Za-z0-9_-]{20,}/.test(content) ||
    /postgres(?:ql)?:\/\/[^@\s:]+:[^@\s]+@/.test(content)
  )
    findings.add(
      normalized + ": posible credencial privilegiada (valor omitido)",
    );
  for (const token of content.match(
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  ) || []) {
    try {
      if (
        JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString())
          .role === "service_role"
      )
        findings.add(normalized + ": token service_role (valor omitido)");
    } catch {
      /* Solo JWT reconocibles; no se imprimen contenidos. */
    }
  }
}
if (findings.size) {
  console.error([...findings].join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Revisión de publicación correcta: ${new Set(candidates).size} archivos candidatos; credenciales conocidas, certificados, respaldos y legado excluidos.`,
  );
  console.log(
    "Revisión heurística local; no publica archivos ni sustituye la revisión humana de datos privados.",
  );
}
