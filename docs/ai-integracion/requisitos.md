# Integración asistida por IA: requisitos

## Contexto medido
Fecha de las mediciones: 2026-10-14.

**Lo que FiscalAPI ya tiene**
- docs.fiscalapi.com (Next.js y MDX) publica `llms.txt` y una versión `.md` de cada página (agregando `.md` a la URL).
- No hay `llms-full.txt`, ni OpenAPI público, ni MCP, ni skills para integradores. Las skills de `fapi-reusables/ai/skills` son todas internas.

**OpenAPI**
- fapi-back genera el documento con `Microsoft.AspNetCore.OpenApi` y Scalar, pero `MapOpenApi` solo se registra en Development (`WebConfigurePipeline`).
- El documento se registra con un `BuildServiceProvider` intermedio (`Infrastructure/DependencyInjection`) y expone también el grupo v5 (`Controllers/V5/ValuesController`).
- En nginx test y live, `/openapi` cae en `location /` (el front).
- Pocos controllers V4 tienen `EndpointSummary` o `EndpointDescription`.

**Superficie pública**
- La colección `fapi-back/postman/collections/Fiscalapi API Reference` tiene 301 requests: 107 pares MÉTODO+ruta y 106 acciones. pdf y xml del portal son una sola acción, `downloads/{downloadToken}/{format}`.
- Todos los pares tienen acción en `WebApi.App/Controllers/V4`.
- En esos mismos controllers hay 52 acciones fuera de la colección:
  - `load`, `all` y `lookup` de DevExtreme;
  - Account (salvo register y login);
  - ProductsForSale, ProductTaxes, `webapp/manifests`;
  - WebhookSecrets y WebhookCliListener.

**Spec generado desde Postman**
- Está en `fapi-back/postman/specs/Fiscalapi Specification/Fiscalapi Specification.yaml`, sin rastrear en git: OpenAPI 3.1, 107 operaciones.
- Le falta para ser contrato:
  - el servidor es `{{baseUrl}}`;
  - los path params van literales (`<invoiceId>`);
  - hay rutas con valores fijos;
  - hay un solo ejemplo por método y ruta;
  - no tiene `components/schemas` de los DTO ni `operationId`.
- Su `info.description` sí es útil.

**Tamaño de las docs**
- 52 páginas, 427 secciones H2 y 2.3 MB de MDX (unos 600k tokens).
- La página `invoices-by-value` pesa 647 KB y su sección "Modelo factura", 156 KB.

**Prueba de búsqueda** (desechable, mismas 14 a 16 consultas de un integrador)
- Sobre las 107 operaciones, MiniSearch 7.2.0 y Orama 3.1.18 con stemmer en español fallan en las consultas fiscales: "complemento de pago", "crear cliente receptor", "estatus ante el SAT", "descarga masiva".
- Los embeddings locales (`Xenova/multilingual-e5-small` q8, transformers.js 4.3.1) descargan 130 MB de modelo, tardan 14 s en cargar y fallan en lo mismo.
- Sobre las secciones H2 de las docs, MiniSearch con stemmer y stopwords en español (`@orama/stemmers`, `@orama/stopwords`) acierta 14 de 16.
- El catálogo de las 107 operaciones (MÉTODO, ruta y resumen) ocupa unos 6.5k caracteres, alrededor de 1,600 tokens.

**Mercado**
- Ningún PAC ni API mexicana de CFDI publica un MCP oficial que timbre.
- Sobre Facturapi hay MCP de la comunidad (`@codespar/mcp-facturapi`, con 20 herramientas).
- Gigstack tiene un MCP de docs y un CLI con `context --json`; Alegra anuncia un MCP de solo lectura.
- Los MCP generados desde OpenAPI que corren en local (Stainless con dynamic tools, @ivotoby/openapi-mcp-server) listan el catálogo completo en vez de buscar. Los que usan embeddings (Speakeasy Gram, el buscador de docs de Stainless) son hosteados.

**npm**
- `@fiscalapi/mcp` no existe (404).
- Los paquetes `fiscalapi` y `fiscalapi-csf` los publica el usuario npm `fiscalapi`.
- El SDK de MCP v2 (`@modelcontextprotocol/server`) se publicó el 2026-07-27 con la spec 2026-07-28.
- Node 20 ya no tiene soporte.
- npm trusted publishing exige un runner hospedado por GitHub.

**Sin medir todavía:** la mezcla de tipos y complementos (MED-01), el embudo de Test (MED-02) y el top de rechazos del PAC (MED-03).

## Requisitos funcionales
- **RF-01 — OpenAPI público.** `GET https://{test,live}.fiscalapi.com/api/openapi/v4.json` responde sin autenticación con exactamente las 100 acciones de D-05. Cada operación tiene `operationId` estable y servidores reales.
  Aceptación: la prueba de equivalencia con la colección pasa y `curl` a ambos ambientes responde 200.
- **RF-02 — Docs por sección.** Cada sección H2 de las docs tiene su versión `.md` propia, generada en el build.
  Aceptación: `curl` a la `.md` de una sección devuelve solo esa sección.
- **RF-03 — Errores de Pagos y Comercio Exterior.** Las docs publican las tablas de errores de Pagos 2.0 y Comercio Exterior 2.0, igual que las de CFDI 4.0, Nómina y Carta Porte.
  Aceptación: las dos rutas `.md` responden 200.
- **RF-04 — Skills.** Las 8 skills y los 3 comandos de D-03 se instalan como plugin en Claude Code, Codex, Cursor y Copilot.
  Aceptación: instalación desde el repo en los 4 hosts.
- **RF-05 — MCP stdio.** `npx -y @fiscalapi/mcp` expone `listar_operaciones`, `obtener_operacion` y `buscar_docs` sin usar red en runtime.
  Aceptación: las 16 consultas de regresión de `buscar_docs` pasan.
- **RF-06 — Evals.** Cada caso CFDI se corre en 3 variantes (sin nada, con skills, con skills más MCP), calificadas por un UUID real en test.
  Aceptación: el reporte de EV-03 incluye la tasa de éxito y los tokens por caso y variante.

## Requisitos no funcionales
- **RNF-01 — Cero mantenimiento adicional (D-02).** Nada hosteado. Todo lo derivado (OpenAPI, `.md` por sección, índice del MCP) se genera solo desde el código o las docs. Las skills enlazan, no copian.
- **RNF-02 — Compatibilidad v4.** Publicar el OpenAPI no cambia ningún contrato: solo agrega metadatos y una ruta de lectura.
- **RNF-03 — Sin exposición de lo interno.** Ninguna ruta Host, solo JWT, InternalKey, `webapp/`, de facturación del dashboard, register o login aparece en el OpenAPI. Lo garantiza la prueba de equivalencia.
- **RNF-04 — Seguridad de llaves.** Las skills y el MCP nunca piden ni guardan llaves live. El MCP no invoca la API (D-07).
- **RNF-05 — Presupuesto de contexto.**
  - `SKILL.md` en menos de 500 líneas.
  - La salida de una herramienta del MCP en menos de unos 10k tokens.
  - `listar_operaciones` completo en menos de unos 3k tokens.
- **RNF-06 — Arranque del MCP.** Menos de 1 s y funcionando sin conexión: el índice va dentro del paquete y no se descarga ningún modelo.
- **RNF-07 — Español.** Skills, herramientas, descripciones y mensajes en español (D-04).

## Métrica norte
- Mediana de minutos entre la creación del owner y su primer `Invoice` timbrado en la BD de Test, por cohorte semanal.
- Porcentaje de cuentas nuevas que timbran en menos de 24 h.

La línea base la fija MED-02. Se mide sin telemetría nueva.

## Preguntas abiertas
- **Q-01 — Marketplaces oficiales.** ¿Se solicita la inclusión en `claude-plugins-official` y en el catálogo curado de Codex, además del marketplace propio del repo?
  - Opciones: (a) solo el marketplace propio; (b) los dos.
  - Recomendación: (a) hasta tener el reporte de EV-03, porque la inclusión se pide con evidencia de calidad.
  - Bloquea: U-04.

## Fuera de alcance
- **MCP remoto u hosteado** (D-02): exige operar un servicio.
- **Sandbox sin "compra"** (D-09): requiere código nuevo en billing. Se revisa con los datos de MED-02.
- **CSD de prueba propios** (D-10): habría que renovarlos al vencer. Se sigue enlazando el ZIP de SW.
- **`llms-full.txt`** (D-15): unos 600k tokens, no le sirve a un agente.
- **Búsqueda semántica con embeddings:** medida sin ganancia (ver Contexto medido).
- **Herramienta `invocar` en el MCP** (D-07).
