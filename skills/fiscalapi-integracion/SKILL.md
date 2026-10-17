---
name: fiscalapi-integracion
description: Integra FiscalAPI (facturación electrónica CFDI 4.0 en México) en un ERP, POS o SaaS. Elige el SDK según el lenguaje del proyecto, configura el ambiente de pruebas y las llaves (X-API-KEY, X-TENANT-KEY, X-TIME-ZONE), decide entre el modo por valores y por referencias, y lleva a la sección exacta de docs.fiscalapi.com y a la skill de cada tipo de factura. Úsala cuando te pidan integrar FiscalAPI, timbrar o emitir facturas CFDI desde código, o empezar con FiscalAPI desde cero. No la uses para diagnosticar un error que ya devolvió la API (usa fiscalapi-diagnostico).
---

# Integrar FiscalAPI

FiscalAPI es una API REST para emitir CFDI 4.0 y sus complementos, cancelarlos y consultarlos ante el SAT. Esta skill decide cómo integrarla; el detalle de cada endpoint vive en las docs, en copias Markdown por sección (`https://docs.fiscalapi.com/<página>/<sección>.md`). Lee la sección que corresponda antes de escribir el cuerpo de una petición: no lo inventes.

Para timbrar la primera factura de punta a punta en un proyecto vacío, usa el comando `primer-timbre`.

## 1. Ambiente y llaves

- Trabaja siempre en **pruebas**: `https://test.fiscalapi.com`. Producción (`https://live.fiscalapi.com`) es otra cuenta con otras llaves; pasar a producción cambia solo la URL, la API key y el tenant ([Ambientes](https://docs.fiscalapi.com/environments.md)).
- Cada petición lleva `X-API-KEY` y `X-TENANT-KEY` ([Encabezados requeridos](https://docs.fiscalapi.com/authentication/encabezados-http-requeridos.md)) y `X-TIME-ZONE` con una zona IANA, por ejemplo `America/Mexico_City`: las fechas sin zona del JSON se leen y se escriben en esa zona, y si falta se usa `America/Mexico_City`. Los SDK mandan los tres headers.
- Las llaves se leen de variables de entorno (`FISCALAPI_API_URL`, `FISCALAPI_API_KEY`, `FISCALAPI_TENANT`). Nunca las escribas en el código, en un archivo versionado ni en el chat, y nunca uses una llave de producción para probar.

Si el integrador todavía no tiene llaves de pruebas, guíalo por el flujo de [Pasos para comenzar](https://docs.fiscalapi.com/quickstart/pasos-para-comenzar.md): sin suscripción activa y sin timbres no se puede timbrar.

1. Crear la cuenta en `https://test.fiscalapi.com/create-account` y confirmar el correo.
2. [Activar la suscripción de prueba](https://docs.fiscalapi.com/subscription-info/activar-suscripcion-de-prueba.md) y [comprar timbres de prueba](https://docs.fiscalapi.com/subscription-info/activar-timbres-de-prueba.md) con una [tarjeta de prueba](https://docs.fiscalapi.com/testing-data/tarjetas-de-prueba.md). Los pagos se hacen solo desde el dashboard.
3. [Generar la API key](https://docs.fiscalapi.com/credentials-info/generar-una-api-key.md) y copiar el [tenant (TID)](https://docs.fiscalapi.com/credentials-info/obtener-el-tenant.md) del perfil.

## 2. SDK

Usa el SDK oficial del lenguaje del proyecto; el paquete, la creación del cliente y las trampas de cada README están en [references/sdks.md](references/sdks.md). Si el lenguaje no tiene SDK, llama a la API por HTTP con los tres headers.

| El proyecto tiene | SDK |
|---|---|
| `*.csproj`, `*.sln` | .NET: `Fiscalapi` |
| `package.json` | Node: `fiscalapi` |
| `pyproject.toml`, `requirements.txt` | Python: `fiscalapi` |
| `composer.json` | PHP: `fiscalapi/fiscalapi` |
| `pom.xml`, `build.gradle` | Java: `com.fiscalapi:fiscalapi` |

## 3. Por valores o por referencias

Los dos modos usan el mismo `POST /api/v4/invoices` y dan el mismo CFDI ([Diferencias entre modos](https://docs.fiscalapi.com/modes-of-operation/diferencias-entre-modos-de-operacion.md)).

- **Por valores:** el cuerpo lleva todos los datos del emisor, del receptor y de los conceptos, incluidos los certificados CSD del emisor en base64 (`taxCredentials`). No hay que registrar nada antes. Conviene para la primera prueba y cuando el sistema del integrador ya guarda esos datos.
- **Por referencias:** el cuerpo lleva los `id` de personas y productos ya registrados en FiscalAPI ([emisores](https://docs.fiscalapi.com/issuers.md), [receptores](https://docs.fiscalapi.com/recipients.md), [productos](https://docs.fiscalapi.com/products.md), [certificados](https://docs.fiscalapi.com/tax-files.md)). Peticiones más chicas y sin certificados en cada llamada; es el modo recomendado para producción.

Las secciones de facturas existen en las dos variantes con la misma ancla: basta cambiar `invoices-by-value` por `invoices-by-reference` en la URL.

## 4. Datos de prueba

- El SAT exige usar sus [personas de prueba](https://docs.fiscalapi.com/testing-data/personas-de-prueba.md) en este ambiente (RFC, razón social y código postal); no inventes RFC.
- Los CSD de prueba vienen de SW ([Certificados de prueba](https://docs.fiscalapi.com/testing-data/certificados-de-prueba.md)); todas las llaves usan la contraseña `12345678a`. Cada persona trae también su FIEL: para timbrar usa el `.cer` y el `.key` de la subcarpeta `CSD_*`, no el `<rfc>.cer` ni el `Claveprivada_FIEL_*.key` de la carpeta de la persona.
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
| Cancelar, PDF, XML, correo o estatus ante el SAT | [cancelar-factura](https://docs.fiscalapi.com/invoices-by-value/cancelar-factura.md), [generar-pdf-por-id](https://docs.fiscalapi.com/invoices-by-value/generar-pdf-por-id.md), [obtener-xml-por-id](https://docs.fiscalapi.com/invoices-by-value/obtener-xml-por-id.md), [enviar-factura-por-correo](https://docs.fiscalapi.com/invoices-by-value/enviar-factura-por-correo.md), [consultar-estado-de-factura](https://docs.fiscalapi.com/invoices-by-value/consultar-estado-de-factura.md) | `fiscalapi-ciclo-de-vida` |
| Un error que ya devolvió la API | [Errores](https://docs.fiscalapi.com/errors.md) | `fiscalapi-diagnostico` |
| Catálogos del SAT | [Catálogos](https://docs.fiscalapi.com/catalogs.md) | — |
| Notificaciones de eventos (webhooks) | [Webhooks](https://docs.fiscalapi.com/webhooks-info.md) | `fiscalapi-ciclo-de-vida` |
| Descarga masiva de CFDI del SAT | [Descarga masiva](https://docs.fiscalapi.com/download-info.md) | — |
| Validaciones ante el SAT (69-B, sellos, estatus) | [Validaciones SAT](https://docs.fiscalapi.com/sat-validations-info.md) | — |
| Autofactura de tickets | [Auto CFDI](https://docs.fiscalapi.com/auto-invoice.md) | — |

## 6. Reglas que no se negocian

- **Un 5xx o un timeout al timbrar no se reintenta.** El CFDI pudo quedar timbrado y un reintento lo duplicaría. `POST /api/v4/invoices` no es idempotente. Registra la respuesta completa (incluido `traceIdentifier`), marca la factura como "resultado incierto" en el sistema del integrador y sigue [Errores del servidor](https://docs.fiscalapi.com/errors/errores-del-servidor.md): búscala con [Listar facturas](https://docs.fiscalapi.com/invoices-by-value/listar-facturas.md) y, si no aparece, escribe a soporte con el `traceIdentifier` antes de volver a emitir.
- **Un 400 con fallas de validación o un rechazo del PAC no consumen timbre**: corrige el dato y vuelve a emitir. Para interpretarlos usa `fiscalapi-diagnostico`.
- **Lee `succeeded`, no solo el código HTTP.** Toda respuesta es un [ApiResponse](https://docs.fiscalapi.com/api-response.md); el CFDI emitido trae su `id` en FiscalAPI y su `uuid` (folio fiscal). Guarda los dos.
- **Las fechas van sin zona** (`yyyy-MM-ddTHH:mm:ss`), en la zona de `X-TIME-ZONE`.
- **Nada en producción** desde un agente: timbrar en `live` es un acto fiscal irreversible.
