---
name: fiscalapi-nomina
description: Emite con FiscalAPI un recibo de nómina CFDI 4.0 con complemento de nómina 1.2 (factura tipo N), ordinaria o extraordinaria. Decide los datos del empleado y del empleador (por referencias en la persona o por valores en el request), el tipo de nómina, el periodo y los días pagados, las percepciones, las deducciones (ISR, IMSS), los otros pagos con el subsidio para el empleo y las incapacidades, y evita los rechazos NOM más comunes. Úsala cuando vayas a timbrar nómina o recibos de pago de sueldos, o a cargar los datos laborales de empleados y empleadores. Para un error NOM que ya devolvió la API, usa fiscalapi-diagnostico.
---

# Recibo de nómina 1.2

Antes de escribir el cuerpo, lee [Crear factura de nómina](https://docs.fiscalapi.com/invoices-by-value/crear-factura-de-nomina.md) (por referencias: [esta sección](https://docs.fiscalapi.com/invoices-by-reference/crear-factura-de-nomina.md)). El ambiente, las llaves y el SDK están en la skill `fiscalapi-integracion`. Ojo con los ejemplos de C# y Python de esa página: usan un receptor 601/G01 y `PaymentFormCode`, que la nómina no admite; sigue esta skill.

## 1. El comprobante

`POST /api/v4/invoices` con:

- `typeCode` `N`, `currencyCode` `MXN`, `exportCode` `01`, `paymentMethodCode` `PUE`, `series`, `date` y `expeditionZipCode`.
- **No mandes** `paymentFormCode` (el CFDI de nómina no lleva forma de pago y FiscalAPI lo copiaría al XML), `items`, `paymentConditions` ni `exchangeRate`. FiscalAPI arma solo el concepto (84111505, ACT, "Pago de nómina") con importe = percepciones + otros pagos y descuento = deducciones.
- **Emisor** (empleador): si es persona física, necesita su CURP (NOM5); una persona moral no la lleva.
- **Receptor** (empleado): RFC de persona física (13 caracteres, NOM8), `taxRegimeCode` `605` (sueldos y salarios, NOM11) y `cfdiUseCode` `CN01` (nómina, NOM12). FiscalAPI no los fuerza: mándalos.

## 2. Datos laborales: por referencias o por valores

- **Por referencias:** registra una vez los [datos de empleado](https://docs.fiscalapi.com/employee-data/crear-datos-de-empleado.md) (`POST /api/v4/people/{personId}/employee`) y de [empleador](https://docs.fiscalapi.com/employer-data/crear-datos-de-empleador.md) (`POST /api/v4/people/{personId}/employer`), y emite con `issuer.id` y `recipient.id`. La CURP sale de la persona ([emisor en nómina](https://docs.fiscalapi.com/issuers/emisor-en-facturas-de-nomina.md), [receptor en nómina](https://docs.fiscalapi.com/recipients/receptor-en-facturas-de-nomina.md)). Cada persona tiene un solo registro de cada tipo: si ya existe, actualízalo con PUT.
- **Por valores:** los mismos datos van en `issuer.employerData` y `recipient.employeeData`, con la `curp` dentro.

Datos del empleado que más fallan:

- Obligatorios: `curp`, `employeeNumber` (1-15 caracteres), `satContractTypeId`, `satTaxRegimeTypeId`, `satPaymentPeriodicityId` y `satPayrollStateId` (estado donde trabaja, por ejemplo `JAL`).
- Contrato `01` a `08` (con relación laboral): el emisor necesita `employerRegistration` (registro patronal) y el empleado `socialSecurityNumber`, `laborRelationStartDate`, `seniority`, `satJobRiskId` e `integratedDailySalary` (NOM42, NOM44); el régimen debe ser `02`, `03` o `04` (NOM57). Contratos `09`, `10` y `99` no llevan registro patronal (NOM43).
- `seniority` es la antigüedad al final del periodo: `P{semanas}W` (por ejemplo `P54W`, sin pasarte de las semanas cumplidas, NOM54) o `P{a}Y{m}M{d}D` exacta (NOM55).
- Los catálogos de nómina distinguen acentos y mayúsculas: sindicalizado es `Sí` o `No`, no `Si` ni `SÍ` ([catálogos de nómina](https://docs.fiscalapi.com/catalogs-info/nomina-12/sindicalizado.md)).

## 3. `complement.payroll`

| Campo | Qué es |
|---|---|
| `payrollTypeCode` | `O` ordinaria (periodicidad distinta de `99`) o `E` extraordinaria (periodicidad `99`) (NOM33, NOM34) |
| `paymentDate`, `initialPaymentDate`, `finalPaymentDate` | `yyyy-MM-dd`; el inicio no puede ser posterior al fin (NOM35) |
| `daysPaid` | Días pagados del periodo |
| `earnings.earnings[]` | Percepciones: `earningTypeCode` ([tipos](https://docs.fiscalapi.com/catalogs-info/nomina-12/tipo-percepcion.md); `001` sueldos), `code`, `concept`, `taxedAmount`, `exemptAmount` |
| `earnings.otherPayments[]` | Otros pagos: `otherPaymentTypeCode` ([tipos](https://docs.fiscalapi.com/catalogs-info/nomina-12/tipo-otro-pago.md)), `amount`; el subsidio para el empleo (`002`) lleva además `subsidyCaused` |
| `deductions[]` | Deducciones: `deductionTypeCode` ([tipos](https://docs.fiscalapi.com/catalogs-info/nomina-12/tipo-deduccion.md); `001` seguridad social, `002` ISR), `code`, `concept`, `amount` |
| `disabilities[]` | Incapacidades: `disabilityDays`, `disabilityTypeCode`, `monetaryAmount` |

`otherPayments` va **dentro** de `earnings`; `deductions` y `disabilities` van en la raíz de `payroll`. FiscalAPI calcula todos los totales (percepciones, gravado, exento, deducciones, impuestos retenidos y otros pagos): no los mandes. FiscalAPI no calcula el ISR: el monto de la deducción `002` lo calcula el sistema de nómina del integrador.

## 4. Subsidio para el empleo

- Con régimen `02` (sueldos), el recibo lleva el otro pago `002` aunque sea en 0 (`amount` 0 y `subsidyCaused` 0), salvo que haya `007` o `008` (NOM105). Otros regímenes no lo llevan (NOM106).
- `amount` (subsidio entregado) no puede pasar de `subsidyCaused` (subsidio causado) (NOM107).
- Si en un periodo se entregó subsidio de más, se descuenta con la deducción `071`.

## 5. Antes de timbrar

1. Receptor con RFC de 13 caracteres, `605` y `CN01`; sin `paymentFormCode` en la raíz.
2. Contrato, régimen y registro patronal congruentes (sección 2).
3. Antigüedad que no exceda el periodo trabajado.
4. Subsidio `002` presente con régimen `02`.

Si el PAC rechaza, busca el código en [Errores Nómina 1.2](https://docs.fiscalapi.com/errors/nomina-12/errores-nomina-1-2.md) o usa la skill `fiscalapi-diagnostico`. Para consultar el estatus, cancelar o enviar el recibo, usa `fiscalapi-ciclo-de-vida`.
