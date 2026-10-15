# Integración asistida por IA: docs (fapi-docs y fapi-reusables)

El código va en fapi-docs (y en fapi-reusables solo si cambia el generador), en la rama `feat/ai-integracion` desde `main`. La fila del tablero se cierra con `<repo>@<hash>`.

**Hecho al planear:** fapi-docs tenía en curso la rama `feat/localization`. En `main` hay 0 archivos `content.en.mdx` y 52 `content.mdx`. Antes de DOC-01, revisa si la localización ya llegó a `main`; si llegó, la generación por sección cubre también las páginas en inglés y se carga `fapi-i18n`.

### DOC-01 — Generar `.md` por sección H2 en el build
**Objetivo:** que un agente pueda leer una sola sección (por ejemplo "Crear factura de pago") sin descargar la página completa, que llega a 647 KB.
**Depende de:** —
**Skills:** `fapi-sdk-docs-sync` (docs públicas), `fapi-i18n` (solo si la localización ya está en `main`).
**Modelo sugerido (opcional):** opus. Cambia rutas públicas del sitio.
**Contexto:** D-15, RF-02. Hoy `src/app/md/[[...slug]]/route.js` y los rewrites de `next.config.mjs` sirven `<página>.md`, y `getPageMarkdown` vive en `src/lib/docs.js`.
**Alcance:**
- Ruta de sección `/<página>/<ancla>.md`, con el mismo slug que el ancla H2 que ya genera el sitio. Devuelve el markdown de esa sección, del H2 hasta el siguiente H2.
- Se genera desde los mismos MDX en build (prerender), sin contenido nuevo que mantener.
- `llms.txt` agrega, por página, la lista de sus secciones con su URL `.md`.
**Criterios de aceptación (todos con `→ verificar`):**
- La sección se sirve sola → verificar: `npm run build && npm start` y `curl -s localhost:3000/invoices-by-value/crear-factura-de-pago.md | head`; el contenido empieza en ese H2 y no incluye el siguiente.
- Cada ancla del sitio tiene su `.md` → verificar: un script de build cuenta las secciones de los MDX (427 al planear) y las rutas generadas, y las compara.
- `llms.txt` lista las secciones → verificar: `curl -s localhost:3000/llms.txt | grep -c "\.md"` sube respecto a `main`.
**Pruebas focalizadas:** ninguna (no aplica). La verificación es el conteo del build.
**Fuera de alcance:** `llms-full.txt` (D-15).
**Notas:**
- Hay 378 secciones H2 en 53 páginas y 429 copias `.md`. Las 427 del plan eran una estimación. La guarda `npm run check:markdown` corre como `postbuild` y compara contra las anclas del HTML construido. Los H2 de `<Guides />`, `<Resources />` y `<Libraries />` no tienen copia.
- Las secciones de `invoices-by-value` y `invoices-by-reference` (`EXCLUDED_ROUTES`) tienen copia y van en `llms.txt` como `[Página: Sección]`, por decisión del usuario. Como robots no se tocó, su `Disallow` por prefijo también bloquea esas 46 copias para los crawlers que respetan robots.
- Antes de fusionar, `es:diff` de localización (`feat/localization`) va a marcar `/llms.txt` y las `.md` nuevas: declara la diferencia en `scripts/i18n/es-allowed.json`.

### DOC-02 — Generar la página de errores de Pagos
**Objetivo:** que `fiscalapi-diagnostico` y `explicar-error` puedan enlazar los errores `CRP*`, igual que hoy enlazan los de CFDI 4.0, Nómina y Carta Porte. Comercio Exterior pasó a DOC-04.
**Depende de:** —
**Skills:** `fapi-cfdi-rules`, `fapi-sdk-docs-sync`.
**Modelo sugerido (opcional):** haiku. Corre el generador existente.
**Contexto:** RF-03. Las páginas actuales salen de `fapi-reusables/scripts/sat-docs-md-errors-generator/app.py` sobre las matrices de `fapi-reusables/sat-docs`. Ya existen `sat-docs/pagos` y `sat-docs/comercio-exterior`.
**Alcance:**
- Correr el generador con la matriz de Pagos 2.0 y crear la página `errors/pagos-20` con el mismo formato que `errors/nomina-12`.
- Agregarlas a la navegación y a `llms.txt`.
- Si el generador necesita un cambio, va en fapi-reusables en su propio commit.
**Criterios de aceptación (todos con `→ verificar`):**
- La página responde en `.md` → verificar: `curl -s localhost:3100/errors/pagos-20.md | grep -c "CRP"` mayor que 0.
- El número de códigos coincide con la matriz del SAT → verificar: conteo de filas de la matriz contra el conteo en la página.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** traducir los mensajes del SAT.
**Notas:**
- Comercio Exterior pasó a DOC-04: `sat-docs/comercio-exterior` no trae su matriz de errores. Las páginas de errores actuales se editaron a mano después de generarse, así que `pagos-20` toma la estructura de `nomina-12` y solo la tabla sale del generador.
- El generador se corrió con la salida en el scratchpad: fapi-reusables está en `feat/auto-invoice` con cambios propios. 103 códigos CRP en la matriz y en la página. El repo fapi-docs tiene `user.name` local "Fiscalapi": se fija el autor mendozagit al hacer commit.

### DOC-03 — Corregir el enlace del SDK de Node en `llms.txt`
**Objetivo:** que los agentes lleguen al repo real del SDK de Node.
**Depende de:** —
**Skills:** `fapi-sdk-docs-sync`.
**Modelo sugerido (opcional):** haiku.
**Contexto:** `src/app/llms.txt/route.js` enlaza `github.com/FiscalAPI/fiscalapi-js`, y el repo real es `fiscalapi-node`.
**Alcance:** cambiar el enlace y hacer grep de `fiscalapi-js` en todo fapi-docs por si aparece en otro lugar.
**Criterios de aceptación (todos con `→ verificar`):**
- No queda ningún `fiscalapi-js` → verificar: `grep -rn "fiscalapi-js" src` sin resultados.
- El enlace nuevo existe → verificar: `gh repo view FiscalAPI/fiscalapi-node --json name`.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** —
**Notas:**
- También estaba en `src/components/Libraries.jsx` (la tarjeta del SDK en el sitio). `fiscalapi-js` es el nombre anterior del repo y GitHub redirige; los otros 4 SDK resuelven con su nombre.

### DOC-04 — Generar la página de errores de Comercio Exterior
**Objetivo:** que `fiscalapi-diagnostico` y `explicar-error` puedan enlazar los errores `CCE*`, como DOC-02 hizo con los `CRP*`.
**Depende de:** —
**Skills:** `fapi-cfdi-rules`, `fapi-sdk-docs-sync`.
**Modelo sugerido (opcional):** haiku. Corre el generador existente.
**Contexto:** RF-03. Se separó de DOC-02: `fapi-reusables/sat-docs/comercio-exterior` no trae la matriz de errores (solo `Catalogos_Comercio_Exterior.xlsx` y las guías, sin ningún código `CCE###`). MED-01 midió 0 facturas de Comercio Exterior en producción.
**Alcance:** agregar la matriz oficial del SAT a `sat-docs/comercio-exterior/catalogs` (commit propio en fapi-reusables) y crear `errors/comercio-exterior-20` como DOC-02 creó `errors/pagos-20`, con su entrada en la navegación y en la tabla de `errors`.
**Criterios de aceptación (todos con `→ verificar`):**
- La página responde en `.md` → verificar: `curl -s localhost:3100/errors/comercio-exterior-20.md | grep -c "CCE"` mayor que 0.
- El número de códigos coincide con la matriz → verificar: conteo de códigos `CCE` únicos de la matriz contra los de la página.
**Pruebas focalizadas:** ninguna (no aplica).
**Fuera de alcance:** traducir los mensajes del SAT.
**Notas:**
- El usuario agregó la matriz 2.0 Rev A (2026-10-15): `fapi-reusables/sat-docs/comercio-exterior/catalogs/Matriz_de_Errores_CCE_v2_0_r_A_76f1e17af8.xls`, sin rastrear en el working tree de fapi-reusables (rama `feat/auto-invoice`); se versiona en `feat/ai-integracion` desde `main`.
