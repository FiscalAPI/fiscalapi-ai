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

**Mezcla de tipos y complementos** (MED-01)
- Fuente: restore local de producción (`backupset.server_name` = `649fafb1cc93`, corte 2026-10-15 01:00 UTC), facturas con `CreatedAt` del 2025-10-15 al corte. Todas tienen `Uuid`: 60,179 timbres de 100 tenants.
- Volumen y tenants:

  | Tipo o complemento | Facturas | Tenants | Tenant mayor | Skill |
  |---|---|---|---|---|
  | Ingreso (`I`), sin Carta Porte | 38,828 | 97 (con `E`) | 41.5 % de `I` | SK-04 |
  | Egreso (`E`) | 252 | 9 | 37.3 % | SK-04 |
  | Pagos (`P`, fila en `InvoicePayments`) | 6,441 | 27 | 65.7 % | SK-05 |
  | Nómina (`N`, fila en `Payrolls`) | 14,481 | 9 | 82.3 % | SK-07 |
  | Carta Porte (`I` con fila en `CartaPortes`) | 177 | 2 | — | SK-08 |
  | Comercio Exterior (`ComercioExteriores`) | 0 (0 desde siempre) | 0 | — | SK-09 |
  | Información global (`Invoices.GlobalInformation_*`) | 46 | 11 | — | SK-04 |

- Por mes, `I` crece de 51 (2025-10) a 10,263 (2026-09); `P` de 2 a 2,112; `N` sube a 4,636 en 2026-09. Carta Porte aparece en 2026-07 (14 a 75 al mes).
- Información global es una columna nueva (primer registro 2026-10-10), así que 46 subestima su uso. No hay tabla de Impuestos Locales.
- **Orden resultante:** ingreso-egreso, pagos, nómina, carta porte y comercio exterior. Pagos va antes que nómina porque la usan 3 veces más tenants (27 contra 9) y el 82 % de la nómina es de un solo tenant. Coincide con el orden de SK-04 a SK-09 y con EV-01 (ingreso y pagos) y EV-02 (nómina, carta porte y comercio exterior), así que el tablero no cambia.

**Embudo de Test** (MED-02)
- Fuente: restore local de Test (`backupset.server_name` = `83f15e2487c3`, corte 2026-10-15 01:00 UTC). Cohortes semanales (lunes) del 2026-04-13 al corte; la última semana está incompleta.
- Owner = persona con `Id = CreatedBy`. Confirmado = `EmailConfirmed`. Compra de prueba = cualquier fila en `Features` del tenant. Desde 2026-10-05 casi no hay filas `Type = 'Base'` aunque sí compras, así que se cuenta cualquier tipo. Primer timbre = primer `Invoices.CreatedAt` del tenant.
- **Criterio de exclusión:** personas de sistema (`-1`, `0`, `1`) y correos `@fiscalapi.com`, `@mailinator.com`, `rl-test-*`, los que contienen `test`, `prueba` o `e2e` y el correo del equipo. Quedan 397 de 404 owners.
- Embudo de las 26 semanas:

  | Paso | Owners | De los owners | Del paso anterior |
  |---|---|---|---|
  | Creados | 397 | 100 % | — |
  | Con correo confirmado | 378 | 95.2 % | 95.2 % |
  | Con compra de prueba | 164 | 41.3 % | 43.4 % |
  | Con primer timbre | 121 | 30.5 % | 73.8 % |
  | Timbran en menos de 24 h | 61 | 15.4 % | 50.4 % |

- Ningún owner timbró sin compra de prueba ni antes de ella: la compra es la puerta del primer timbre. **215 de 378 confirmados (56.9 %) nunca compran.** La mediana a la compra es de 333 min.
- **Línea base de la métrica norte:** mediana de 1,424 min (23.7 h) de la creación al primer timbre, y 15.4 % de las cuentas nuevas timbra en menos de 24 h.
- Por cohorte, la mediana va de 87 a 28,730 min. Con 5 a 23 owners por semana, la cifra semanal es ruidosa; se sigue la de 4 semanas móviles.

  | Semana | Owners | Confirmados | Compra | Timbran | < 24 h | Mediana (min) |
  |---|---|---|---|---|---|---|
  | 2026-04-13 | 12 | 11 | 4 | 4 | 3 | 618 |
  | 2026-04-20 | 5 | 5 | 1 | 1 | 0 | 5,958 |
  | 2026-04-27 | 18 | 18 | 11 | 9 | 2 | 8,706 |
  | 2026-05-04 | 5 | 5 | 4 | 4 | 3 | 314 |
  | 2026-05-11 | 10 | 10 | 1 | 0 | 0 | — |
  | 2026-05-18 | 20 | 19 | 9 | 6 | 4 | 715 |
  | 2026-05-25 | 14 | 13 | 6 | 3 | 2 | 135 |
  | 2026-06-01 | 12 | 11 | 3 | 2 | 1 | 3,431 |
  | 2026-06-08 | 18 | 17 | 9 | 6 | 2 | 9,147 |
  | 2026-06-15 | 15 | 15 | 4 | 4 | 1 | 28,731 |
  | 2026-06-22 | 11 | 11 | 8 | 8 | 1 | 15,954 |
  | 2026-06-29 | 11 | 10 | 4 | 4 | 2 | 3,078 |
  | 2026-07-06 | 11 | 10 | 3 | 2 | 0 | 15,139 |
  | 2026-07-13 | 17 | 17 | 7 | 5 | 3 | 798 |
  | 2026-07-20 | 14 | 14 | 4 | 4 | 2 | 1,281 |
  | 2026-07-27 | 14 | 14 | 6 | 6 | 4 | 87 |
  | 2026-08-03 | 23 | 22 | 8 | 7 | 2 | 3,853 |
  | 2026-08-10 | 15 | 15 | 8 | 6 | 4 | 888 |
  | 2026-08-17 | 15 | 14 | 8 | 5 | 2 | 2,794 |
  | 2026-08-24 | 15 | 14 | 8 | 4 | 2 | 727 |
  | 2026-08-31 | 20 | 16 | 6 | 5 | 3 | 703 |
  | 2026-09-07 | 18 | 17 | 8 | 4 | 3 | 207 |
  | 2026-09-14 | 18 | 17 | 9 | 5 | 3 | 1,119 |
  | 2026-09-21 | 18 | 17 | 7 | 4 | 2 | 3,728 |
  | 2026-09-28 | 17 | 17 | 7 | 4 | 2 | 1,623 |
  | 2026-10-05 | 17 | 15 | 6 | 5 | 4 | 249 |
  | 2026-10-12 (incompleta) | 14 | 14 | 5 | 4 | 4 | 128 |

**Fuera de alcance:** el top de rechazos del PAC (MED-03), por decisión del usuario (D-20).

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
