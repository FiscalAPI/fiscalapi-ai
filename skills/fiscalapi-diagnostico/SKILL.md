---
name: fiscalapi-diagnostico
description: Diagnostica una respuesta de error de la API de Fiscalapi (CFDI 4.0) y propone la corrección. Distingue una validación de Fiscalapi (400 con propertyName), un rechazo del PAC o del SAT (código como CFDI40147, CRP20101, NOM5 o CP101 en message), un conflicto o rechazo de la llave de idempotencia (409, 422), un error de credenciales, saldo o límite (401, 403, 429) y un error del servidor (5xx), y lleva a la página de docs.fiscalapi.com con la causa. Úsala cuando una llamada a Fiscalapi falla al timbrar, cancelar o consultar. No la uses para diseñar una factura nueva ni para errores de tu propio código que no vienen de la API.
---

# Diagnóstico de errores de Fiscalapi

Toda respuesta de Fiscalapi es un `ApiResponse` con `succeeded`, `message`, `details`, `data`, `httpStatusCode` y `traceIdentifier`, el identificador de la petición que soporte necesita en un 5xx. El modelo completo está en [ApiResponse](https://docs.fiscalapi.com/api-response.md).

Lee la respuesta completa antes de proponer un cambio. No inventes la causa: la tabla o la sección enlazada es la fuente. Si la respuesta viene de un SDK, el `data` de un error no queda en `data`: .NET, Python y Java lo ponen en `ErrorData`, `error_data` o `getErrorData()`, y Node cambia `message` y `details` (ver la referencia de SDK de la skill `fiscalapi-integracion`).

## 1. Árbol de decisión

1. **¿`data` es una lista de fallas con `propertyName`?** Es una **validación de Fiscalapi**: la solicitud no llegó al PAC y no consume timbre.
   - `propertyName` es la ruta del campo en el request (por ejemplo, `Items[0].ItemTaxes[0].TaxCode`). Corrige ese campo; no te guíes por el texto.
   - Modelo de cada falla: [ValidationFailure](https://docs.fiscalapi.com/api-response.md#validationfailure).
   - Mensajes propios del timbrado: [Mensajes de validación del timbrado](https://docs.fiscalapi.com/errors/mensajes-de-validacion-del-timbrado.md).
   - Decimales, longitudes, claves de catálogo y listas con `null`: [Decimales](https://docs.fiscalapi.com/errors/decimales-de-importes-cantidades-y-tasas.md), [Valores que no caben en la factura](https://docs.fiscalapi.com/errors/valores-que-no-caben-en-la-factura.md), [Claves de catálogo del SAT](https://docs.fiscalapi.com/errors/claves-de-catalogo-del-sat.md) y [Elementos null en listas](https://docs.fiscalapi.com/errors/elementos-null-en-listas.md).
   - Con `Idempotency-Key`, un 400 de validación no queda guardado: corrige el campo y reintenta con la misma llave.

2. **¿`message` empieza con un código seguido de ` - `?** Es un **rechazo del PAC o del SAT**: no se timbró y no consume timbre. El código es lo que va antes de ` - `; `details` trae el detalle del PAC. Busca la fila del código en su tabla:

   | El código empieza con | Tabla |
   |---|---|
   | `CFDI40` | [Errores CFDI 4.0](https://docs.fiscalapi.com/errors/cfdi-40.md) |
   | `CRP` | [Errores Pagos 2.0](https://docs.fiscalapi.com/errors/pagos-20.md) |
   | `NOM` | [Errores Nómina 1.2](https://docs.fiscalapi.com/errors/nomina-12.md) |
   | `CP` | [Errores Carta Porte 3.1](https://docs.fiscalapi.com/errors/carta-porte-31.md) |
   | `CCE` | [Errores Comercio Exterior 2.0](https://docs.fiscalapi.com/errors/comercio-exterior-20.md) |
   | `CACFDI` (al cancelar) | [Cancelar factura](https://docs.fiscalapi.com/invoices-by-value/cancelar-factura.md) |

   - Si la tabla no tiene el código, la causa es el texto de `message` y `details`.
   - Corrige el dato y vuelve a timbrar: un rechazo es definitivo para esa solicitud. Con `Idempotency-Key`, el rechazo queda guardado: emite la versión corregida con una llave nueva.

3. **¿Es un 5xx?** Es un **error del servidor**: no se resuelve cambiando los datos. Ver [Errores del servidor](https://docs.fiscalapi.com/errors/errores-del-servidor.md).
   - Si trae en `message` un código seguido de ` - `, no es un error del servidor sino un rechazo del PAC o del SAT: aplica el paso 2.
   - Un 500 al timbrar es un **resultado incierto**: el CFDI pudo quedar timbrado. Con `Idempotency-Key`, ese 500 queda guardado y repetir la misma llave devuelve el mismo 500. Con o sin llave, no emitas de nuevo a ciegas: búscala con [Listar facturas](https://docs.fiscalapi.com/invoices-by-value/listar-facturas.md) y, si no aparece, escribe a soporte con el `traceIdentifier` antes de emitirla con una llave nueva.
   - Un **timeout o un error de red** no es un 5xx del API: la respuesta no llegó. Con `Idempotency-Key`, reintenta con la misma llave y el mismo cuerpo; sin llave, trátalo como el 500 de arriba. En Node, un 500 sin `traceIdentifier` es un timeout del cliente. Reglas en la sección 6 de la skill `fiscalapi-integracion`.

4. **¿Otro 4xx?** Lee `details`:
   - **401:** falta o no es válida la API key o el tenant (`Missing required http X-API-KEY.`, `Invalid API KEY`, `Invalid tenant key`). Revisa las variables de entorno y que la API key sea del mismo ambiente que la URL ([Persona autenticada](https://docs.fiscalapi.com/me.md)).
   - **403:** falta un permiso, la suscripción o el saldo (`Saldo insuficiente. Disponible: n, Requerido: m`). Con `Idempotency-Key`, el 403 queda guardado: después de comprar timbres, reintenta con una llave nueva.
   - **404:** [Recurso no encontrado](https://docs.fiscalapi.com/errors/recurso-no-encontrado.md).
   - **409:** distingue por `details`:
     - Otra petición con la misma `Idempotency-Key` sigue en proceso: espera los segundos de `Retry-After` y repite con la misma llave y el mismo cuerpo.
     - Otra petición modificó el registro entre su lectura y su escritura: vuelve a consultarlo y repite ([Restricciones de los datos y concurrencia](https://docs.fiscalapi.com/errors/errores-del-servidor.md)).
     - Un ticket con la misma serie y folio ya está activo: no lo repitas; el existente va en `data.existingTicketId` ([Crear ticket](https://docs.fiscalapi.com/tickets/crear-ticket.md)).
   - **422:** distingue por `details`:
     - El SAT rechazó una cancelación (`SAT <código>: <descripción>`; `message` es el genérico y el acuse va en `data`): la factura no cambió de estado. Ver [Cancelar factura](https://docs.fiscalapi.com/invoices-by-value/cancelar-factura.md) y [qué hacer ante un rechazo](https://docs.fiscalapi.com/cancel-invoice-tutorial/que-hacer-ante-un-rechazo.md).
     - La `Idempotency-Key` ya se usó con otra petición: el reintento no mandó los mismos bytes (cuerpo, ruta, query o `X-TIME-ZONE`). Si es la misma operación, reenvía el cuerpo original; si es otra operación, usa una llave nueva ([Solicitudes idempotentes](https://docs.fiscalapi.com/idempotent-requests.md)).
     - Un ticket con un total que no cuadra o una fecha de pago futura ([Crear ticket](https://docs.fiscalapi.com/tickets/crear-ticket.md)).
   - **429:** se excedió el [límite de solicitudes](https://docs.fiscalapi.com/errors/limite-de-solicitudes.md): espera los segundos de `Retry-After` y repite.
   - **400 sin lista de fallas en `data`:** por ejemplo, una restricción de los datos (registro duplicado, relacionado inexistente, dato obligatorio faltante, longitud o formato inválido; tabla en [Restricciones de los datos y concurrencia](https://docs.fiscalapi.com/errors/errores-del-servidor.md)), un `Idempotency-Key` con formato inválido o un certificado ilegible ([Certificados y llaves privadas](https://docs.fiscalapi.com/errors/certificados-y-llaves-privadas.md)). El motivo va en `details`.
   - **413:** el cuerpo excede el tamaño máximo. **425:** el paquete de una descarga masiva todavía no está listo; espera `Retry-After`.

## 2. Cómo responder

- Di de qué tipo es el error (validación, rechazo del PAC, error del servidor, timeout u otro 4xx) y por qué.
- Cita el campo (`propertyName`) o el código, y la fila o sección enlazada que explica la causa.
- Di si se puede reintentar y con qué llave: la misma (timeout, error de red, 409 en proceso, 400 de validación corregido) o una nueva (otra operación, un rechazo del PAC corregido, o tras resolver un 403).
- Propón el cambio concreto en el código del proyecto.
- Nunca pidas ni escribas una API key de producción: la API key va en variables de entorno.
