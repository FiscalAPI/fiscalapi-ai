---
name: fiscalapi-ingreso-egreso
description: Arma con FiscalAPI una factura de ingreso, una nota de crédito (egreso) o una factura global CFDI 4.0 sin rechazos del SAT. Decide régimen fiscal y uso CFDI del receptor, objeto de impuesto e impuestos del concepto, método y forma de pago (PUE o PPD), la relación de la nota de crédito y la información global de público en general, y busca las claves del SAT con la API de catálogos. Úsala cuando vayas a emitir o corregir una factura de ingreso, egreso o global. Para el complemento de pago usa fiscalapi-pagos; para un error que ya devolvió la API, fiscalapi-diagnostico.
---

# Ingreso, nota de crédito y factura global

Las tres se emiten con `POST /api/v4/invoices`; cambian `typeCode`, el receptor, `relatedInvoices` y `globalInformation`. Antes de escribir el cuerpo, lee la sección del caso (por valores; cambia `invoices-by-value` por `invoices-by-reference` si usas referencias):

| Caso | Sección |
|---|---|
| Factura de ingreso | [Crear factura ingreso](https://docs.fiscalapi.com/invoices-by-value/crear-factura-ingreso.md) |
| Nota de crédito (egreso) | [Crear nota de crédito](https://docs.fiscalapi.com/invoices-by-value/crear-nota-de-credito.md) |
| Factura global (público en general) | [Crear factura global](https://docs.fiscalapi.com/invoices-by-value/crear-factura-global.md) y [Aspectos clave de la factura global](https://docs.fiscalapi.com/global-invoice-info/aspectos-clave-de-la-factura-global.md) |
| Todos los campos | [Modelo factura](https://docs.fiscalapi.com/invoices-by-value/modelo-factura.md) |

El ambiente, las llaves y el SDK están en la skill `fiscalapi-integracion`.

## 1. Claves del SAT: búscalas, no las inventes

Cada `...Code` es una clave de un catálogo del SAT ([equivalencias](https://docs.fiscalapi.com/catalogs/catalogos-de-facturacion.md)). Con la API de pruebas:

- Buscar por descripción (mínimo 4 caracteres): `GET /api/v4/catalogs/{catalogo}/{texto}` ([Buscar en un catálogo](https://docs.fiscalapi.com/catalogs/buscar-en-un-catalogo.md)).
- Confirmar una clave: `GET /api/v4/catalogs/{catalogo}/key/{clave}` ([Obtener registro](https://docs.fiscalapi.com/catalogs/obtener-registro-por-id.md)); 404 si no existe.
- El nombre del catálogo distingue mayúsculas: `SatProductCodes` (producto o servicio), `SatUnitMeasurements` (unidad), `SatTaxRegimes`, `SatCfdiUses`, `SatPaymentForms`, `SatPaymentMethods`, `SatTaxObjects`, `SatPeriodicities`, `SatMonths`, `SatRelationshipTypes`.

Una clave que no existe responde 400 en su campo antes de llegar al PAC ([Claves de catálogo del SAT](https://docs.fiscalapi.com/errors/claves-de-catalogo-del-sat.md)).

## 2. Receptor: régimen fiscal y uso CFDI

1. El tipo de persona sale del RFC: 12 caracteres es persona moral, 13 es física.
2. `recipient.taxRegimeCode` debe aplicar a ese tipo de persona ([regímenes](https://docs.fiscalapi.com/catalogs-info/cfdi-40/regimenes-fiscales.md)): 601 solo moral; 612 y 616 solo física; 626 ambas. Si no, CFDI40158.
3. `recipient.cfdiUseCode` debe aplicar al tipo de persona y admitir el régimen del receptor ([usos de CFDI](https://docs.fiscalapi.com/catalogs-info/cfdi-40/usos-de-cfdi.md)). Si no, CFDI40161. G01 y G03 no admiten 616 ni 605; S01 y CP01 admiten cualquier régimen.
4. `recipient.zipCode` es el código postal del domicilio fiscal del receptor, 5 dígitos, el de su constancia.

FiscalAPI valida 2 y 3 antes del PAC y responde 400 en `Recipient.TaxRegimeCode` o `Recipient.CfdiUseCode` ([Mensajes de validación del timbrado](https://docs.fiscalapi.com/errors/mensajes-de-validacion-del-timbrado.md)). Pide los datos fiscales al cliente; no los deduzcas.

## 3. Conceptos e impuestos

- `itemCode` es la clave de producto o servicio (8 caracteres) y `unitOfMeasurementCode` la de unidad; búscalas en el catálogo. Por valores, `itemSku` es obligatorio.
- `taxObjectCode` ([objeto de impuesto](https://docs.fiscalapi.com/catalogs-info/cfdi-40/objeto-imp.md)):
  - `02` (sí objeto de impuesto) exige al menos un impuesto en `itemTaxes`; sin él, FiscalAPI rechaza el concepto.
  - `01`, `03` y `04` no llevan impuestos: FiscalAPI ignora `itemTaxes` con esos valores.
  - `07` exige IEPS (`003`) y no admite IVA.
- Cada impuesto: `taxCode` (`001` ISR, `002` IVA, `003` IEPS), `taxTypeCode` (`Tasa`, `Cuota` o `Exento`), `taxRate` y `taxFlagCode` (`T` traslado, `R` retención). Una retención no puede ser `Exento`.
- Decimales: `quantity`, `unitPrice`, `discount` y `taxRate` admiten hasta 6; FiscalAPI no redondea ([Decimales](https://docs.fiscalapi.com/errors/decimales-de-importes-cantidades-y-tasas.md)). En JavaScript, redondea antes de enviar: `0.1 + 0.2` llega como `0.30000000000000004` y se rechaza.

## 4. Método y forma de pago

- **PUE** (pago en una sola exhibición): ya se pagó o se paga al emitir. `paymentFormCode` es la forma real (`01` efectivo, `03` transferencia, `04` tarjeta de crédito, ...).
- **PPD** (pago en parcialidades o diferido): todavía no se paga. `paymentFormCode` es `99` (por definir), y cada pago posterior se registra con un complemento de pago (skill `fiscalapi-pagos`). El PAC rechaza PPD con otra forma (CFDI40105) y FiscalAPI no lo valida antes: revísalo tú.
- Catálogos: [formas de pago](https://docs.fiscalapi.com/catalogs-info/cfdi-40/formas-de-pago.md) y [métodos de pago](https://docs.fiscalapi.com/catalogs-info/cfdi-40/metodos-de-pago.md).

## 5. Nota de crédito (egreso)

- `typeCode` `E` y `relatedInvoices: [{ "relationshipTypeCode": "...", "uuid": "<UUID de la factura de ingreso>" }]`; todos los elementos llevan el mismo tipo de relación ([tipos de relación](https://docs.fiscalapi.com/catalogs-info/cfdi-40/tipo-relacion.md)).
  - `01`: descuento o bonificación sobre la factura relacionada.
  - `03`: devolución de mercancía.
  - `07`: aplicación de anticipo (con forma de pago `30`).
- Método `PUE`; la forma de pago es la del reembolso o descuento (`15` condonación si el ingreso aún no se pagó).
- Concepto típico: `itemCode` `84111506` (servicios de facturación), unidad `ACT`, cantidad 1.
- Primero emite y guarda el `uuid` del ingreso: la nota de crédito no existe sin él.

## 6. Factura global (público en general)

- Receptor: `tin` `XAXX010101000`, `legalName` `PUBLICO EN GENERAL`, `taxRegimeCode` `616`, `cfdiUseCode` `S01` y `zipCode` igual a `expeditionZipCode`. Con el RFC genérico, otro régimen da CFDI40159 y otro código postal CFDI40149.
- `globalInformation` es obligatoria en un ingreso a público en general (CFDI40130): `periodicityCode` (`01` diario, `02` semanal, `03` quincenal, `04` mensual, `05` bimestral), `monthCode` y `year` ([periodo de facturación](https://docs.fiscalapi.com/global-invoice-info/periodo-de-facturacion.md)).
  - `year` es el de la fecha de la factura o hasta 5 años antes (CFDI40136).
  - `monthCode` va de `01` a `12`; solo con `05` (bimestral, emisor en régimen 621) va de `13` a `18`. FiscalAPI no valida esta combinación antes del PAC (CFDI40132, CFDI40134, CFDI40135).
- Método `PUE`. Conceptos: `itemCode` `01010101`, unidad `ACT`, cantidad 1, un concepto por venta o ticket con su folio en `itemSku`.
- Si las ventas son tickets de Auto CFDI, usa [Crear factura global de tickets](https://docs.fiscalapi.com/tickets/crear-factura-global-de-tickets.md).

## 7. Después de emitir

Guarda `id` y `uuid`. Para consultar el estatus ante el SAT, cancelar o descargar el PDF y el XML, usa la skill `fiscalapi-ciclo-de-vida`. En el ambiente de pruebas el estatus del SAT se simula.
