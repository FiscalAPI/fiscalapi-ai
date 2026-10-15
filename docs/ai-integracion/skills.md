# Integración asistida por IA: skills y plugin

Todo va en fiscalapi-ai, en la rama `feat/ai-integracion`. Reglas comunes a SK-02 a SK-09:
- **Formato agentskills.io:**
  - `name` igual al nombre de la carpeta;
  - `description` de 1024 caracteres como máximo, que diga qué hace la skill, cuándo usarla y cuándo no;
  - `SKILL.md` en menos de 500 líneas.
- **D-03:** `references/` solo tiene índices de enlaces a las `.md` (de página o de sección) y árboles de decisión. Nada de payloads, tablas de catálogos ni mensajes de error copiados.
- **Fuentes permitidas:**
  - las `.md` de docs.fiscalapi.com;
  - `/api/openapi/v4.json`;
  - las herramientas de `@fiscalapi/mcp` (opcionales: la skill funciona sin MCP);
  - la API de test con la llave del integrador (`GET /api/v4/catalogs/{name}/{search}`, `POST /api/v4/invoices/calculate`).
- **Reglas de seguridad en todas:** nunca pedir ni escribir una llave live en el código; las llaves van en variables de entorno.

### SK-01 — Armar el esqueleto del repo, los manifiestos y el CI de enlaces
**Objetivo:** que el repo se instale como plugin en Claude Code, Codex, Cursor y Copilot, y que un enlace roto a las docs haga fallar el CI.
**Depende de:** —
**Skills:** `superpowers:writing-skills`, `anthropic-skills:skill-creator`, `plugin-authoring`. El formato de cada manifiesto se toma del repo de referencia que ya lo usa (stripe/ai, dotnet/skills, DevExpress/agent-skills), revisado con `gh api`.
**Modelo sugerido (opcional):** opus. Fija la estructura de la que dependen todas las tareas.
**Contexto:** D-03, D-12, RF-04.
**Alcance:**
- Estructura: `skills/`, `.claude-plugin/marketplace.json` y `plugin.json`, `.codex-plugin/`, `.cursor-plugin/`, `.github/plugin/`, `LICENSE` y README de instalación con el comando de cada host.
- CI (GitHub Actions, runner hospedado por GitHub) en cada PR y una vez por semana:
  - valida el frontmatter contra el estándar;
  - extrae cada URL de docs.fiscalapi.com de `skills/**`;
  - exige 200 en cada URL y que cada ancla exista.
- El MCP **no** se declara en los manifiestos todavía; eso depende de U-04 (D-07).
**Criterios de aceptación (todos con `→ verificar`):**
- Se instala en Claude Code desde la ruta local → verificar: `/plugin marketplace add ./` y `/plugin install`; `/plugin` lo muestra.
- Los manifiestos de Codex, Cursor y Copilot son válidos según el formato de referencia → verificar: diff de estructura contra el repo de referencia, más la instalación local en los hosts disponibles.
- El CI falla con un ancla rota → verificar: un PR de prueba con un ancla inventada sale en rojo.
**Pruebas focalizadas:** ninguna (no aplica). La prueba es el CI de enlaces.
**Fuera de alcance:** el contenido de las skills (SK-02 en adelante).
**Notas:**
- Manifiestos según D-18. Verificado: `claude plugin validate . --strict` en verde; instalación local en Claude Code 2.1.300 con una skill temporal (descubierta sin declararla, 0 MCP), desinstalada después. Codex, Cursor y Copilot no están instalados aquí: se validó su formato contra dotnet/skills, DevExpress/agent-skills y el código de `openai/codex`.
- `scripts/check-skills.mjs` (frontmatter, 200 y anclas) sale en 1 con un ancla inventada, una página 404 o un `name` inválido (fixture local). El PR de prueba en rojo necesita push: es del usuario. La instalación en Cursor es local (`~/.cursor/plugins/local`); su marketplace es parte de U-04.

### SK-02 — Escribir `fiscalapi-integracion` y `primer-timbre`
**Objetivo:** que en un proyecto vacío el agente instale el SDK correcto, configure ambiente y llaves, y logre un UUID en test.
**Depende de:** SK-01, DOC-01.
**Skills:** `superpowers:writing-skills`, `fapi-cfdi-rules` (para no decir nada falso del CFDI).
**Modelo sugerido (opcional):** opus. Es la skill más usada y fija el tono de todas.
**Contexto:** D-01, D-03, D-09, D-10.
**Alcance:**
- `fiscalapi-integracion`, con:
  - tabla de ruteo "qué vas a construir → qué skill y qué `.md` de sección";
  - ambientes y headers (`X-API-KEY`, `X-TENANT-KEY`, `X-TIME-ZONE`);
  - elección de SDK según el lenguaje del proyecto;
  - modo por valores o por referencias;
  - flujo actual para obtener llaves de test (D-09) y datos de prueba (D-10);
  - regla crítica: un 5xx o timeout puede significar ya timbrado, así que se consulta el estado antes de reintentar.
- Comando `primer-timbre`: detecta el lenguaje, instala el SDK, lee las llaves de variables de entorno y timbra una factura de ingreso en test.
**Criterios de aceptación (todos con `→ verificar`):**
- En un proyecto Node vacío y en uno .NET vacío, `primer-timbre` produce un UUID en test → verificar: correrlo con una llave de test local y consultar el UUID con `GET /api/v4/invoices/{id}`.
- La skill se dispara sola con "integra FiscalAPI" → verificar: el log de la sesión de Claude Code muestra la skill cargada.
- El CI de enlaces pasa → verificar: CI en verde.
**Pruebas focalizadas:** ninguna (no aplica). Lo cubre EV-01.
**Fuera de alcance:** complementos (SK-04 en adelante).
**Notas:**
- `primer-timbre` dio UUID en Node (`6b92a718-…`) y en .NET (`fba6dd24-…`), confirmados con `GET /invoices/{id}`. Corrió contra el back local (PAC de pruebas) con una cuenta creada por el producto (registro, Mailpit y Stripe test). La skill se dispara con "Quiero integrar FiscalAPI…".
- Las URL `.md` por sección (DOC-01) dan 404 en live hasta el deploy de fapi-docs. El check pasa contra el build local (138 enlaces). `references/sdks.md` documenta las trampas reales de los README: Node `FiscalApiClient`, `double` en Java y fechas.
- Con resultado incierto (5xx o timeout), el back no guarda la factura, así que "Listar facturas" no la muestra y el camino real es soporte con el `traceIdentifier`. La regla de la skill sigue a las docs: falta decidir si el back debe registrarla.

### SK-03 — Escribir `fiscalapi-diagnostico` y `explicar-error`
**Objetivo:** que ante una respuesta de error el agente distinga una validación de FiscalAPI, un rechazo del PAC o un 5xx, y proponga la corrección leyendo la tabla correcta.
**Depende de:** SK-01, DOC-02.
**Skills:** `superpowers:writing-skills`, `fapi-cfdi-rules`.
**Modelo sugerido (opcional):** opus.
**Contexto:** D-03. El top de rechazos del PAC (MED-03) quedó fuera de alcance (D-20).
**Alcance:**
- Árbol de decisión:
  - 400 con `propertyName` → validación;
  - códigos `CFDI40*`, `CRP*`, `NOM*`, `CCE*`, `CP*` → la `.md` de `/errors/…` que corresponda;
  - 5xx o timeout → consultar el estado antes de reintentar.
- Comando `explicar-error <código o respuesta>`.
**Criterios de aceptación (todos con `→ verificar`):**
- Con tres respuestas reales de ejemplo (una de cada tipo), `explicar-error` llega a la página y la fila correctas → verificar: transcript de la sesión.
- El CI de enlaces pasa → verificar: CI en verde.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** guardar o consultar rechazos históricos.
**Notas:**
- Contrato verificado en fapi-back: un rechazo del PAC responde el status del PAC con `message` = `"CÓDIGO - texto"`, `details` = detalle del PAC y `data` = null (`InvoiceIssuanceTests`, `PacRejectionCodeTests`). Las respuestas de prueba se armaron con ese contrato y la fila real CFDI40147, sin timbrar contra el PAC. `claude -p /fiscalapi:explicar-error` llegó a la página y la fila correctas en los 3 casos.
- `errors/pagos-20` aún no está publicada: el CI sale en rojo hasta desplegar fapi-docs (DOC-02). Contra el build local pasa (`FISCALAPI_DOCS_ORIGIN=http://localhost:3100`). Sin tabla de `CCE` (DOC-04), la skill usa el texto del rechazo. Solo los H2 tienen ancla en el sitio.

### SK-04 — Escribir `fiscalapi-ingreso-egreso`
**Objetivo:** que el agente arme bien una factura de ingreso, una nota de crédito y una factura global.
**Depende de:** SK-02, MED-01.
**Skills:** `superpowers:writing-skills`, `fapi-cfdi-rules`.
**Modelo sugerido (opcional):** opus.
**Contexto:** D-03. El orden de las secciones lo fija MED-01.
**Alcance:**
- Decisiones de régimen, uso CFDI, objeto de impuesto, método y forma de pago, factura global y relación de la nota de crédito.
- Cada decisión enlaza a su sección `.md`.
- Las claves del SAT se buscan con la API de catálogos de test.
**Criterios de aceptación (todos con `→ verificar`):**
- Con los prompts de ingreso, nota de crédito y global, el agente timbra en test → verificar: UUID y estado consultado (caso de EV-01).
- El CI de enlaces pasa → verificar: CI en verde.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** —
**Notas:**
- Timbrado en el back local (PAC de pruebas) con el plugin. Ingreso PUE `e84b01e8-…`. Nota de crédito `fb6129f0-…`: el XML trae `TipoRelacion="01"` al ingreso. Global mensual `c4405f7f-…` (XAXX010101000, 616, S01, CP igual al de expedición). Estatus consultado (simulado fuera de Production).
- Sin las skills del usuario (`--setting-sources project,local`), "factura global" dispara `fiscalapi-ingreso-egreso`. Con ellas, el caso global cargó `fapi-cfdi-rules`, una skill personal: las pruebas de disparo van aisladas.
- Lo que el back no valida antes del PAC: PPD con forma distinta de 99, y periodicidad 05 o meses 13-18 en la global; además, con `taxObjectCode` 06 u 08 descarta `itemTaxes`. `GET invoices/{id}?details=true` no devuelve `relatedInvoices`, aunque el XML sí los trae. La docs (`invoices-by-value:5943`) etiqueta `E` como "Ingreso".

### SK-05 — Escribir `fiscalapi-pagos`
**Objetivo:** que el agente emita un REP 2.0 correcto para facturas PPD y parcialidades.
**Depende de:** SK-02, MED-01.
**Skills:** `superpowers:writing-skills`, `fapi-cfdi-rules`.
**Modelo sugerido (opcional):** opus.
**Contexto:** D-03; errores `CRP*` (DOC-02).
**Alcance:** PUE frente a PPD, saldo anterior e insoluto, parcialidades, tipo de cambio y equivalencia, impuestos del pago; cada punto con su sección `.md`.
**Criterios de aceptación (todos con `→ verificar`):**
- El agente timbra en test una factura PPD y su complemento de pago → verificar: los dos UUID y su estado (caso de EV-01).
- El CI de enlaces pasa → verificar: CI en verde.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** —
**Notas:**
- Timbrado con el plugin, sin skills del usuario. PPD `99b472e9-…` (PPD/99, total 2320). Pago `60fc947f-…`: tipo P, XXX, CP01, sin forma ni método en la raíz; DoctoRelacionado a la PPD, parcialidad 1 (2320 → 1160 → 1160) y BaseDR proporcional de 1000. Estatus consultado (simulado).
- Defecto encontrado: `FechaPago` sale en UTC (18:58) mientras `Fecha` sale en hora local (12:58). Quedó en `known-issues.md` de fapi-back (`fapi-back@c9d1baff`), con prioridad alta.
- FiscalAPI no busca la factura PPD ni calcula saldos, y no rechaza forma o método de pago en la raíz de un P (lo hace el PAC). Las docs llaman `amount` al importe pagado del documento, pero el campo real es `paymentAmount`.

### SK-06 — Escribir `fiscalapi-ciclo-de-vida` y `revisar-integracion`
**Objetivo:** que el agente cubra lo que pasa después de timbrar (cancelar, consultar estado, XML y PDF, correo y webhooks) y revise una integración existente.
**Depende de:** SK-02.
**Skills:** `superpowers:writing-skills`, `fapi-cfdi-rules`.
**Modelo sugerido (opcional):** haiku para el borrador; opus revisa.
**Contexto:** D-03. `fiscalapi-cli` cubre webhooks en local (`listen`, `trigger`); la skill enlaza a su página de docs.
**Alcance:**
- Skill con cancelación (motivos y sustitución), estado ante el SAT, descarga de XML y PDF, envío por correo y verificación de la firma de webhooks.
- Comando `revisar-integracion`: busca llaves `sk_live_` o llaves en código, falta de `X-TIME-ZONE`, reintentos a ciegas tras un 5xx y webhooks sin verificar la firma.
**Criterios de aceptación (todos con `→ verificar`):**
- `revisar-integracion` detecta 4 defectos plantados en un proyecto de prueba → verificar: transcript con los 4 hallazgos.
- El CI de enlaces pasa → verificar: CI en verde.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** descarga masiva (se evalúa con MED-01 si merece su propia skill).
**Notas:**
- `revisar-integracion`, sin skills del usuario, encontró en un proyecto de prueba los 4 defectos plantados: llave `sk_live_` y tenant en `config.js`, falta de `X-TIME-ZONE`, reintento a ciegas tras un 5xx y webhook sin verificar la firma. Agregó otros 2, también reales: URL `live` en el código y `succeeded` sin revisar.
- El prefijo `sk_live_` sí es de FiscalAPI: `ApiKeyValueGenerator.cs` genera `sk_live_`, `sk_test_` o `sk_development_` más un GUID con guiones bajos. La firma de webhooks es Standard Webhooks (HMAC-SHA256 sobre el cuerpo crudo).
- Sin resolver: las docs (`webhooks/content.mdx:13`) dicen que sin `X-TIME-ZONE` las fechas de webhooks vienen en UTC con `Z`, pero el middleware usaría `America/Mexico_City`. La skill solo recomienda mandar siempre el header.

### SK-07 — Escribir `fiscalapi-nomina`
**Objetivo:** que el agente emita una nómina 1.2 correcta (empleador, empleado, percepciones y deducciones).
**Depende de:** SK-02, MED-01.
**Skills:** `superpowers:writing-skills`, `fapi-cfdi-rules`.
**Modelo sugerido (opcional):** opus.
**Contexto:** D-03; errores `NOM*` (página existente).
**Alcance:** datos de empleador y empleado en la persona, tipos de nómina, percepciones, deducciones, otros pagos e incapacidades; cada punto con su sección `.md`.
**Criterios de aceptación (todos con `→ verificar`):**
- El agente timbra en test una nómina ordinaria → verificar: UUID y estado (caso de EV-02).
- El CI de enlaces pasa → verificar: CI en verde.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** —
**Notas:**
- Timbrado con el plugin, sin skills del usuario: nómina ordinaria quincenal `a153d832-…`, de EKU9003173C9 (registro patronal B5510768108) a FUNK671228PH6. El XML no trae `FormaPago`; trae receptor 605/CN01, contrato 01 con régimen 02, `P112W`, ISR 520 en impuestos retenidos y subsidio 002 en 0. Estatus consultado (simulado).
- Riesgo del back: no limpia `paymentFormCode` en N (`ComprobanteBuilder.cs:15`) y no fuerza 605/CN01, así que la skill pide no mandar el primero y sí mandar los dos últimos. Los ejemplos de C# y Python de las docs usan 601/G01 y `PaymentFormCode`, y el cURL "por referencias" usa datos por valores.
- Las guías `md-version` de nómina en sat-docs están vacías: las reglas salen del PDF y de la matriz `errors/nomina-12`.

### SK-08 — Escribir `fiscalapi-carta-porte`
**Objetivo:** que el agente emita una Carta Porte 3.1 correcta (ubicaciones, mercancías y autotransporte).
**Depende de:** SK-02, MED-01.
**Skills:** `superpowers:writing-skills`, `fapi-cfdi-rules`.
**Modelo sugerido (opcional):** opus.
**Contexto:** D-03; errores de Carta Porte (página existente).
**Alcance:** tipo de CFDI (ingreso o traslado), ubicaciones y distancias, mercancías y material peligroso, autotransporte y figuras; cada punto con su sección `.md` y los catálogos por la API de test.
**Criterios de aceptación (todos con `→ verificar`):**
- El agente timbra en test una Carta Porte de traslado por autotransporte → verificar: UUID y estado (caso de EV-02).
- El CI de enlaces pasa → verificar: CI en verde.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** transporte marítimo, aéreo y ferroviario, salvo que MED-01 diga lo contrario.
**Notas:**
- Timbrado con el plugin, sin skills del usuario: traslado `f904a48d-…`, T/XXX con receptor igual al emisor y S01. Origen CMX y destino COA (850 km solo en el destino, igual que `TotalDistRec`), 10 cajas de 120 kg, C2 sin remolques, TPAF01 y operador 01. Estatus consultado (simulado).
- `FechaHoraSalidaLlegada` sale en UTC, el mismo defecto que `FechaPago`; quedó en `known-issues.md` (`fapi-back@f6ca9a69`). La API de catálogos no expone `c_Estado` de 3 letras ni códigos postales, así que la congruencia CP/colonia la valida solo el PAC.
- Las docs (`crear-factura-de-carta-porte:126`) dicen que en T `itemCode` debe ser igual a `bienesTranspId`. El caso 14 del SAT usa 78101800, y aquí timbró con 11121900: ninguna regla CP lo exige.

### SK-09 — Escribir `fiscalapi-comercio-exterior`
**Objetivo:** que el agente emita un CFDI de exportación con Comercio Exterior 2.0 correcto.
**Depende de:** SK-02, MED-01.
**Skills:** `superpowers:writing-skills`, `fapi-cfdi-rules`.
**Modelo sugerido (opcional):** opus.
**Contexto:** D-03; errores `CCE*` (DOC-02).
**Alcance:** clave de pedimento, Incoterm, receptor extranjero (`NumRegIdTrib`), mercancías, fracción arancelaria y tipo de cambio; cada punto con su sección `.md`.
**Criterios de aceptación (todos con `→ verificar`):**
- El agente timbra en test una exportación definitiva → verificar: UUID y estado (caso de EV-02).
- El CI de enlaces pasa → verificar: CI en verde.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** —
**Notas:**
- Timbrado con el plugin, sin skills del usuario: exportación definitiva `72064f38-…` con I/02, USD y TipoCambio = TipoCambioUSD 18.3528 (DOF del 14/10, tomado de Banxico por el agente). Receptor XEXX010101000 con USA, 123456789, 616 y S01. `NoIdentificacion` del concepto igual al de la mercancía, ValorDolares 400 y TotalUSD 400.00. Estatus consultado (simulado).
- El primer intento lo rechazó el PAC con CCE139: con EE. UU. el `estado` del receptor es clave de `c_Estado` (`TX`), no texto. Corregí la skill con la regla de la matriz (CCE139, CCE140).
- FiscalAPI no exige `02`, el Incoterm ni la congruencia entre conceptos y mercancías, y con USD sin `exchangeRate` escribe TipoCambio 1. El cURL de las docs trae un `valorDolares` (23.47) que no cuadra con 400 USD.

### SK-10 — Validar en el check semanal los enlaces "Docs:" del OpenAPI
**Objetivo:** que un título renombrado o retirado en fapi-docs no deje rotos, sin que nadie lo note, los enlaces "Docs:" de las descripciones del OpenAPI público.
**Depende de:** SK-01, BE-05.
**Skills:** ninguna de dominio. Se extiende `scripts/check-skills.mjs` de SK-01.
**Modelo sugerido (opcional):** haiku. Reutiliza el validador de enlaces que ya existe.
**Contexto:** D-02, RF-01. BE-04 y BE-05 escribieron a mano 84 enlaces a anclas H2 de docs.fiscalapi.com en las `EndpointDescription` de fapi-back, y solo se verificaron una vez. El check de SK-01 corre en cada PR y cada lunes, pero solo lee `skills/**`.
**Alcance:**
- El check también descarga `/api/openapi/v4.json`: de live por omisión, o de la URL de `FISCALAPI_OPENAPI_URL` para validar contra un back local. Extrae cada URL de docs.fiscalapi.com que aparece en `info.description` y en las `description` de cada operación.
- Esas URL se validan con la misma regla que las de las skills: 200 y ancla existente, contra `FISCALAPI_DOCS_ORIGIN` cuando está definido. Cada hallazgo indica el `operationId` donde está el enlace roto.
- Corre en el mismo job `Check`, sin un workflow nuevo.
**Criterios de aceptación (todos con `→ verificar`):**
- Los 84 enlaces del OpenAPI se validan y pasan → verificar: `FISCALAPI_OPENAPI_URL` apuntando al back local de `fapi-back-ai` y `node scripts/check-skills.mjs`, con el conteo de enlaces del OpenAPI en la salida.
- Un ancla rota en una descripción hace fallar el check y nombra la operación → verificar: un OpenAPI de prueba con un ancla inventada sale con código 1 y el `operationId` en el mensaje.
**Pruebas focalizadas:** ninguna (no aplica). La prueba es el propio check.
**Fuera de alcance:** las 31 operaciones que todavía no tienen línea "Docs:" (Webhooks, Tickets, Portal, AutoInvoice, Events).
**Notas:**
- `FISCALAPI_OPENAPI_URL` acepta una URL o la ruta de un `.json`. Contra el OpenAPI del código actual hay 87 enlaces (84 de operaciones y 3 de `info`). Con `FISCALAPI_DOCS_ORIGIN` en el build local de fapi-docs, los 100 enlaces pasan. Un ancla inventada sale con código 1 y nombra la operación (`OpenAPI transferStamps`).
- Hoy live responde 401 en `/api/openapi/v4.json`, porque BE-03 no está desplegado. Por eso el check de cada PR y cada lunes sale en rojo hasta el deploy de fapi-back. Es a propósito: el plugin y el MCP dependen de ese documento, y saltarlo escondería una regresión.
- También sale en rojo `errors/pagos-20.md` (SK-03), que es de DOC-02 y aún no está desplegada.
