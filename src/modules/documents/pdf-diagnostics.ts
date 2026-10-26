// Nunca registra mensajes de error, snapshots, tokens ni rutas privadas.
export function pdfFailureDetails(error: unknown, stage: "snapshot" | "render") {
  const exception = error instanceof Error ? error : null;
  const detail = exception as (Error & { code?: string; path?: string }) | null;
  const names = ["Error", "TypeError", "ReferenceError", "SyntaxError", "RangeError", "ZodError", "AggregateError"];
  const codes = ["ENOENT", "EACCES", "ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND", "ERR_REQUIRE_ESM"];
  const assets = ["Poppins-Regular.ttf", "Poppins-Medium.ttf", "Poppins-SemiBold.ttf", "noto-sans-latin-400-normal.woff", "noto-sans-latin-600-normal.woff", "MEMBRETA_CARTA_AT.png"];
  const asset = detail?.path?.split(/[\\/]/).at(-1);
  const message = exception?.message || "";
  const requested = message.match(/Cannot find (?:module|package) ['"]([^'"]+)['"]/)?.[1]?.replaceAll(String.fromCharCode(92), "/");
  const packagePath = requested?.split("/node_modules/").at(-1);
  const packages = ["@react-pdf/renderer", "@react-pdf/font", "@react-pdf/layout", "@pdf-lib/fontkit", "@swc/helpers", "fontkit", "pdfkit", "pdf-lib", "restructure", "brotli", "unicode-properties", "unicode-trie", "yoga-layout", "linebreak", "pako"];
  const missingModule = packagePath && packages.some(name => packagePath === name || packagePath.startsWith(name + "/")) && /^[@A-Za-z0-9_./-]+$/.test(packagePath) ? packagePath.slice(0, 200) : undefined;
  const missingAsset = requested && assets.find(name => requested.endsWith("/" + name));
  const reason = detail?.code === "ENOENT" ? "resource_not_found"
    : exception?.name === "ZodError" ? "schema_validation"
    : /not a function|not a constructor|cannot read properties/i.test(message) ? "module_or_type_error"
    : /font|glyph/i.test(message) ? "font_error" : "unspecified";
  return {
    stage,
    name: exception && names.includes(exception.name) ? exception.name : "Error",
    code: detail?.code && codes.includes(detail.code) ? detail.code : undefined,
    asset: asset && assets.includes(asset) ? asset : undefined,
    reason,
    missingModule,
    missingAsset,
    frames: exception?.stack?.split("\n").filter(line => /^\s+at /.test(line))
      .map(line => line.match(/([^/\\()\s]+\.(?:[cm]?[jt]sx?):\d+:\d+)\)?$/)?.[1])
      .filter((line): line is string => Boolean(line)).slice(0, 5) || [],
  };
}
