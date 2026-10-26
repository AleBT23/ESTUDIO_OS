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
        <span className="planned">Plantillas · pendiente</span>
        <span className="planned">Biblioteca · pendiente</span>
        <span className="planned">Procedimientos · pendiente</span>
      </nav>
      <div className="settings-grid">
        <section className="panel padded">
          <p className="eyebrow">RECURSOS OFICIALES</p>
          <h2>La firma de tu estudio</h2>
          <Image
            className="resource-logo"
            src="/marca/logo.png"
            width={330}
            height={132}
            alt="Logotipo original de Alejandro Torres Arquitectura"
          />
          <p className="muted">
            Logotipo e isotipo originales, conservando proporciones, colores y
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
            src="/marca/membrete.png"
            width={2550}
            height={3300}
            alt="Membrete oficial carta con franja verde a la derecha y datos del estudio al pie"
          />
          <p className="caption">
            PNG original · 2550 × 3300 px · proporción carta exacta. Vista del
            recurso. Ajusta márgenes y secciones al emitir una cotización.
          </p>
        </section>
      </div>
    </>
  );
}
