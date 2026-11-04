import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { DossierNav } from "@/shared/ui/dossier-nav";
it("muestra las secciones del proyecto según el rol y los paquetes disponibles", () => {
  const view = (role: "admin" | "reader" | "collaborator") =>
    renderToStaticMarkup(
      createElement(DossierNav, {
        scope: "project",
        role,
        packages: role === "admin",
      }),
    );
  expect(view("reader")).toContain('href="#entregables"');
  expect(view("reader")).not.toContain('href="#cobros"');
  expect(view("reader")).not.toContain('href="#tiempo"');
  expect(view("collaborator")).toContain('href="#tiempo"');
  expect(view("collaborator")).not.toContain('href="#paquetes"');
  expect(view("admin")).toContain('href="#paquetes"');
  expect(view("admin")).toContain('href="#cobros"');
});
it("el expediente archivado oculta el acceso al portal y el lector puede consultar proyectos vinculados", () => {
  const archived = renderToStaticMarkup(
    createElement(DossierNav, {
      scope: "client",
      role: "admin",
      archived: true,
    }),
  );
  expect(archived).toContain('href="#archivos"');
  expect(archived).not.toContain('href="#portal"');
  const reader = renderToStaticMarkup(
    createElement(DossierNav, { scope: "client", role: "reader" }),
  );
  expect(reader.match(/href=/g)).toHaveLength(3);
});
