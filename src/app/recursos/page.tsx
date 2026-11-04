import Image from "next/image";
import Link from "next/link";
export default function ResourcesPage() {
  return (
    <>
      <div className="page-heading">
        <p className="eyebrow">LA MEMORIA DEL ESTUDIO</p>
        <h1>Recursos del estudio</h1>
        <p>Una identidad consistente. Conocimiento que permanece.</p>
      </div>
      <nav className="tabs" aria-label="Recursos">
        <span className="selected">Identidad gráfica</span>
        <Link href="/recursos/documentos">Documentos</Link>
        <Link href="/recursos/plantillas">Plantillas</Link>
        <Link href="/recursos/biblioteca">Biblioteca técnica</Link>
        <Link href="/recursos/procedimientos">Procedimientos</Link>
      </nav>
      <div className="settings-grid">
        <section className="panel padded">
          <p className="eyebrow">RECURSOS OFICIALES</p>
          <h2>La firma de tu estudio</h2>
          <Image
            className="resource-logo"
            src="/marca/logo-ab.png"
            width={330}
            height={110}
            alt="Logotipo de Alejandro Barajas Arquitectura"
          />
          <p className="muted">
            Logotipo proporcionado, conservando proporciones, colores y
            transparencia.
          </p>
          <p className="caption">
            Los colores de interfaz toman como referencia los recursos
            proporcionados. Tipografía de interfaz provisional: la del sistema
            operativo.
          </p>
        </section>
        <section className="panel padded">
          <p className="eyebrow">DOCUMENTOS CON IDENTIDAD</p>
          <h2>Membrete carta</h2>
          <Image
            className="resource-image"
            src="/marca/membrete-ab.png"
            width={1102}
            height={1427}
            alt="Membrete oficial carta transparente con franja verde a la derecha y logo superior"
          />
          <p className="caption">
            PNG transparente · 1102 × 1427 px · formato carta. Vista del
            recurso. Ajusta márgenes y secciones al emitir una cotización.
          </p>
        </section>
      </div>
    </>
  );
}

export const metadata = { title: "Recursos del estudio" };
