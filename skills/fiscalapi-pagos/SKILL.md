---
name: fiscalapi-pagos
description: Emite con FiscalAPI el complemento de recepción de pagos 2.0 (REP, factura de pago tipo P) de una factura PPD, en una o varias parcialidades. Decide cuándo hace falta (PUE frente a PPD), arma complement.payment con saldo anterior, importe pagado y saldo insoluto, el número de parcialidad, el tipo de cambio y la equivalencia cuando las monedas difieren, y los impuestos del documento pagado. Úsala cuando un cliente pague una factura emitida con método PPD o cuando te pidan un complemento de pago o un REP. Para la factura original usa fiscalapi-ingreso-egreso; para un error CRP que ya devolvió la API, fiscalapi-diagnostico.
---

# Complemento de pago (Pagos 2.0)

Una factura **PUE** ya está pagada: no lleva complemento. Una factura **PPD** (forma de pago `99`) se paga después, y cada pago se registra con un CFDI de tipo `P` que relaciona el UUID de la factura. El SAT pide emitirlo a más tardar el día 5 del mes siguiente al pago.

Antes de escribir el cuerpo, lee [Crear factura de pago](https://docs.fiscalapi.com/invoices-by-value/crear-factura-de-pago.md) (por referencias: [esta sección](https://docs.fiscalapi.com/invoices-by-reference/crear-factura-de-pago.md)). Los campos de `complement.payment` están en [Modelo factura](https://docs.fiscalapi.com/invoices-by-value/modelo-factura.md). El ambiente y el SDK, en la skill `fiscalapi-integracion`.

## 1. El comprobante de pago

Se emite con `POST /api/v4/invoices`. Manda:

- `typeCode` `P`, `currencyCode` `XXX` (cualquier otra responde 400), `exchangeRate` 1 u omitido, `exportCode` `01`, `series`, `date`, `expeditionZipCode`, `issuer` y `recipient` (el mismo receptor de la factura).
- `complement.payment` con el pago (sección 2).

**No mandes** `paymentFormCode`, `paymentMethodCode` ni `paymentConditions` en la raíz: el CFDI de pago no los lleva y el PAC lo rechaza (CRP20105, CRP20106, CRP20107). La forma de pago va dentro de `complement.payment`. Tampoco mandes `items`: FiscalAPI arma solo el concepto (84111506, ACT, "Pago", importe 0), fija el uso CFDI en `CP01` y calcula los totales del pago.

## 2. El pago y los documentos que paga

`complement.payment`:

| Campo | Qué es |
|---|---|
| `paymentDate` | Fecha y hora en que se recibió el pago (sin zona, `yyyy-MM-ddTHH:mm:ss`) |
| `paymentFormCode` | Forma real del pago (`03` transferencia, `01` efectivo, ...); nunca `99` (CRP20212) |
| `currencyCode` y `exchangeRate` | Moneda del pago y su tipo de cambio: con `MXN` exactamente 1 |
| `amount` | Monto total recibido |
| `paidInvoices` | Una entrada por factura que cubre este pago |

Cada `paidInvoices[]`:

- `uuid` de la factura PPD; `series` y `number` son opcionales.
- `currencyCode` de la factura y `equivalence`: 1 si es la misma moneda del pago; si no, las unidades de la moneda de la factura por cada unidad de la del pago.
- `partialityNumber`: 1 en el primer pago de esa factura y consecutivo en los siguientes.
- `previousBalance`: en la primera parcialidad, el total de la factura; después, el saldo insoluto del pago anterior. Mayor que 0.
- `paymentAmount`: lo que este pago abona a esa factura. Mayor que 0. (La tabla de las docs lo llama `amount`; el campo real es `paymentAmount`.)
- `remainingBalance` = `previousBalance` − `paymentAmount`, nunca negativo (CRP20244).
- `taxObjectCode` y `paidInvoiceTaxes`: ver la sección 3.

**FiscalAPI no busca la factura ni calcula saldos.** Copia `uuid`, `partialityNumber` y los saldos tal como llegan, y el PAC rechaza lo incongruente. El sistema del integrador lleva el saldo y el número de parcialidad de cada factura PPD: guárdalos al emitir cada pago. Con la misma moneda, la suma de los `paymentAmount` no puede pasar de `amount` (CRP20217).

## 3. Impuestos del documento pagado

- `taxObjectCode` repite el objeto de impuesto de la factura: con `02`, `paidInvoiceTaxes` es obligatorio (CRP20246); con `01`, `03` o `04` no debe venir (CRP20247).
- Cada impuesto lleva `base`, `taxCode`, `taxTypeCode`, `taxRate` y `taxFlagCode` como en la factura. La `base` es **proporcional a lo pagado**: si se paga la mitad de una factura de 1,000 + IVA, la base del IVA es 500. FiscalAPI calcula el importe de cada impuesto y los totales del pago a partir de esa base.
- Decimales: hasta 6 en importes y tasas, 10 en `equivalence`; FiscalAPI no redondea.

## 4. Antes de timbrar, revisa

1. La factura es PPD y tienes su `uuid`, su total y los pagos previos.
2. `partialityNumber` y `previousBalance` siguen al pago anterior; `remainingBalance` cuadra.
3. La forma del pago no es `99` y, si mandas cuentas o RFC bancarios, la forma los admite (CRP20221 a CRP20228).
4. No hay `paymentFormCode` ni `paymentMethodCode` en la raíz.

Si el PAC rechaza, busca el código en [Errores Pagos 2.0](https://docs.fiscalapi.com/errors/pagos-20/errores-pagos-2-0.md) o usa la skill `fiscalapi-diagnostico`. Para consultar el estatus del pago ante el SAT o cancelarlo, usa la skill `fiscalapi-ciclo-de-vida`.
