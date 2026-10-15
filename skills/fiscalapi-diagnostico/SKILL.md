---
name: fiscalapi-diagnostico
description: Diagnostica una respuesta de error de la API de FiscalAPI (CFDI 4.0) y propone la corrección. Distingue una validación de FiscalAPI (400 con propertyName), un rechazo del PAC o del SAT (código como CFDI40147, CRP20101, NOM5 o CP101 en message) y un error del servidor (5xx), y lleva a la página de docs.fiscalapi.com con la causa. Úsala cuando una llamada a FiscalAPI falla al timbrar, cancelar o consultar. No la uses para diseñar una factura nueva ni para errores de tu propio código que no vienen de la API.
---

# Diagnóstico de errores de FiscalAPI

Toda respuesta de FiscalAPI es un `ApiResponse` con `succeeded`, `message`, `details`, `data`, `httpStatusCode` y, en los errores del servidor, `traceIdentifier`. El modelo completo está en [ApiResponse](https://docs.fiscalapi.com/api-response.md).

Lee la respuesta completa antes de proponer un cambio. No inventes la causa: la tabla o la sección enlazada es la fuente.

## Árbol de decisión

1. **¿`data` es una lista de fallas con `propertyName`?** Es una **validación de FiscalAPI**: la solicitud no llegó al PAC y no se cobró timbre.
   - `propertyName` es la ruta del campo en el request (por ejemplo, `Items[0].ItemTaxes[0].TaxCode`). Corrige ese campo; no te guíes por el texto.
   - Modelo de cada falla: [ValidationFailure](https://docs.fiscalapi.com/api-response.md#validationfailure).
   - Mensajes propios del timbrado: [Mensajes de validación del timbrado](https://docs.fiscalapi.com/errors.md#mensajes-de-validacion-del-timbrado).
   - Decimales, longitudes y claves de catálogo: [Decimales](https://docs.fiscalapi.com/errors.md#decimales-de-importes-cantidades-y-tasas), [Valores que no caben en la factura](https://docs.fiscalapi.com/errors.md#valores-que-no-caben-en-la-factura) y [Claves de catálogo del SAT](https://docs.fiscalapi.com/errors.md#claves-de-catalogo-del-sat).

2. **¿`message` empieza con un código seguido de ` - ` y `data` es `null`?** Es un **rechazo del PAC o del SAT**: no se timbró y el timbre se reembolsó. El código es lo que va antes de ` - `; `details` trae el detalle del PAC. Busca la fila del código en su tabla:

   | El código empieza con | Tabla |
   |---|---|
   | `CFDI40` | [Errores CFDI 4.0](https://docs.fiscalapi.com/errors/cfdi-40.md) |
   | `CRP` | [Errores Pagos 2.0](https://docs.fiscalapi.com/errors/pagos-20.md) |
   | `NOM` | [Errores Nómina 1.2](https://docs.fiscalapi.com/errors/nomina-12.md) |
   | `CP` | [Errores Carta Porte 3.1](https://docs.fiscalapi.com/errors/carta-porte-31.md) |
   | `CCE` | Comercio Exterior aún no tiene tabla publicada: usa el texto de `message` y `details`, y las reglas de Comercio Exterior en [Mensajes de validación del timbrado](https://docs.fiscalapi.com/errors.md#mensajes-de-validacion-del-timbrado). |

   - Si la tabla no tiene el código, o es un rechazo de cancelación (por ejemplo, `CACFDI33`), la causa es el texto de `message` y `details`. Revisa [Cancelar factura](https://docs.fiscalapi.com/invoices-by-value#cancelar-factura) si fallaba una cancelación.
   - Corrige el dato y vuelve a timbrar: un rechazo es definitivo para esa solicitud.

3. **¿Es un 5xx?** Es un **error del servidor**: no se resuelve cambiando los datos. Ver [Errores del servidor](https://docs.fiscalapi.com/errors.md#errores-del-servidor).
   - Un 500 al timbrar puede ser un **resultado incierto**: el CFDI pudo quedar timbrado. **No repitas la factura de inmediato**: búscala con [Listar facturas](https://docs.fiscalapi.com/invoices-by-value#listar-facturas) y, si no aparece, escribe a soporte con el `traceIdentifier`.
   - Un 5xx con un código de rechazo en `message` sigue la regla del paso 2.

4. **¿Otro 4xx?** Lee `details`:
   - 404: [Recurso no encontrado](https://docs.fiscalapi.com/errors.md#recurso-no-encontrado).
   - 400 sin fallas de validación o 409: las restricciones de los datos y la concurrencia están en [Errores del servidor](https://docs.fiscalapi.com/errors.md#errores-del-servidor).
   - Certificados y llaves privadas: [Certificados y llaves privadas](https://docs.fiscalapi.com/errors.md#certificados-y-llaves-privadas).

## Cómo responder

- Di de qué tipo es el error (validación, rechazo del PAC, error del servidor u otro 4xx) y por qué.
- Cita el campo (`propertyName`) o el código, y la fila o sección enlazada que explica la causa.
- Propón el cambio concreto en el código del integrador.
- Nunca pidas ni escribas una API key de producción: las llaves van en variables de entorno.
