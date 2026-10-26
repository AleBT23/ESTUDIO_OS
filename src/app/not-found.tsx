import Link from "next/link";
export default function NotFound() {
  return (
    <section className="panel empty-state">
      <h1>No encontramos esta página</h1>
      <p>Puede que la dirección haya cambiado.</p>
      <Link className="button button-primary" href="/">
        Volver al inicio
      </Link>
    </section>
  );
}
