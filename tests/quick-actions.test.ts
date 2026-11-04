import { it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QuickActions } from "@/modules/dashboard/quick-actions";
import type { Role } from "@/shared/permissions";
const render = (role: Role) =>
  renderToStaticMarkup(createElement(QuickActions, { role }));
it("limita los accesos de captura al rol del estudio", () => {
  expect(render("reader")).toBe("");
  const team = render("collaborator");
  expect(team).toContain("/proyectos?crear=visita");
  expect(team).toContain("/proyectos?crear=pendiente");
  expect(team).not.toContain("/administracion");
  expect(team).not.toContain("/comercial/");
  for (const role of ["owner", "admin"] as const) {
    const html = render(role);
    expect(html).toContain(
      "/administracion/operaciones?crear=acuerdo#nuevo-acuerdo",
    );
    expect(html).toContain("/comercial/pipeline?new=1");
    expect(html).toContain("/recursos/documentos?new=1");
  }
});
