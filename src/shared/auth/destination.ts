// Only studio pages can be resumed after authentication.
export function studioDestination(value: unknown): string {
  if (
    typeof value !== "string" ||
    value.length > 4096 ||
    value.includes("\\") ||
    Array.from(value).some(
      (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
    )
  )
    return "/";
  if (
    !/^\/(?:administracion|proyectos|agenda|obras|comercial|recursos|configuracion|buscar)(?:[/?#]|$)/.test(
      value,
    )
  )
    return "/";
  const url = new URL(value, "https://estudio.invalid");
  return url.pathname === value.split(/[?#]/, 1)[0]
    ? url.pathname + url.search + url.hash
    : "/";
}
