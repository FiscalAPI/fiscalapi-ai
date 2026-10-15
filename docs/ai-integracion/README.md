# Integración asistida por IA

## Objetivo
Que un desarrollador integre FiscalAPI en su ERP, POS o SaaS desde Claude Code, Codex, Cursor o Copilot, y logre su primer timbre correcto en test al primer intento.

Para eso el feature publica:
- skills en español;
- un plugin para los 4 hosts;
- un MCP stdio opcional;
- los cimientos que esos tres necesitan: OpenAPI público y docs por sección.

**Cómo se sabe que quedó:**
- Las evals muestran mejora con las skills frente a sin ellas.
- Baja el tiempo al primer timbre en test (métrica norte en `requisitos.md`).

**Ramas:** `feat/ai-integracion` en cada repo que toque (fiscalapi-ai, fapi-back, fapi-docs, fapi-reusables), siempre desde `main`.

**Fuera de alcance:** MCP hosteado, sandbox sin "compra", CSD de prueba propios y el top de rechazos del PAC en Seq (MED-03, D-20). Ver `requisitos.md`.

## Cómo trabajar
Sigue el ciclo de `fapi-core` (sección 1). Particularidades de este feature:
- **El tablero vive aquí, en fiscalapi-ai,** porque el feature se escribe casi todo en este repo (decisión del usuario). El código de las tareas `BE-*` va en fapi-back y el de las `DOC-*` en fapi-docs o fapi-reusables; la fila de esas tareas se cierra con `<repo>@<hash>`.
- **Restricción dura: cero mantenimiento adicional para FiscalAPI (D-02).** Si una tarea agrega algo que hay que actualizar a mano en paralelo a las docs o al código, está mal planteada.
- **fiscalapi-ai es público.** Nada llega a `main` sin el PR que fusiona el usuario. Publicar en npm o en los marketplaces es un paso del usuario (U-04).
- **Todo en español:** skills, descripciones de herramientas del MCP y docs (D-04).
- **Entorno local:** fapi-back y fapi-docs se trabajan en los worktrees `../fapi-back-ai` y `../fapi-docs-ai` (rama `feat/ai-integracion`, ya con `npm ci` en fapi-docs-ai), para no tocar la rama `feat/localization` de sus working trees principales. fapi-reusables sigue en `feat/auto-invoice` con cambios del usuario; lo del feature va en el worktree `../fapi-reusables-ai` (rama `feat/ai-integracion` desde `origin/main`). fapi-docs tiene `user.name` local "Fiscalapi": todo commit ahí lleva `-c user.name=mendozagit -c user.email=mendoza.git@gmail.com`.
- **Reanudar:** relee este tablero y vuelve a lanzar `/loop` con el prompt del feature; toma la siguiente fila según `fapi-core`. Nada queda a medias fuera de git.

## Tablero
Estado ∈ `pendiente` | `en curso` | `hecho` | `bloqueado`. En `bloqueado`, el motivo o la pregunta va en las Notas de la tarea.

La siguiente tarea (global o de un área) es la primera fila `pendiente` (de esa área) cuyas dependencias sean `—` o `hecho`. El orden de las filas es la prioridad.

| ID | Tarea | Área | Depende de | Estado | Commit |
|---|---|---|---|---|---|
| MED-01 | Medir mezcla de tipos y complementos en el restore de prod | medicion | — | hecho | fiscalapi-ai@4f6664c |
| MED-02 | Medir embudo y tiempo al primer timbre en el restore de Test | medicion | — | hecho | fiscalapi-ai@a5f9586 |
| BE-01 | Publicar la superficie de 100 acciones con `[PublicApi]` | backend | — | hecho | fapi-back@8d31a9aa |
| BE-02 | Agregar `operationId` estable y metadatos del documento | backend | BE-01 | hecho | fapi-back@8194141e |
| BE-03 | Servir `/api/openapi/v4.json` anónimo en test y live | backend | BE-02 | hecho | fapi-back@3ab2a369 |
| BE-04 | Agregar el trinquete de `EndpointSummary` y cubrir facturas | backend | BE-01 | hecho | fapi-back@2bd55554 |
| BE-05 | Completar `EndpointSummary` en el resto de la superficie | backend | BE-04 | hecho | fapi-back@bc22dcec |
| DOC-01 | Generar `.md` por sección H2 en el build | docs | — | hecho | fapi-docs@b97ad82 |
| DOC-02 | Generar la página de errores de Pagos | docs | — | hecho | fapi-docs@816f3a4 |
| DOC-03 | Corregir el enlace del SDK de Node en `llms.txt` | docs | — | hecho | fapi-docs@b5eec29 |
| DOC-04 | Generar la página de errores de Comercio Exterior | docs | — | hecho | fapi-docs@73d326f, fapi-reusables@3be8d36 |
| SK-01 | Armar el esqueleto del repo, los manifiestos y el CI de enlaces | skills | — | hecho | fiscalapi-ai@6caa2c4 |
| SK-10 | Validar en el check semanal los enlaces "Docs:" del OpenAPI | skills | SK-01, BE-05 | hecho | fiscalapi-ai@b38786b |
| SK-02 | Escribir `fiscalapi-integracion` y `primer-timbre` | skills | SK-01, DOC-01 | hecho | fiscalapi-ai@05135bf |
| SK-03 | Escribir `fiscalapi-diagnostico` y `explicar-error` | skills | SK-01, DOC-02 | hecho | fiscalapi-ai@bce6b59 |
| SK-04 | Escribir `fiscalapi-ingreso-egreso` | skills | SK-02, MED-01 | hecho | fiscalapi-ai@1bcaf7d |
| SK-05 | Escribir `fiscalapi-pagos` | skills | SK-02, MED-01 | hecho | fiscalapi-ai@557c1f6 |
| SK-06 | Escribir `fiscalapi-ciclo-de-vida` y `revisar-integracion` | skills | SK-02 | hecho | fiscalapi-ai@e5d6690 |
| SK-07 | Escribir `fiscalapi-nomina` | skills | SK-02, MED-01 | hecho | fiscalapi-ai@51cbb20 |
| SK-08 | Escribir `fiscalapi-carta-porte` | skills | SK-02, MED-01 | hecho | fiscalapi-ai@9849def |
| SK-09 | Escribir `fiscalapi-comercio-exterior` | skills | SK-02, MED-01 | hecho | fiscalapi-ai@8cb8c77 |
| MCP-01 | Crear el paquete stdio con `listar_operaciones` y `obtener_operacion` | mcp | SK-01, BE-03 | hecho | |
| MCP-02 | Agregar `buscar_docs` con índice en español | mcp | MCP-01, DOC-01 | pendiente | |
| EV-01 | Montar el harness de evals con los casos de ingreso y pagos | evals | SK-05, MCP-02 | pendiente | |
| EV-02 | Agregar casos de nómina, carta porte y comercio exterior | evals | EV-01, SK-09 | pendiente | |
| EV-03 | Correr las 3 variantes y reportar | evals | EV-02 | pendiente | |
| U-02 | Confirmar el nombre y el scope del paquete npm (D-14) | usuario | — | hecho | |
| MCP-03 | Agregar el workflow de build y publicación por hash | mcp | MCP-02, U-02 | pendiente | |
| U-03 | Importar `/api/openapi/v4.json` al workspace de Postman | usuario | BE-03 | pendiente | |
| U-04 | Decidir la publicación en npm y en los marketplaces con el reporte de EV-03 | usuario | EV-03, MCP-03 | pendiente | |
| CIERRE | Suite de fapi-back, instalar en los 4 hosts y borrador de notas | cierre | todas | pendiente | |
