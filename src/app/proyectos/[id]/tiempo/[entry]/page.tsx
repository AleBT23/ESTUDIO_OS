import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireContext } from "@/shared/auth/context";
import { canWriteProject } from "@/shared/permissions";
export default async function TimeHistory({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; entry: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const ctx = await requireContext(),
    { id, entry } = await params;
  if (
    !canWriteProject(ctx.membership.role) ||
    !z.uuid().safeParse(id).success ||
    !z.uuid().safeParse(entry).success
  )
    notFound();
  const page = Math.max(
    1,
    Math.min(10000, parseInt((await searchParams).page ?? "1") || 1),
  );
  const current = await ctx.db
    .from("project_time")
    .select("version,minutes,description,worked_on,task_id,package_id")
    .eq("organization_id", ctx.organization.id)
    .eq("project_id", id)
    .eq("id", entry)
    .maybeSingle();
  if (current.error) throw Error("No se pudo consultar el registro de tiempo.");
  if (!current.data) notFound();
  const history = await ctx.db
    .from("time_corrections")
    .select("version,actor_id,corrected_at,previous_values", { count: "exact" })
    .eq("time_id", entry)
    .order("version", { ascending: false })
    .range((page - 1) * 15, page * 15 - 1);
  if (history.error)
    throw Error("No se pudo consultar el historial de correcciones.");
  const values = [current.data, ...history.data.map((h) => h.previous_values)];
  const taskIds = [
    ...new Set<string>(values.flatMap((v) => (v.task_id ? [v.task_id] : []))),
  ];
  const packIds = [
    ...new Set<string>(
      values.flatMap((v) => (v.package_id ? [v.package_id] : [])),
    ),
  ];
  const [tasks, packs] = await Promise.all([
    taskIds.length
      ? ctx.db
          .from("project_notes")
          .select("id,body")
          .eq("organization_id", ctx.organization.id)
          .eq("project_id", id)
          .in("id", taskIds)
      : { data: [], error: null },
    packIds.length
      ? ctx.db
          .from("project_service_packages")
          .select("id,name")
          .eq("organization_id", ctx.organization.id)
          .eq("project_id", id)
          .in("id", packIds)
      : { data: [], error: null },
  ]);
  if (tasks.error || packs.error)
    throw Error("No se pudieron consultar las asociaciones del registro.");
  const format = new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: ctx.organization.timezone,
  });
  function details(v: {
    minutes: number;
    worked_on: string;
    description: string;
    task_id: string | null;
    package_id: string | null;
  }) {
    return (
      <>
        <strong>
          {v.worked_on} · {v.minutes} min
        </strong>
        <p>{v.description}</p>
        <p>
          Paquete ·{" "}
          {v.package_id
            ? (packs.data?.find((p) => p.id === v.package_id)?.name ??
              v.package_id)
            : "Sin asignar"}
        </p>
        <p>
          Tarea ·{" "}
          {v.task_id
            ? (tasks.data?.find((t) => t.id === v.task_id)?.body ?? v.task_id)
            : "Sin asignar"}
        </p>
      </>
    );
  }
  return (
    <>
      <Link href={"/proyectos/" + id + "#tiempo"}>
        Volver al registro de tiempo
      </Link>
      <h1>Historial de correcciones</h1>
      <section className="panel padded">
        <h2>Registro vigente · v{current.data.version}</h2>
        {details(current.data)}
      </section>
      <section className="panel padded">
        <h2>Versiones anteriores</h2>
        {!history.data.length && <p>Sin correcciones en esta página.</p>}
        {history.data.map((h) => (
          <article key={h.version}>
            <h3>Versión {h.version}</h3>
            {details(h.previous_values)}
            <small>
              Corregida el {format.format(new Date(h.corrected_at))} por{" "}
              {h.actor_id === ctx.user.id
                ? "mi cuenta"
                : "miembro " + h.actor_id.slice(0, 8)}
            </small>
          </article>
        ))}
        {page > 1 && <Link href={"?page=" + (page - 1)}>Más recientes </Link>}
        {page * 15 < (history.count ?? 0) && (
          <Link href={"?page=" + (page + 1)}>Anteriores</Link>
        )}
      </section>
    </>
  );
}
