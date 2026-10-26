import Link from "next/link";
import { requireContext } from "@/shared/auth/context";
import { canManageCommercial } from "@/shared/permissions";
import { CommercialTabs } from "@/shared/ui/commercial-tabs";
import { Button } from "@/shared/ui/button";
import { PresetForm } from "@/modules/quotes/preset-form";
import type { Service } from "@/modules/quotes/schema";
export default async function PresetsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; selected?: string; edit?: string }>;
}) {
  const ctx = await requireContext();
  if (!canManageCommercial(ctx.membership.role))
    return (
      <p className="notice">
        Los presets comerciales están disponibles para administradores.
      </p>
    );
  const filter = await searchParams;
  const [presetsResult, servicesResult, itemsResult] = await Promise.all([
    ctx.db
      .from("service_presets")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .is("deleted_at", null)
      .order("name")
      .limit(500),
    ctx.db
      .from("services")
      .select("*")
      .eq("organization_id", ctx.organization.id)
      .is("deleted_at", null)
      .order("name")
      .limit(500),
    ctx.db
      .from("preset_items")
      .select("preset_id,service_id,quantity,position")
      .eq("organization_id", ctx.organization.id)
      .order("position")
      .limit(10000),
  ]);
  if (presetsResult.error || servicesResult.error || itemsResult.error)
    throw new Error("No se pudieron cargar presets y servicios.");
  const presets = presetsResult.data || [];
  const selected = presets.find((p) => p.id === filter.selected);
  const services = (servicesResult.data || []) as Service[];
  const selectedItems = (itemsResult.data || [])
    .filter((i) => i.preset_id === selected?.id)
    .map((i) => ({ service_id: i.service_id, quantity: String(i.quantity) }));
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">MENOS REPETICIÓN, MÁS CRITERIO</p>
        <h1>Presets de servicios</h1>
        <p>Un punto de partida para propuestas que siguen siendo únicas.</p>
      </div>
      <CommercialTabs active="/comercial/presets" />
      {filter.new === "1" || (selected && filter.edit === "1") ? (
        <PresetForm
          services={services}
          preset={
            selected && filter.new !== "1"
              ? {
                  id: selected.id,
                  name: selected.name,
                  notes: selected.notes,
                  version: selected.version,
                  items: selectedItems,
                }
              : undefined
          }
        />
      ) : selected ? (
        <section className="panel padded">
          <div className="section-heading">
            <h2>{selected.name}</h2>
            <Button variant="outline" asChild>
              <Link href={`/comercial/presets?selected=${selected.id}&edit=1`}>
                Editar preset
              </Link>
            </Button>
          </div>
          <p className="muted">{selected.notes || "Sin notas adicionales"}</p>
          {selectedItems.map((item, index) => (
            <p key={index}>
              {item.quantity} ×{" "}
              {services.find((s) => s.id === item.service_id)?.name ||
                "Servicio archivado; revísalo antes de usar"}
            </p>
          ))}
          <Button variant="ghost" asChild>
            <Link href="/comercial/presets">← Volver a presets</Link>
          </Button>
        </section>
      ) : (
        <>
          <div className="toolbar">
            <p className="caption">{presets.length} presets</p>
            <Button asChild>
              <Link href="/comercial/presets?new=1">Nuevo preset +</Link>
            </Button>
          </div>
          {presets.length ? (
            <div className="overview-grid">
              {presets.map((preset) => (
                <Link
                  className="panel overview-card"
                  key={preset.id}
                  href={`/comercial/presets?selected=${preset.id}`}
                >
                  <h3>{preset.name}</h3>
                  <p>{preset.notes || "Conjunto de servicios"}</p>
                  <span className="card-action">Ver servicios →</span>
                </Link>
              ))}
            </div>
          ) : (
            <section className="panel empty-state">
              <h2>Prepara tu próximo punto de partida</h2>
              <p>
                Agrupa servicios y cantidades para reutilizarlos sin alterar
                propuestas anteriores.
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
