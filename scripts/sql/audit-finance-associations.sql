-- Ejecutar con visibilidad completa de las tres tablas en una copia restaurada.
-- Devuelve una fila por discrepancia. Los vínculos opcionales vacíos son válidos.
with associations as (
 select c.organization_id,c.id,c.project_id,c.client_id,p.client_id as project_client,
        w.project_id as work_project,coalesce(w.client_id,wp.client_id) as work_client
 from public.finance_cases c
 left join public.projects p on p.organization_id=c.organization_id and p.id=c.project_id
 left join public.works w on w.organization_id=c.organization_id and w.id=c.work_id
 left join public.projects wp on wp.organization_id=w.organization_id and wp.id=w.project_id
), discrepancies as (
 select w.organization_id,'obra' as origen,w.id as registro,'cliente_del_proyecto' as relacion,
        w.client_id as seleccionado,p.client_id as esperado
 from public.works w join public.projects p on p.organization_id=w.organization_id and p.id=w.project_id
 where w.client_id<>p.client_id
 union all
 select organization_id,'acuerdo',id,'cliente_del_proyecto',client_id,project_client
 from associations where client_id<>project_client
 union all
 select organization_id,'acuerdo',id,'proyecto_de_la_obra',project_id,work_project
 from associations where project_id<>work_project
 union all
 select organization_id,'acuerdo',id,'cliente_de_la_obra',coalesce(client_id,project_client),work_client
 from associations where coalesce(client_id,project_client)<>work_client
)
select organization_id,origen,registro,relacion,seleccionado,esperado
from discrepancies order by organization_id,origen,registro,relacion;
