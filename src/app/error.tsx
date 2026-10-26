"use client";
import { Button } from "@/shared/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel empty-state">
      <h1>No pudimos cargar este espacio</h1>
      <p>
        Revisa la conexión e inténtalo de nuevo. Tus datos guardados se
        conservan.
      </p>
      <Button onClick={reset}>Volver a intentar</Button>
    </section>
  );
}
