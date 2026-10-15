# Integración asistida por IA: decisiones vigentes

Reglas de este archivo:
- Cada decisión describe el estado actual. Si cambia, se reescribe en su lugar; la historia vive en git.
- Estado (uno de tres):
  - `confirmada`: el usuario la aprobó o es técnica ya resuelta.
  - `propuesta`: requiere el OK del usuario antes de la tarea que la usa.
  - `técnica — la fija <ID>`: la decide el agente en esa tarea.
- Una decisión nueva se agrega al final, con el siguiente D-NN libre.
- Vocabulario del feature:
  - **superficie pública:** las acciones con `[PublicApi]`.
  - **catálogo de operaciones:** la lista compacta operationId + método + ruta + resumen.
  - **sección:** un bloque H2 de una página de docs con su propia `.md`.
  - **variante de eval:** sin nada, con skills, o con skills más MCP.

---

### D-01 — La audiencia son los desarrolladores que integran
- **Decisión:** los recursos van dirigidos a equipos que meten FiscalAPI en su ERP, POS o SaaS desde agentes de código (Claude Code, Codex, Cursor, Copilot). No a contadores ni pymes que facturan desde un chat.
- **Por qué:** es donde se reduce el tiempo de integración, y en test no hay riesgo fiscal.
- **Consecuencias:** nada de acciones en live; las skills enseñan a escribir el código de integración.
- **Estado:** confirmada.

### D-02 — Cero mantenimiento adicional y nada hosteado
- **Decisión:** no se crea ningún servicio en ejecución (ni MCP remoto, ni BD, ni modelos). Todo lo derivado se genera solo desde el código o las docs.
- **Por qué:** es una restricción dura del usuario: "No quiero agregar superficie de mantenimiento adicional a fiscalapi".
- **Consecuencias:** se descarta el MCP remoto; el MCP stdio lleva el índice dentro del paquete y se regenera en CI (D-07, D-14).
- **Estado:** confirmada.

### D-03 — Las skills enrutan y enlazan; no copian las docs
- **Decisión:** 8 skills (`fiscalapi-integracion`, `-ingreso-egreso`, `-pagos`, `-nomina`, `-carta-porte`, `-comercio-exterior`, `-ciclo-de-vida`, `-diagnostico`) y 3 comandos (`primer-timbre`, `explicar-error`, `revisar-integracion`). Siguen el estándar agentskills.io. Sus `references/` solo tienen índices de enlaces a las `.md` y árboles de decisión.
- **Por qué:** si copiaran contenido de las docs, cada cambio de API obligaría a editarlas en paralelo (D-02).
- **Consecuencias:** una skill solo cambia cuando cambia "cómo se decide"; un enlace roto lo detecta el CI de SK-01.
- **Estado:** confirmada.

### D-04 — Todo en español
- **Decisión:** las skills, las herramientas y descripciones del MCP y las docs de este feature van en español.
- **Por qué:** docs.fiscalapi.com y el vocabulario del SAT están en español.
- **Consecuencias:** las consultas de regresión y las evals se escriben en español. Si la localización de fapi-docs se fusiona, se revisa si `buscar_docs` debe indexar también el inglés.
- **Estado:** confirmada.

### D-05 — OpenAPI desde el código; la superficie es la colección menos 6
- **Decisión:** `/api/openapi/v4.json` se genera del código. Incluye solo las acciones con `[PublicApi]`: las 106 de la colección "Fiscalapi API Reference" menos `POST account/register`, `POST account/login`, `GET reports/params/{documentType}/{tin}/{invoiceType}`, `GET tickets/load`, `GET webhooks/load` y `GET webhooks/{id}/deliveries/load`. En total, 100. `portal/*` y `events/trigger` sí quedan públicos.
- **Por qué:** lo indicó el usuario. La colección ya es la referencia pública validada.
- **Consecuencias:** una prueba de equivalencia lee la colección, resta esas 6 exclusiones y exige igualdad con el documento. Que `portal/*` y `events/trigger` sigan públicos es interpretación del agente (el usuario no los excluyó); el usuario puede corregirla.
- **Estado:** confirmada.

### D-06 — Un solo contrato; la colección conserva su propósito
- **Decisión:** el spec "Fiscalapi Specification" del workspace de Postman se reemplaza importando `/api/openapi/v4.json` (U-03) y deja de generarse desde la colección. La colección sigue siendo el artefacto de ejemplos curados por tipo de CFDI.
- **Por qué:** dos contratos en paralelo serían mantenimiento extra. El spec generado desde la colección no tiene esquemas ni `operationId`.
- **Consecuencias:** el `info.description` del spec de Postman pasa al transformer de BE-02. El archivo local `postman/specs/` queda obsoleto.
- **Estado:** confirmada.

### D-07 — MCP stdio de solo lectura con 3 herramientas
- **Decisión:** `@fiscalapi/mcp` expone `listar_operaciones(tag?)`, `obtener_operacion(operationId)` (con los `$ref` resueltos y recortado) y `buscar_docs(consulta)`. No tiene `invocar`, y no usa red en runtime.
- **Por qué:** la llamada a la API debe vivir en el código del integrador. Invocar desde el MCP no adelanta la integración y agrega superficie de seguridad.
- **Consecuencias:** el OpenAPI y el índice van dentro del paquete. Se publica solo si EV-03 muestra mejora frente a las skills solas (U-04).
- **Estado:** confirmada.

### D-08 — Se busca en las docs, no en el OpenAPI, y sin embeddings
- **Decisión:** `listar_operaciones` devuelve el catálogo completo, sin búsqueda. `buscar_docs` usa MiniSearch sobre las secciones, con un `processTerm` en español: minúsculas, sin acentos, stopwords de `@orama/stopwords` y stemmer de `@orama/stemmers`.
- **Por qué:** medido (ver `requisitos.md`). Sobre las operaciones, todos los motores fallan en lo fiscal; sobre las secciones de las docs, el léxico acierta 14 de 16. Los embeddings cuestan 130 MB y 14 s de arranque sin ganar nada.
- **Consecuencias:** las 16 consultas de la medición son la prueba de regresión de MCP-02.
- **Estado:** confirmada.

### D-09 — El sandbox sin "compra" se pospone
- **Decisión:** no se toca billing en este feature. La skill `fiscalapi-integracion` guía por el flujo actual (cuenta, suscripción de prueba con tarjeta de prueba y llaves).
- **Por qué:** sería código nuevo en un área crítica. El usuario pidió medir primero.
- **Consecuencias:** MED-02 mide el abandono en el paso de compra y el resultado se lleva al usuario.
- **Estado:** confirmada.

### D-10 — Los CSD de prueba se siguen enlazando desde SW
- **Decisión:** no se alojan certificados de prueba propios.
- **Por qué:** alojarlos obliga a renovarlos cuando venzan (D-02).
- **Consecuencias:** las skills enlazan a la página `testing-data` de las docs.
- **Estado:** confirmada.

### D-11 — Evals manuales antes de cada release, en 3 variantes
- **Decisión:** cada caso CFDI se corre sin nada, con skills, y con skills más MCP. Se califica con un UUID real en test más la consulta de su estado, y se cuentan los tokens. Se corre a mano antes de publicar, no en CI nocturno.
- **Por qué:** se mide la mejora sin un costo fijo de tokens.
- **Consecuencias:** EV-01 decide si reutilizar `skill-validator` de dotnet/skills o escribir un script mínimo.
- **Estado:** técnica — la fija EV-01.

### D-12 — El feature vive en fiscalapi-ai
- **Decisión:** el tablero y todo el trabajo de skills, MCP y evals van en `FiscalAPI/fiscalapi-ai` (público), en la rama `feat/ai-integracion` desde `main`. fapi-back y fapi-docs solo reciben los cambios mínimos de BE-* y DOC-*, cada uno en su rama.
- **Por qué:** lo indicó el usuario: "solo escribe sobre fiscalapi-ai".
- **Consecuencias:** las filas BE-* y DOC-* se cierran con `<repo>@<hash>`.
- **Estado:** confirmada.

### D-13 — `operationId` estable por acción pública
- **Decisión:** cada acción con `[PublicApi]` declara un `operationId` estable, en camelCase y en inglés como el código (por ejemplo `createInvoice`). Se fija con el mecanismo de nombre de endpoint de ASP.NET Core 10, verificado en la documentación oficial.
- **Por qué:** el MCP y las skills lo usan como id. El spec de Postman no trae ninguno.
- **Consecuencias:** cambiar un `operationId` es un cambio visible para los consumidores del OpenAPI.
- **Estado:** técnica — la fija BE-02.

### D-14 — Paquete `@fiscalapi/mcp`, publicado por CI cuando cambia el hash
- **Decisión:**
  - Nombre `@fiscalapi/mcp`, publicado con `access: public` por el usuario npm `fiscalapi`.
  - Node ≥22 y `@modelcontextprotocol/server` v2 con versión fijada, más Dependabot.
  - El build descarga `/api/openapi/v4.json` de live y las `.md` de sección, y publica solo si cambia el hash.
  - Publica con trusted publishing desde un runner hospedado por GitHub.
- **Por qué:** el usuario confirmó el nombre (2026-10-14), que está libre en npm. Trusted publishing no acepta runners self-hosted.
- **Consecuencias:** MCP-03 verifica en la documentación de npm si la primera publicación puede ser por OIDC o si requiere una publicación manual del usuario.
- **Estado:** confirmada.

### D-15 — Sin `llms-full.txt`
- **Decisión:** no se genera `llms-full.txt`. Lo que se agrega es la `.md` por sección.
- **Por qué:** serían unos 600k tokens, inservibles para un agente; una sola sección pesa hasta 156 KB.
- **Consecuencias:** DOC-01 genera las secciones y `llms.txt` sigue siendo el índice.
- **Estado:** confirmada.

### D-16 — El OpenAPI se sirve bajo `/api` para no tocar nginx
- **Decisión:** `MapOpenApi` se mapea a `/api/openapi/{documentName}.json`, anónimo y en todos los ambientes.
- **Por qué:** el nginx de test y el de live ya mandan `location ^~ /api` al back. El CD no toca nginx, que se cambia a mano (`infra/nginx/live/README.md`). Con otra ruta habría un paso manual.
- **Consecuencias:** cero cambios en nginx. La ruta hereda el rate limiting de `/api`.
- **Estado:** confirmada.

### D-17 — Un solo documento OpenAPI: el público
- **Decisión:** fapi-back registra un solo documento, `v4`, con las acciones `[PublicApi]`. Scalar en Development muestra ese mismo documento; no se conserva un documento completo con lo interno, y el grupo v5 (`Controllers/V5/ValuesController`) se queda sin documento.
- **Por qué:** lo interno (dashboard, Host, DevExtreme) no es contrato, y un segundo documento sería configuración que nadie consume. Así Scalar muestra lo mismo que reciben los integradores.
- **Consecuencias:** las pruebas de contrato OpenAPI solo cubren operaciones públicas. Las rutas internas se siguen probando por HTTP.
- **Estado:** confirmada (técnica, la fijó BE-01).
