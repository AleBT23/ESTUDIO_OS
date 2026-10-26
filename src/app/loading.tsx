export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="loading-state">
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" />
      <span>Cargando tu espacio…</span>
    </div>
  );
}
