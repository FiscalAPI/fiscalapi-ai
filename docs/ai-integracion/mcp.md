# Integración asistida por IA: MCP stdio (`@fiscalapi/mcp`)

Todo va en fiscalapi-ai, en `mcp/`, en la rama `feat/ai-integracion`.

Antes de escribir código contra el SDK de MCP, se consulta su documentación vigente (context7 o el repo `modelcontextprotocol/typescript-sdk`). La spec cambió el 2026-07-28 y el SDK v2 se mueve rápido.

### MCP-01 — Crear el paquete stdio con `listar_operaciones` y `obtener_operacion`
**Objetivo:** que `npx` levante un servidor stdio que dé al agente el catálogo completo de operaciones y el esquema de una operación, sin usar red.
**Depende de:** SK-01, BE-03.
**Skills:** `context7-mcp` (SDK de MCP), `superpowers:test-driven-development`.
**Modelo sugerido (opcional):** opus. Fija la base del paquete.
**Contexto:** D-07, D-08, D-13, D-14, RF-05, RNF-05, RNF-06.
**Alcance:**
- Paquete `@fiscalapi/mcp`:
  - TypeScript y ESM;
  - `engines.node >=22`;
  - `@modelcontextprotocol/server` v2 con versión exacta;
  - `bin` con shebang;
  - `publishConfig.access: public`;
  - licencia igual a la de los SDK.
- Script de build:
  - descarga `/api/openapi/v4.json` (live por omisión; ruta local para desarrollo);
  - genera `catalog.json` (operationId, método, ruta, resumen, tag) y `operations/<operationId>.json` con los `$ref` resueltos y recortados a unos 10k tokens como máximo;
  - guarda el hash de la fuente.
- Herramientas, con descripciones en español:
  - `listar_operaciones(tag?)` devuelve el catálogo compacto;
  - `obtener_operacion(operationId)` devuelve parámetros, cuerpo y respuestas;
  - un operationId inexistente devuelve un error claro con sugerencias por prefijo.
- Pruebas con un cliente MCP en proceso: `tools/list`, las dos herramientas, el error de id inexistente y el límite de tamaño.
**Criterios de aceptación (todos con `→ verificar`):**
- Arranca sin red → verificar: con la red desactivada (o variable que bloquea `fetch`), `node dist/index.js` responde `tools/list`.
- `listar_operaciones` devuelve 100 operaciones y cabe en unos 3k tokens como máximo → verificar: prueba que cuenta elementos y caracteres.
- `obtener_operacion("createInvoice")` (el nombre que fije D-13) no pasa del límite → verificar: prueba de tamaño.
- Funciona registrado en Claude Code → verificar: `claude mcp add fiscalapi -- node <ruta>/dist/index.js` y una consulta en la sesión.
**Pruebas focalizadas:** sí (contrato del paquete). `npm test` en `mcp/`.
**Fuera de alcance:** búsqueda en docs (MCP-02); publicación (MCP-03); herramienta `invocar` (D-07).
**Notas:**
- `@modelcontextprotocol/server` 2.3.1 (v2: `McpServer.registerTool` y `serveStdio`, que atiende las eras del protocolo 2025 y 2026) y zod 4.6.7, con versiones exactas. `data/` no se versiona: lo genera `npm run build:data`, que lee live por omisión o `FISCALAPI_OPENAPI_SOURCE`. Las pruebas usan el fixture del OpenAPI de BE-05.
- Con el fixture: 100 operaciones; el catálogo mide 9,023 caracteres y la operación mayor, createInvoice, 28,130 (se colapsan los media types duplicados de ASP.NET). Arranca en unos 200 ms sin red y pasan 123 pruebas. En Claude Code (`--mcp-config`) respondió una consulta con las dos herramientas.
- Para publicar hay que regenerar `data/` desde live cuando BE-03 esté desplegado (hoy live responde 401). Eso lo hace MCP-03.

### MCP-02 — Agregar `buscar_docs` con índice en español
**Objetivo:** que el agente encuentre la sección de las docs que responde a su duda fiscal sin leer páginas completas.
**Depende de:** MCP-01, DOC-01.
**Skills:** `context7-mcp` (MiniSearch, `@orama/stemmers`), `superpowers:test-driven-development`.
**Modelo sugerido (opcional):** opus.
**Contexto:** D-04, D-08. Medición en `requisitos.md`: 14 de 16 aciertos con MiniSearch y stemmer en español sobre las secciones.
**Alcance:**
- En el build: leer `llms.txt`, descargar las `.md` de sección (DOC-01), sin bloques de código en el texto indexado, e indexar con MiniSearch.
  - `processTerm`: minúsculas, quitar acentos (NFD), stopwords de `@orama/stopwords` en español y stemmer de `@orama/stemmers` en español.
  - Boost al título.
  - El índice se serializa con `toJSON`.
- `buscar_docs(consulta, limite=5)` devuelve título, URL `.md` de la sección, página y un extracto de unas 300 palabras como máximo.
- Prueba de regresión con las 16 consultas de la medición y la sección esperada de cada una. "lista negra 69b" queda documentada como caso conocido si sigue fallando.
**Criterios de aceptación (todos con `→ verificar`):**
- 15 de 16 consultas de regresión, o más, traen la sección esperada en el top 3 → verificar: `npm test`.
- La salida de `buscar_docs` no pasa de unos 10k tokens → verificar: prueba de tamaño.
- El paquete completo pesa menos de 5 MB → verificar: `npm pack --dry-run`.
**Pruebas focalizadas:** sí. `npm test` en `mcp/`.
**Fuera de alcance:** embeddings (D-08).
**Notas:** regresión 15/16 en el top 3, con las 16 consultas recuperadas de la sesión de planeación; caso conocido "buscar clave de producto sat" (sale primero la página "Catálogos SAT"). "lista negra 69b" ya pasa, y "estatus ante el sat" acepta `sat-validations/validar` (criterio `sat.cfdi.status`); ambas se asumieron y quedan documentadas en `test/search-regression.test.ts`.
Sin prefijo, porque "sat" coincidía con cada `SatXxx` de los catálogos de Carta Porte; fuzzy solo para términos de 5 letras o más. El extracto se ancla en la primera coincidencia exacta, así "CFDI40147" muestra su fila de la tabla. Paquete de 342.5 kB (1.8 MB desempaquetado) y arranque de 0.6 s.
El fixture `docs-corpus.json.gz` sale del build local de fapi-docs@73d326f, porque live todavía da 404 en las `.md` por sección. Después del deploy se regenera con `scripts/snapshot-docs.mjs`, y MCP-03 genera `data/` desde docs.fiscalapi.com.

### MCP-03 — Agregar el workflow de build y publicación por hash
**Objetivo:** que el paquete se regenere solo cuando cambian el OpenAPI o las docs, sin que nadie lo mantenga.
**Depende de:** MCP-02, U-02.
**Skills:** `fapi-release` (CI/CD sin pasos manuales), `context7-mcp` (documentación de npm trusted publishing).
**Modelo sugerido (opcional):** opus. Publica en un registro público.
**Contexto:** D-02, D-14. Trusted publishing exige un runner hospedado por GitHub, `id-token: write`, npm ≥11.5.1 y Node ≥22.14 (docs.npmjs.com/trusted-publishers, a revalidar en la tarea).
**Alcance:**
- Workflow en push a `main` (ruta `mcp/**`), semanal y manual:
  1. build;
  2. comparar el hash de la fuente con el de la última versión publicada;
  3. si cambió, subir el patch y publicar con provenance.
- El workflow queda deshabilitado para publicar (`if:` con una variable del repo) hasta que el usuario decida U-04.
- Verificar en la documentación de npm si la primera publicación puede hacerse por OIDC o requiere una publicación manual del usuario, y dejar el paso exacto en las Notas.
- Dependabot para `mcp/package.json`.
**Criterios de aceptación (todos con `→ verificar`):**
- El build sin cambios no publica → verificar: corrida manual del workflow con publicación en dry-run; el log dice "sin cambios".
- Con un cambio simulado en la fuente, el dry-run publicaría una versión nueva → verificar: corrida con un hash forzado y `npm publish --dry-run` en el log.
**Pruebas focalizadas:** ninguna (no aplica). La prueba es el dry-run.
**Fuera de alcance:** publicar de verdad (U-04).
**Notas:**
