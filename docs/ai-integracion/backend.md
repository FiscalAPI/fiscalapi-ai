# Integración asistida por IA: backend (fapi-back)

El código de estas tareas va en fapi-back, en la rama `feat/ai-integracion` desde `main`. La fila del tablero se cierra con `fapi-back@<hash>`. Antes de usar cualquier API de `Microsoft.AspNetCore.OpenApi`, se consulta la documentación oficial de ASP.NET Core 10 (MCP microsoft-learn), sin responder de memoria.

### BE-01 — Publicar la superficie de 100 acciones con `[PublicApi]`
**Objetivo:** que el documento `v4` contenga exactamente las 100 acciones de D-05 y nada más, protegido por una prueba de equivalencia con la colección.
**Depende de:** —
**Skills:** `fapi-new-feature`, `dotnet-aspnetcore:dotnet-webapi`, `dotnet-test:run-tests`, `fapi-e2e-validate`.
**Modelo sugerido (opcional):** opus. Toca qué se expone públicamente (seguridad).
**Contexto:** D-05, D-12, RF-01, RNF-03. Hoy el documento se registra en `Infrastructure/DependencyInjection` con un `BuildServiceProvider` intermedio y un documento por versión (incluido el grupo v5 de `Controllers/V5/ValuesController`).
**Alcance:**
- Atributo `PublicApiAttribute` (metadata de endpoint) en las 100 acciones. Se aplica por acción, nunca por controller: en los mismos controllers hay 52 acciones fuera de la colección.
- Registro explícito del documento `v4` con `ShouldInclude` = tiene `PublicApiAttribute`. Se quita el `BuildServiceProvider` intermedio. Si se conserva un documento completo para Scalar en Development, se decide aquí y se documenta como D-NN.
- Prueba de equivalencia en WebApi.Tests:
  - lee los `*.request.yaml` de `postman/collections/Fiscalapi API Reference`;
  - normaliza MÉTODO+ruta (ids y valores → `{param}`; pdf y xml del portal → `{format}`);
  - resta la lista explícita de las 6 exclusiones de D-05, con su motivo en el código;
  - exige igualdad con las operaciones del documento `v4`.

  El parser YAML lo decide la tarea: se reutiliza uno de la solución si existe.
**Consumidores afectados:** Scalar en Development (deja de ver lo no público si no se conserva un documento completo); `grep -rn "AddOpenApi\|MapOpenApi\|MapScalarApiReference" WebApi.*`.
**Criterios de aceptación (todos con `→ verificar`):**
- El documento local trae 100 operaciones → verificar: `curl -s http://localhost:5000/api/openapi/v4.json | jq '[.paths[]|keys[]]|length'`, una vez que BE-03 mapee la ruta; antes, desde la prueba.
- Nada interno aparece (Tenants, TestAccounts, Checkouts, Impersonation, register, login, `load`) → verificar: la prueba de equivalencia, más `jq '.paths|keys'` revisado a mano.
- La prueba falla si se quita un `[PublicApi]` o una exclusión → verificar: quitar uno, correr la prueba y verla en rojo; luego restaurar.
**Pruebas focalizadas:** sí, por contrato y exposición. `dotnet test WebApi.Tests/WebApi.Tests.csproj --filter "FullyQualifiedName~OpenApi"`.
**Fuera de alcance:** `operationId` y metadatos (BE-02); servir la ruta (BE-03); resúmenes (BE-04 y BE-05).
**Notas:**
- fapi-back está en el worktree `fapi-back-ai` (rama `feat/ai-integracion`): el working tree `fapi-back` lo ocupa `feat/localization`. Un solo documento `v4`, también para Scalar (D-17).
- `PublicApiSurfaceTests` resuelve cada request contra todas las acciones v4 (la más literal gana): `tickets/{id}` no tiene `:guid`, así que comparar solo contra el documento no distinguía `tickets/load`.
- Pendiente de la revisión, fuera de alcance: RNF-03 depende de la colección (no hay prueba propia de esquemas de auth), y las anotaciones OpenAPI de acciones internas ya no llegan a ningún documento.

### BE-02 — Agregar `operationId` estable y metadatos del documento
**Objetivo:** que cada operación tenga un `operationId` estable y que el documento declare servidores reales, autenticación y descripción.
**Depende de:** BE-01.
**Skills:** `dotnet-aspnetcore:dotnet-webapi`, `dotnet-test:run-tests`.
**Modelo sugerido (opcional):** opus.
**Contexto:** D-06, D-13, RF-01.
**Alcance:**
- `operationId` en las 100 acciones con el mecanismo de nombre de endpoint de ASP.NET Core 10, en camelCase y en inglés (`createInvoice`, `cancelInvoice`, …). La convención queda en D-13 al cerrar.
- Transformer de documento:
  - `info` con título, versión de la API y la `description` tomada del spec de Postman (`postman/specs/Fiscalapi Specification`, solo como fuente del texto);
  - `servers` con `https://test.fiscalapi.com` y `https://live.fiscalapi.com`;
  - esquemas de seguridad `apiKey` en header para `X-API-KEY` y `X-TENANT-KEY`, aplicados a las operaciones no anónimas;
  - parámetro de header opcional `X-TIME-ZONE`.
- Prueba: los `operationId` son únicos y no vacíos, y las operaciones de `portal/*` no exigen seguridad.
**Textos visibles (propuesta al usuario):** el `info.description` final; se le muestra al usuario antes del commit (contrato público).
**Criterios de aceptación (todos con `→ verificar`):**
- 100 `operationId` únicos → verificar: `jq '[.paths[][]|.operationId]|unique|length'` igual a 100.
- Hay servidores y esquemas de seguridad → verificar: `jq '.servers, .components.securitySchemes'`.
- El documento pasa un lint de OpenAPI 3.1 → verificar: `npx @redocly/cli@<versión fija> lint` sobre el JSON descargado.
**Pruebas focalizadas:** sí (contrato). `--filter "FullyQualifiedName~OpenApi"`.
**Fuera de alcance:** resúmenes por operación (BE-04 y BE-05).
**Notas:**
- **Textos visibles** aprobados por el usuario (2026-10-15): `title` "Fiscalapi API", `version` "4.0" y como `description` el texto del spec de Postman (párrafo de la API, "Modos de operación" y los enlaces a credenciales y datos de prueba) sin la sección "Configura un environment", más la línea "Ambientes: `https://test.fiscalapi.com` (pruebas) y `https://live.fiscalapi.com` (producción)".
- La fuente (`postman/specs/Fiscalapi Specification`) solo existe sin rastrear en el working tree `fapi-back`, no en `main`: el texto aprobado se copia al transformer.
- Hecho: el operationId va en `[PublicApi("…")]` (D-13). `X-TIME-ZONE` lleva una descripción redactada desde `TimezoneMiddleware` (texto visible asumido; se revisa con BE-04). Redocly 2.57.0: válido salvo `operation-summary` (BE-04/05).
- Pendiente opcional: ninguna prueba fija los 100 nombres; renombrar uno no falla. La descripción aprobada dice que toda petición usa los dos headers, pero el portal es anónimo.

### BE-03 — Servir `/api/openapi/v4.json` anónimo en test y live
**Objetivo:** que cualquier agente o herramienta descargue el contrato sin credenciales y sin tocar nginx.
**Depende de:** BE-02.
**Skills:** `dotnet-aspnetcore:dotnet-webapi`, `fapi-release` (verifica que no haya pasos manuales de deploy), `fapi-e2e-validate`.
**Modelo sugerido (opcional):** opus. Expone una ruta anónima en producción.
**Contexto:** D-16. Hoy `MapOpenApi` y Scalar solo se registran en Development (`WebConfigurePipeline`).
**Alcance:**
- `MapOpenApi("/api/openapi/{documentName}.json")` en todos los ambientes, anónimo y con caché HTTP. Scalar sigue solo en Development.
- Verificar que el middleware de autenticación y de tenant (`X-TENANT-KEY` obligatorio) no rechaza esta ruta.
**Criterios de aceptación (todos con `→ verificar`):**
- Responde 200 sin headers de auth en local con `ASPNETCORE_ENVIRONMENT=Test` → verificar: `curl -si http://localhost:5000/api/openapi/v4.json | head -1`.
- No existe ruta para el documento v5 ni para uno interno → verificar: `curl -si …/api/openapi/v5.json` devuelve 404.
- Tras el deploy del usuario, responde en test y live → verificar: `curl -si https://test.fiscalapi.com/api/openapi/v4.json` (en CIERRE).
**Pruebas focalizadas:** sí (exposición). Prueba de integración: la ruta responde sin auth y no expone un documento distinto de `v4`.
**Fuera de alcance:** importar a Postman (U-03).
**Notas:**
- Verificado con el host de pruebas (ambiente Test) y con `curl` contra la app en Development: no se levantó la app local en Test porque ahí se activan los jobs del SAT sobre el restore de prod. "Caché" es output cache del servidor (10 min); la respuesta no lleva `Cache-Control`.
- Docs con la ruta vieja `/openapi/v4.json` "solo en Development" (prosa, nada lo consume en runtime): `fapi-back/docs/auto-invoice/{backend-emision,portal,release-notes}.md` y `fapi-auto-invoice/CLAUDE.md`.

### BE-04 — Agregar el trinquete de `EndpointSummary` y cubrir facturas
**Objetivo:** que ninguna operación pública nueva quede sin resumen, empezando por la ruta crítica del integrador.
**Depende de:** BE-01.
**Skills:** `dotnet-aspnetcore:dotnet-webapi`, `dotnet-test:run-tests`, `postman:api-documentation` y `postman:ai-readiness` (para redactar resúmenes y descripciones que contextualicen el OpenAPI generado).
**Modelo sugerido (opcional):** haiku para escribir los resúmenes; opus revisa la prueba.
**Contexto:** RF-01. Cada resumen es una línea en español más una `EndpointDescription` con el enlace a la sección de docs. No se ingieren comentarios XML: los `///` son notas internas. Indicación del usuario (2026-10-14): las descripciones deben usar el vocabulario fiscal con que busca un integrador, para que las consultas que fallaron en la prueba de búsqueda (`requisitos.md` → Contexto medido: "complemento de pago", "crear cliente receptor", "estatus ante el SAT", "descarga masiva") encuentren su operación.
**Alcance:**
- Prueba trinquete: lista las operaciones públicas sin `EndpointSummary` y la compara con una lista permitida en el código que solo puede bajar.
- Resúmenes de Invoices, People y TaxFiles.
**Textos visibles (propuesta al usuario):** los resúmenes de esta tarea; el usuario los revisa en el diff antes del commit.
**Criterios de aceptación (todos con `→ verificar`):**
- Agregar un `[PublicApi]` sin resumen hace fallar la prueba → verificar: agregarlo de forma temporal y ver la prueba en rojo.
- Invoices, People y TaxFiles salen de la lista permitida → verificar: `jq '[.paths[][]|select(.summary==null)]|length'` baja en ese número.
**Pruebas focalizadas:** sí (contrato). `--filter "FullyQualifiedName~OpenApi"`.
**Fuera de alcance:** el resto de controllers (BE-05).
**Notas:**
- **Textos visibles**: el usuario aprobó (2026-10-15) redactar los resúmenes de Invoices, People y TaxFiles y mostrarle el diff sin commit; el commit espera su OK sobre ese diff. BE-05 espera a esta tarea.

### BE-05 — Completar `EndpointSummary` en el resto de la superficie
**Objetivo:** que la lista permitida del trinquete quede vacía.
**Depende de:** BE-04.
**Skills:** `dotnet-aspnetcore:dotnet-webapi`, `dotnet-test:run-tests`, `postman:api-documentation` y `postman:ai-readiness`.
**Modelo sugerido (opcional):** haiku.
**Contexto:** igual que BE-04, incluida la indicación del usuario sobre el vocabulario fiscal de las descripciones.
**Alcance:** resúmenes y descripciones con enlace de Catalogs, Products, Stamps, ApiKeys, DownloadCatalogs, DownloadRequests, DownloadRules, Manifests, SatValidations, Tickets, Portal, AutoInvoice, Webhooks y Events (los que falten); la lista permitida se borra.
**Textos visibles (propuesta al usuario):** los resúmenes de esta tarea, revisados en el diff.
**Criterios de aceptación (todos con `→ verificar`):**
- No hay operaciones públicas sin resumen → verificar: `jq '[.paths[][]|select(.summary==null)]|length'` igual a 0.
- La lista permitida ya no existe → verificar: grep del nombre de la lista en WebApi.Tests sin resultados.
**Pruebas focalizadas:** las mismas de BE-04.
**Fuera de alcance:** —
**Notas:**
