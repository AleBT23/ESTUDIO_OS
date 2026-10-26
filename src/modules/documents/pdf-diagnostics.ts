// Nunca registra mensajes de error, snapshots, tokens ni rutas privadas.
export function pdfFailureDetails(error: unknown, stage: "snapshot" | "render") {
  const exception = error instanceof Error ? error : null;
  const detail = exception as (Error & { code?: string; path?: string }) | null;
  const names = ["Error", "TypeError", "ReferenceError", "SyntaxError", "RangeError", "ZodError", "AggregateError"];
  const codes = ["ENOENT", "EACCES", "ERR_MODULE_NOT_FOUND", "MODULE_NOT_FOUND", "ERR_REQUIRE_ESM"];
  const assets = ["Poppins-Regular.ttf", "Poppins-Medium.ttf", "Poppins-SemiBold.ttf", "noto-sans-latin-400-normal.woff", "noto-sans-latin-600-normal.woff", "MEMBRETA_CARTA_AT.png"];
  const asset = detail?.path?.split(/[\\/]/).at(-1);
  const message = exception?.message || "";
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
    frames: exception?.stack?.split("\n").filter(line => /^\s+at /.test(line))
      .map(line => line.match(/([^/\\()\s]+\.(?:[cm]?[jt]sx?):\d+:\d+)\)?$/)?.[1])
      .filter((line): line is string => Boolean(line)).slice(0, 5) || [],
  };
}
