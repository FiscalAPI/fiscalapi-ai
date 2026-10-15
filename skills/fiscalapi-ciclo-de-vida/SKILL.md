---
name: fiscalapi-ciclo-de-vida
description: Maneja lo que pasa con una factura CFDI de FiscalAPI después de timbrarla. Cubre la cancelación ante el SAT (motivos 01-04, UUID sustituto y aceptación del receptor), el estatus ante el SAT, la descarga del XML y del PDF, el envío por correo y los webhooks (registro, eventos, verificación de la firma, reintentos y pruebas en local con fiscalapi listen). Úsala cuando vayas a cancelar, consultar, descargar o enviar una factura ya emitida, o a recibir eventos de FiscalAPI en tu sistema. Para emitir usa fiscalapi-ingreso-egreso o fiscalapi-pagos; para revisar una integración completa, el comando revisar-integracion.
---

# Después de timbrar

Cada operación tiene su sección en las docs (por valores; cambia `invoices-by-value` por `invoices-by-reference` si emitiste por referencias). Léela antes de escribir el cuerpo. El ambiente, las llaves y el SDK están en la skill `fiscalapi-integracion`.

## 1. Cancelar

`DELETE /api/v4/invoices` ([Cancelar factura](https://docs.fiscalapi.com/invoices-by-value/cancelar-factura.md)).

- **Por referencias:** `id` de la factura en FiscalAPI. Firma con el CSD vigente del emisor guardado; una factura emitida por valores no se cancela por referencias.
- **Por valores:** `invoiceUuid` (el UUID, no el `id`), `tin` del emisor y `taxCredentials` con su `.cer` y su `.key` en base64.
- `cancellationReasonCode` ([motivos](https://docs.fiscalapi.com/catalogs-info/cfdi-40/motivos-de-cancelacion.md)):
  - `01` comprobante emitido con errores con relación: exige `replacementUuid`, el UUID de la factura que la sustituye. Emite primero la sustituta.
  - `02` comprobante emitido con errores sin relación.
  - `03` no se llevó a cabo la operación.
  - `04` operación nominativa relacionada en una factura global.

**La respuesta no confirma la cancelación.** Que el PAC acepte la solicitud (201 o 202 en `invoiceUuids`) solo significa que llegó al SAT: la factura queda en "Cancelando". FiscalAPI consulta al SAT en segundo plano y la deja en "Cancelado" o la regresa a "Vigente" si el receptor la rechaza o no es cancelable. Si el SAT pide la aceptación del receptor, este tiene 3 días hábiles para responder. Entérate del resultado con los webhooks `invoice.canceled` e `invoice.cancellation_rejected`, o consultando el estatus. No marques la factura como cancelada en tu sistema con la respuesta del DELETE.

## 2. Estatus ante el SAT

`POST /api/v4/invoices/status` ([Consultar estado de factura](https://docs.fiscalapi.com/invoices-by-value/consultar-estado-de-factura.md)): por referencias con `id`; por valores con `issuerTin`, `recipientTin`, `invoiceTotal`, `invoiceUuid` y `last8DigitsIssuerSignature`.

La respuesta trae `status` (Vigente, Cancelado o No Encontrado), `cancelableStatus` (sin aceptación, con aceptación o no cancelable) y `cancellationStatus` (en proceso, rechazada, plazo vencido, cancelado) ([modelo de respuesta](https://docs.fiscalapi.com/invoices-by-value/modelo-de-respuesta-a-la-consulta-del-estado-de-una-factura.md)). En el ambiente de pruebas la respuesta es simulada y `details` lo avisa: no sirve para probar lógica que dependa del valor.

## 3. XML, PDF y correo

- XML timbrado: `GET /api/v4/invoices/{id}/xml` ([Obtener XML](https://docs.fiscalapi.com/invoices-by-value/obtener-xml-por-id.md)).
- PDF: `POST /api/v4/invoices/pdf` con `invoiceId` y, opcionales, `base64Logo`, `bandColor` y `fontColor` ([Generar PDF](https://docs.fiscalapi.com/invoices-by-value/generar-pdf-por-id.md)). Para un diseño fijo por RFC, usa [reglas de reporte](https://docs.fiscalapi.com/report-rules-info/como-funcionan-las-reglas-de-reporte.md), que se configuran en el dashboard.
- Correo con el PDF y el XML: `POST /api/v4/invoices/send` con `invoiceId` y `toEmail` ([Enviar factura por correo](https://docs.fiscalapi.com/invoices-by-value/enviar-factura-por-correo.md)). El envío se programa y puede tardar unos minutos.

Los archivos llegan en base64 (`base64File`) con `fileName`. Decodifícalos antes de guardarlos.

## 4. Webhooks

- **Registro:** `POST /api/v4/webhooks` con `url` (https, no localhost), `enabledEvents` (o `*`) y, opcional, `personIds` ([Registrar un webhook](https://docs.fiscalapi.com/webhooks-info/registrar-un-webhook.md)). La respuesta trae el `secret` (`whsec_...`): guárdalo como secreto; con la API key no se vuelve a ver salvo al rotarlo.
- **Eventos:** `invoice.cancellation_requested`, `invoice.canceled`, `invoice.cancellation_rejected`, `download_request.completed`, `download_request.abandoned` y `download_rule.suspended` ([Tipos de evento](https://docs.fiscalapi.com/webhooks-info/tipos-de-evento.md)). Un evento de una factura emitida por valores no trae persona: solo lo reciben los webhooks sin filtro `personIds`.
- **Verifica la firma de cada entrega** antes de procesarla ([Verificar la firma](https://docs.fiscalapi.com/webhooks-info/verificar-la-firma.md)): usa el helper del SDK (`Webhook.verify` y equivalentes) sobre el **cuerpo crudo** de la petición, sin parsearlo antes. La firma es Standard Webhooks (cabeceras `webhook-id`, `webhook-timestamp` y `webhook-signature`, HMAC-SHA256) y se rechaza con más de 5 minutos de diferencia.
- **Entrega al menos una vez y sin orden garantizado:** deduplica por `webhook-id`, responde 2xx rápido, procesa después, y consulta el recurso (`relatedObject`) para conocer su estado actual ([Reintentos](https://docs.fiscalapi.com/webhooks-info/reintentos.md)). Si no respondes 2xx, FiscalAPI reintenta hasta 10 veces en unas 75 horas.
- **Rotación:** al rotar el secreto, el anterior sigue firmando 24 horas y cada entrega lleva las dos firmas ([Rotar el secreto](https://docs.fiscalapi.com/webhooks-info/rotar-el-secreto.md)).
- **En local:** `fiscalapi listen --forward-to http://localhost:<puerto>/<ruta>` recibe los eventos de tu cuenta de pruebas y `fiscalapi trigger <tipo>` dispara uno ([Recibir eventos en tu servidor local](https://docs.fiscalapi.com/webhooks-info/local-testing/recibir-eventos-en-tu-servidor-local.md)). La escucha tiene su propio secreto.

## 5. Fechas

Manda siempre `X-TIME-ZONE`. Sin él, FiscalAPI usa `America/Mexico_City` para leer y escribir las fechas sin zona, y tu sistema puede interpretarlas en otra. El sobre de los eventos de webhook va siempre en UTC con `Z`.
