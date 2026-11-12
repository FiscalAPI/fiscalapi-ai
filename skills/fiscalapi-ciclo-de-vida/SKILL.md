---
name: fiscalapi-ciclo-de-vida
description: Gestiona un CFDI de Fiscalapi después de timbrarlo. Cubre la cancelación ante el SAT (motivos 01-04, UUID sustituto y aceptación del receptor), el estatus ante el SAT, la descarga del XML y el PDF, el envío por correo y los webhooks (registro, eventos, firma, reintentos y pruebas en local con `fiscalapi listen` y `fiscalapi trigger`). Úsala cuando vayas a cancelar, consultar, descargar o enviar una factura ya emitida, o a recibir sus eventos en tu sistema. No la uses para emitir (usa `fiscalapi-ingreso-egreso` o `fiscalapi-pagos`) ni para revisar una integración completa (usa el comando `revisar-integracion`).
---

# Después de timbrar

Cada operación tiene su sección en las docs (por valores; cambia `invoices-by-value` por `invoices-by-reference` si emitiste por referencias). Léela antes de escribir el cuerpo. El ambiente, la API key y el SDK están en la skill `fiscalapi-integracion`.

## 1. Cancelación

`DELETE /api/v4/invoices` ([Cancelar factura](https://docs.fiscalapi.com/invoices-by-value/cancelar-factura.md)).

- **Por referencias** ([esta sección](https://docs.fiscalapi.com/invoices-by-reference/cancelar-factura.md)): `id` de la factura en Fiscalapi. Fiscalapi firma con el CSD vigente más reciente del emisor guardado en sus certificados. Una factura emitida por valores también se cancela así cuando exactamente una persona de tu cuenta tiene su RFC y un CSD vigente; si ninguna o más de una lo cumplen, responde 400: cancélala por valores.
- **Por valores:** `invoiceUuid` (el UUID, no el `id`), `tin` del emisor y `taxCredentials` con el Certificado CSD (.cer) y la Llave privada CSD (.key) en base64.
- `cancellationReasonCode` ([motivos](https://docs.fiscalapi.com/catalogs-info/cfdi-40/motivos-de-cancelacion.md)):
  - `01` comprobante emitido con errores con relación: exige `replacementUuid`, el UUID de la factura que la sustituye. Emite primero la sustituta, relacionando la factura que cancelas con el tipo de relación `04`; si la sustituta no está en tu cuenta, no está vigente o no la relaciona así, responde 400 en `ReplacementUuid`.
  - `02` comprobante emitido con errores sin relación.
  - `03` no se llevó a cabo la operación.
  - `04` operación nominativa relacionada en una factura global.

**Un 200 no confirma la cancelación.** Responde 200 solo cuando el SAT acusa recibo de la solicitud: la factura Vigente pasa a Cancelando y el estatus se actualiza después ([cómo lo gestiona Fiscalapi](https://docs.fiscalapi.com/cancel-invoice-tutorial/como-lo-gestiona-fiscalapi.md)). Entérate del resultado con los webhooks `invoice.canceled` e `invoice.cancellation_rejected`, o consultando el estatus. No marques la factura como cancelada en tu sistema con la respuesta del DELETE. Una factura en Cancelando acepta otra solicitud.

**Un rechazo del SAT responde 422**, con `succeeded` en `false`, `message` genérico, la descripción en `details` (`SAT <código>: <descripción>`) y el acuse con el código por UUID en `data`; la factura no cambia de estado. Un 400 es una validación previa al envío, o un rechazo del PAC con su código (`CACFDI33 - ...`); un 502, una respuesta del PAC sin el código de cancelación del UUID. Qué hacer con cada código: [qué hacer ante un rechazo](https://docs.fiscalapi.com/cancel-invoice-tutorial/que-hacer-ante-un-rechazo.md) y los [estados de la solicitud en el SAT](https://docs.fiscalapi.com/cancel-invoice-tutorial/estados-de-la-solicitud-en-el-sat.md).

## 2. Estatus ante el SAT

`POST /api/v4/invoices/status` ([Consultar estado de factura](https://docs.fiscalapi.com/invoices-by-value/consultar-estado-de-factura.md)): por referencias con `id`; por valores con `issuerTin`, `recipientTin`, `invoiceTotal`, `invoiceUuid` y `last8DigitsIssuerSignature`.

La respuesta trae ([modelo de respuesta](https://docs.fiscalapi.com/invoices-by-value/modelo-de-respuesta-a-la-consulta-del-estado-de-una-factura.md)) estos textos exactos; léelos juntos, porque `Plazo vencido` significa cosas distintas según `status`:

- `status`: `Vigente`, `Cancelado` o `No Encontrado`.
- `cancelableStatus`: `Cancelable sin aceptación`, `Cancelable con aceptación` o `No cancelable`.
- `cancellationStatus`: `En proceso`, `Solicitud rechazada`, `Plazo vencido`, `Cancelado sin aceptación` o `Cancelado con aceptación`; vacío si no hay solicitud.

El SAT no tiene ambiente de pruebas para esta consulta: en pruebas, Fiscalapi responde `Cancelado` si el UUID tiene una solicitud de cancelación aceptada y `Vigente` en otro caso, y lo indica en `details`. No sirve para probar la aceptación del receptor ni los demás valores.

## 3. XML, PDF y correo

- XML timbrado: `GET /api/v4/invoices/{id}/xml` ([Obtener XML](https://docs.fiscalapi.com/invoices-by-value/obtener-xml-por-id.md)).
- PDF: `POST /api/v4/invoices/pdf` con `invoiceId` y, opcionales, `base64Logo`, `bandColor` y `fontColor` ([Generar PDF](https://docs.fiscalapi.com/invoices-by-value/generar-pdf-por-id.md)). Para un diseño fijo por RFC, usa [reglas de reporte](https://docs.fiscalapi.com/report-rules-info/como-funcionan-las-reglas-de-reporte.md), que se configuran en el dashboard.
- Correo con el PDF y el XML: `POST /api/v4/invoices/send` con `invoiceId` y `toEmail` ([Enviar factura por correo](https://docs.fiscalapi.com/invoices-by-value/enviar-factura-por-correo.md)). El envío se programa y puede tardar unos minutos. Tiene [límite de solicitudes](https://docs.fiscalapi.com/errors/limite-de-solicitudes.md): ante un 429, espera `Retry-After`.

Los archivos llegan en base64 (`base64File`) con `fileName`. Decodifícalos antes de guardarlos.

## 4. Webhooks

- **Registro:** `POST /api/v4/webhooks` con `url` (https, no localhost), `enabledEvents` (o `*`) y, opcional, `personIds` ([Registrar un webhook](https://docs.fiscalapi.com/webhooks-info/registrar-un-webhook.md)). La respuesta trae el `secret` (`whsec_...`): guárdalo como secreto al recibirlo; con la API key solo se vuelve a obtener al rotar el secreto del webhook.
- **Eventos:** `invoice.cancellation_requested`, `invoice.canceled`, `invoice.cancellation_rejected`, `download_request.completed`, `download_request.abandoned` y `download_rule.suspended` ([Tipos de evento](https://docs.fiscalapi.com/webhooks-info/tipos-de-evento.md)). Además existe `webhook.test`, que solo llega al probar un webhook y no se suscribe: ignóralo en tu lógica de negocio. Todos los sobres traen `data.reason`: es `null` salvo en `invoice.cancellation_rejected`, donde dice por qué no procedió la cancelación (por ejemplo `rejectedByRecipient`); trata `type` y `reason` como texto libre, porque pueden aparecer valores nuevos ([El evento](https://docs.fiscalapi.com/webhooks-info/el-evento.md)). Un evento de una factura emitida por valores no trae persona: solo lo reciben los webhooks sin filtro `personIds`.
- **Verifica la firma de cada entrega** antes de procesarla: usa el helper del SDK (`Webhook.verify` y equivalentes) sobre el **cuerpo crudo** de la petición, sin parsearlo antes. La firma sigue la especificación Standard Webhooks (cabeceras `webhook-id`, `webhook-timestamp` y `webhook-signature`, HMAC-SHA256), y el helper rechaza una entrega cuyo `webhook-timestamp` se aleja más de 5 minutos de tu reloj ([Verificar la firma](https://docs.fiscalapi.com/webhooks-info/verificar-la-firma.md)).
- **Entrega al menos una vez y sin orden garantizado:** deduplica por `webhook-id`, responde 2xx en menos de 15 segundos, procesa después, y consulta el recurso (`relatedObject`) para conocer su estado actual. Si no respondes 2xx, Fiscalapi reintenta la entrega según su calendario de [Reintentos](https://docs.fiscalapi.com/webhooks-info/reintentos.md). Responder 410 deshabilita el webhook de inmediato, igual que 5 días sin un 2xx ([Deshabilitación y avisos](https://docs.fiscalapi.com/webhooks-info/deshabilitacion-y-avisos.md)).
- **Rotación:** al rotar el secreto, el anterior sigue firmando 24 horas y cada entrega lleva las dos firmas; pasa al helper los dos secretos mientras dure ([Rotar el secreto](https://docs.fiscalapi.com/webhooks-info/rotar-el-secreto.md)).
- **En local:** `fiscalapi listen --forward-to http://localhost:<puerto>/<ruta>` recibe los eventos de tu cuenta de pruebas ([Recibir eventos en tu servidor local](https://docs.fiscalapi.com/webhooks-info/local-testing/recibir-eventos-en-tu-servidor-local.md)); la escucha tiene su propio secreto. `fiscalapi trigger <tipo>` dispara un evento de prueba con un `listen` abierto o con `--webhook <id>`, solo en pruebas; sin `--related-object-id <id>` de un recurso real, el GET de `relatedObject.url` responde 404 ([Disparar un evento de prueba](https://docs.fiscalapi.com/webhooks-info/local-testing/disparar-un-evento-de-prueba.md)).

## 5. Fechas

Manda siempre `X-TIME-ZONE`. Sin él, Fiscalapi usa `America/Mexico_City` para leer y escribir las fechas sin zona de las facturas, y tu sistema puede interpretarlas en otra. Las fechas del sobre de un evento de webhook van siempre en UTC con `Z`, y las de los recursos de webhooks y sus entregas, sin `X-TIME-ZONE`, también ([Fechas y errores](https://docs.fiscalapi.com/webhooks/fechas-y-errores.md)).
