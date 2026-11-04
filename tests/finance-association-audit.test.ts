import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

it("detecta cuatro discrepancias históricas sin escribir ni señalar vínculos opcionales válidos", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
 create table projects(organization_id int,id int,client_id int);
 create table works(organization_id int,id int,client_id int,project_id int);
 create table finance_cases(organization_id int,id int,client_id int,project_id int,work_id int);
 insert into projects values(1,10,100),(1,20,200),(1,30,100);
 insert into works values(1,1,200,10),(1,2,null,10),(1,3,200,null);
 insert into finance_cases values(1,11,200,10,null),(1,12,null,30,2),(1,13,null,10,3),
 (1,14,null,null,2),(1,15,null,null,null),(1,16,100,10,2);
 begin read only;
 `);
    const query = await readFile(
      "scripts/sql/audit-finance-associations.sql",
      "utf8",
    );
    const { rows } = await db.query<{
      origen: string;
      registro: number;
      relacion: string;
      seleccionado: number;
      esperado: number;
    }>(query);
    expect(
      rows.map((r) => [
        r.origen,
        r.registro,
        r.relacion,
        r.seleccionado,
        r.esperado,
      ]),
    ).toEqual([
      ["acuerdo", 11, "cliente_del_proyecto", 200, 100],
      ["acuerdo", 12, "proyecto_de_la_obra", 30, 10],
      ["acuerdo", 13, "cliente_de_la_obra", 100, 200],
      ["obra", 1, "cliente_del_proyecto", 200, 100],
    ]);
    await db.exec("rollback");
  } finally {
    await db.close();
  }
});
