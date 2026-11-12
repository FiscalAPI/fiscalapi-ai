---
name: fiscalapi-integracion
description: Integra Fiscalapi (facturación electrónica CFDI 4.0 en México) en un ERP, POS o SaaS. Elige el SDK según el lenguaje del proyecto, configura el ambiente de pruebas y los headers X-API-KEY, X-TENANT-KEY y X-TIME-ZONE, decide entre el modo por valores y por referencias, reintenta sin duplicar con Idempotency-Key, y lleva a la sección exacta de docs.fiscalapi.com y a la skill de cada tipo de factura. Úsala cuando te pidan integrar Fiscalapi, timbrar o emitir facturas CFDI desde código, reintentar una emisión, o empezar con Fiscalapi desde cero. No la uses para diagnosticar un error que ya devolvió la API (usa `fiscalapi-diagnostico`).
---

# Integrar Fiscalapi

Fiscalapi es una API REST para emitir CFDI 4.0 y sus complementos, cancelarlos y consultarlos ante el SAT. Esta skill cubre el ambiente, la API key, el SDK, el modo de operación, los reintentos y la sección de docs y la skill que corresponden a cada tipo de factura. El detalle de cada operación vive en las docs, en copias Markdown por sección (`https://docs.fiscalapi.com/<página>/<sección>.md`). Lee la sección que corresponda antes de escribir el cuerpo de una petición: no lo inventes.

Para timbrar la primera factura de punta a punta en un proyecto vacío, usa el comando `primer-timbre`.

## 1. Ambiente y API key

- Trabaja siempre en **pruebas**: `https://test.fiscalapi.com`. Producción (`https://live.fiscalapi.com`) es otra cuenta con otra API key y otro tenant; pasar a producción cambia solo la URL, la API key y el tenant ([Ambientes](https://docs.fiscalapi.com/environments.md)).
- Cada petición lleva `X-API-KEY` y `X-TENANT-KEY` ([Encabezados requeridos](https://docs.fiscalapi.com/authentication/encabezados-http-requeridos.md)) y `X-TIME-ZONE` con una zona IANA, por ejemplo `America/Mexico_City`: las fechas sin zona del JSON se leen y se escriben en esa zona, y si falta se usa `America/Mexico_City`. Los SDK mandan los tres headers.
- La API key y el tenant se leen de variables de entorno (`FISCALAPI_API_URL`, `FISCALAPI_API_KEY`, `FISCALAPI_TENANT_KEY`). Nunca los escribas en el código, en un archivo versionado ni en el chat, y nunca uses una API key de producción para probar.

Si el proyecto todavía no tiene una API key de pruebas, indica los pasos de [Pasos para comenzar](https://docs.fiscalapi.com/quickstart/pasos-para-comenzar.md): sin suscripción activa y sin timbres no se puede timbrar.

1. Crear la cuenta en `https://test.fiscalapi.com/create-account` y confirmar el correo.
2. [Activar la suscripción de prueba](https://docs.fiscalapi.com/subscription-info/activar-suscripcion-de-prueba.md) y [comprar timbres de prueba](https://docs.fiscalapi.com/subscription-info/activar-timbres-de-prueba.md) con una [tarjeta de prueba](https://docs.fiscalapi.com/testing-data/tarjetas-de-prueba.md). El pago de la suscripción y de los timbres se hace desde el dashboard.
3. [Generar la API key](https://docs.fiscalapi.com/credentials-info/generar-una-api-key.md) y copiar el [tenant (TID)](https://docs.fiscalapi.com/credentials-info/obtener-el-tenant.md) del perfil.

Para validar una API key y su tenant antes de operar, y ver sus permisos y saldos, usa `GET /api/v4/me` ([Persona autenticada](https://docs.fiscalapi.com/me.md)): con una credencial inválida responde 401.

## 2. SDK

Usa el SDK oficial del lenguaje del proyecto; el paquete, la creación del cliente, la llave de idempotencia y los detalles de uso de cada uno están en [references/sdks.md](references/sdks.md). Si el lenguaje no tiene SDK, llama a la API por HTTP con los tres headers.

| El proyecto tiene | SDK |
|---|---|
| `*.csproj`, `*.sln` | .NET: `Fiscalapi` |
| `package.json` | Node: `fiscalapi` |
| `pyproject.toml`, `requirements.txt` | Python: `fiscalapi` |
| `composer.json` | PHP: `fiscalapi/fiscalapi` |
| `pom.xml`, `build.gradle` | Java: `com.fiscalapi:fiscalapi` |

## 3. Por valores o por referencias

Los dos modos usan el mismo `POST /api/v4/invoices` y dan el mismo CFDI ([Diferencias entre modos](https://docs.fiscalapi.com/modes-of-operation/diferencias-entre-modos-de-operacion.md)).

- **Por valores:** el cuerpo lleva todos los datos del emisor, del receptor y de los conceptos, incluidos los certificados CSD del emisor en base64 (`taxCredentials`). No hay que registrar nada antes. Conviene para la primera prueba y cuando tu sistema ya guarda esos datos.
- **Por referencias:** el cuerpo lleva los `id` de personas y productos ya registrados en Fiscalapi ([emisores](https://docs.fiscalapi.com/issuers.md), [receptores](https://docs.fiscalapi.com/recipients.md), [productos](https://docs.fiscalapi.com/products.md), [certificados](https://docs.fiscalapi.com/tax-files.md)). Peticiones más pequeñas y sin certificados en cada llamada; es el modo recomendado para producción.

Las secciones de facturas existen en las dos variantes con la misma ancla: basta cambiar `invoices-by-value` por `invoices-by-reference` en la URL.

## 4. Datos de prueba

- El SAT exige usar sus [personas de prueba](https://docs.fiscalapi.com/testing-data/personas-de-prueba.md) en este ambiente (RFC, razón social y código postal), o tus datos fiscales y certificados reales; nunca inventes un RFC.
- Los CSD de prueba están en [Certificados de prueba](https://docs.fiscalapi.com/testing-data/certificados-de-prueba.md); todas las llaves privadas usan la contraseña `12345678a`. Cada persona trae también su FIEL: para timbrar usa el Certificado CSD (.cer) y la Llave privada CSD (.key) de la subcarpeta `CSD_*`, no el Certificado FIEL (.cer) (`<rfc>.cer`) ni la Llave privada FIEL (.key) (`Claveprivada_FIEL_*.key`) de la carpeta de la persona.
- El ejemplo de [Crear factura ingreso por valores](https://docs.fiscalapi.com/invoices-by-value/crear-factura-ingreso.md) usa al emisor `FUNK671228PH6` (régimen 621) y al receptor `EKU9003173C9` (régimen 601, uso G01, CP 42501).

## 5. Qué vas a construir

| Necesidad | Sección (por valores; cambia a `invoices-by-reference` si usas referencias) | Skill |
|---|---|---|
| Factura de ingreso o nota de crédito (egreso) | [crear-factura-ingreso](https://docs.fiscalapi.com/invoices-by-value/crear-factura-ingreso.md), [crear-nota-de-credito](https://docs.fiscalapi.com/invoices-by-value/crear-nota-de-credito.md) | `fiscalapi-ingreso-egreso` |
| Complemento de pago (PPD) | [crear-factura-de-pago](https://docs.fiscalapi.com/invoices-by-value/crear-factura-de-pago.md) | `fiscalapi-pagos` |
| Recibo de nómina | [crear-factura-de-nomina](https://docs.fiscalapi.com/invoices-by-value/crear-factura-de-nomina.md) | `fiscalapi-nomina` |
| Carta porte | [crear-factura-de-carta-porte](https://docs.fiscalapi.com/invoices-by-value/crear-factura-de-carta-porte.md) | `fiscalapi-carta-porte` |
| Comercio exterior | [crear-factura-de-comercio-exterior](https://docs.fiscalapi.com/invoices-by-value/crear-factura-de-comercio-exterior.md) | `fiscalapi-comercio-exterior` |
| Factura global | [crear-factura-global](https://docs.fiscalapi.com/invoices-by-value/crear-factura-global.md) | `fiscalapi-ingreso-egreso` |
| Reintentar sin duplicar facturas, tickets ni transferencias de timbres | [Solicitudes idempotentes](https://docs.fiscalapi.com/idempotent-requests.md) | Esta (sección 6) |
| Cancelar, PDF, XML, correo o estatus ante el SAT | [cancelar-factura](https://docs.fiscalapi.com/invoices-by-value/cancelar-factura.md), [generar-pdf-por-id](https://docs.fiscalapi.com/invoices-by-value/generar-pdf-por-id.md), [obtener-xml-por-id](https://docs.fiscalapi.com/invoices-by-value/obtener-xml-por-id.md), [enviar-factura-por-correo](https://docs.fiscalapi.com/invoices-by-value/enviar-factura-por-correo.md), [consultar-estado-de-factura](https://docs.fiscalapi.com/invoices-by-value/consultar-estado-de-factura.md) | `fiscalapi-ciclo-de-vida` |
| Un error que ya devolvió la API | [Errores](https://docs.fiscalapi.com/errors.md) | `fiscalapi-diagnostico` |
| Catálogos del SAT | [Catálogos](https://docs.fiscalapi.com/catalogs.md) | Ninguna |
| Notificaciones de eventos (webhooks) y pruebas en local | [Webhooks](https://docs.fiscalapi.com/webhooks-info.md), [Pruebas en local](https://docs.fiscalapi.com/webhooks-info/local-testing.md) | `fiscalapi-ciclo-de-vida` |
| Tickets de venta y su factura global | [Tickets](https://docs.fiscalapi.com/tickets.md), [Factura global de tickets](https://docs.fiscalapi.com/global-invoice-tickets.md) | Ninguna |
| Transferir o retirar timbres entre personas | [Timbres](https://docs.fiscalapi.com/stamps.md) | Ninguna |
| Límites de solicitudes (429) | [Límite de solicitudes](https://docs.fiscalapi.com/errors/limite-de-solicitudes.md) | `fiscalapi-diagnostico` |
| Descarga masiva de CFDI del SAT | [Descarga masiva](https://docs.fiscalapi.com/download-info.md) | Ninguna |
| Validaciones ante el SAT (69-B, sellos, estatus) | [Validaciones SAT](https://docs.fiscalapi.com/sat-validations-info.md) | Ninguna |
| Autofactura de tickets | [Auto CFDI](https://docs.fiscalapi.com/auto-invoice.md) | Ninguna |
| Facturar pagos de Stripe sin código | [Stripe App](https://docs.fiscalapi.com/stripe-app.md) | Ninguna |

## 6. Reintentos sin duplicar: `Idempotency-Key`

`POST /api/v4/invoices` (todos los tipos de factura), `POST /api/v4/stamps` y `POST /api/v4/tickets` admiten el encabezado `Idempotency-Key` ([Solicitudes idempotentes](https://docs.fiscalapi.com/idempotent-requests.md)). Con él, un reintento no vuelve a timbrar ni a cobrar: recibe la respuesta de la primera solicitud, con `Idempotent-Replayed: true`.

1. **Genera una llave por operación antes de llamar** (un UUID v4; de 1 a 64 caracteres ASCII visibles, sin espacios ni datos personales) y guárdala junto a la factura en tu sistema. Los SDK la reciben como argumento opcional ([references/sdks.md](references/sdks.md)).
2. **Ante un timeout o un error de red, reintenta con la misma llave y los mismos bytes**: mismo cuerpo, misma ruta y mismo `X-TIME-ZONE`. No vuelvas a armar el cuerpo ni regeneres `date`: un cuerpo distinto con la misma llave responde 422. La solicitud termina en Fiscalapi aunque tu cliente corte la conexión, así que el reintento recibe el resultado real.
3. **Un 409 con la llave** significa que la primera solicitud sigue en proceso: espera los segundos de `Retry-After` y repite igual.
4. **Una respuesta recibida queda guardada 24 horas y se repite tal cual**, incluidos un 403 por saldo insuficiente y un 500. Ante un 500 al timbrar, el resultado es incierto (el CFDI pudo quedar timbrado): no generes otra llave a ciegas. Búscala con [Listar facturas](https://docs.fiscalapi.com/invoices-by-value/listar-facturas.md) (por serie y folio, o por fecha) y, si no aparece, escribe a soporte con el `traceIdentifier` antes de emitirla con una llave nueva. Tras resolver un 403 (por ejemplo, comprar timbres), usa una llave nueva.
5. **Un 400 con fallas de validación no se guarda**: corrige el cuerpo y reintenta con la misma llave. Un rechazo del PAC (código como `CFDI40147 - ...`) sí queda guardado: corrige el dato y emite con una llave nueva.

**Sin `Idempotency-Key`, un 5xx o un timeout al timbrar no se reintenta**: un reintento podría duplicar el CFDI. Concilia como en el punto 4 ([Errores del servidor](https://docs.fiscalapi.com/errors/errores-del-servidor.md)).

## 7. Reglas clave

- **Un 400 con fallas de validación o un rechazo del PAC no consumen timbre**: corrige el dato y vuelve a emitir. Para interpretarlos usa la skill `fiscalapi-diagnostico`.
- **Lee `succeeded`, no solo el código HTTP.** Toda respuesta es un [ApiResponse](https://docs.fiscalapi.com/api-response.md); el CFDI emitido trae su `id` en Fiscalapi y su `uuid` (folio fiscal). Guarda los dos, y registra el `traceIdentifier` de cada respuesta.
- **Las fechas van sin zona** (`yyyy-MM-ddTHH:mm:ss`), en la zona de `X-TIME-ZONE`.
- **Nada en producción** desde un agente: timbrar en producción es un acto fiscal irreversible.
