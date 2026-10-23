---
name: fiscalapi-nomina
description: Timbra con FiscalAPI un CFDI/Factura de nómina (tipo N, complemento de nómina 1.2), ordinaria o extraordinaria, con los datos del empleado y del empleador por referencias o por valores, el periodo, las percepciones, las deducciones, los otros pagos con el subsidio para el empleo y las incapacidades, sin los rechazos NOM más comunes. Úsala cuando vayas a timbrar recibos de nómina o a registrar los datos laborales de empleados y empleadores. No la uses para diagnosticar un error NOM que ya devolvió la API (usa `fiscalapi-diagnostico`).
---

# CFDI/Factura de nómina (complemento de nómina 1.2)

El CFDI/Factura de nómina (tipo `N`) ampara el pago de sueldos y salarios de un empleador a un empleado con el complemento de nómina 1.2. Es ordinaria cuando corresponde a un periodo de pago habitual y extraordinaria cuando el pago queda fuera de esa periodicidad.

Antes de escribir el cuerpo, lee [Crear factura de nómina](https://docs.fiscalapi.com/invoices-by-value/crear-factura-de-nomina.md) (por referencias: [esta sección](https://docs.fiscalapi.com/invoices-by-reference/crear-factura-de-nomina.md)). El ambiente, la API key y el SDK están en la skill `fiscalapi-integracion`.

## 1. El comprobante

`POST /api/v4/invoices` con:

- `typeCode` `N`, `currencyCode` `MXN`, `exportCode` `01`, `paymentMethodCode` `PUE`, `series`, `date` y `expeditionZipCode`.
- **No mandes** `paymentFormCode` (el CFDI de nómina no lleva forma de pago), `items`, `paymentConditions` ni `exchangeRate`. La API arma el concepto (84111505, ACT, "Pago de nómina") con importe = percepciones + otros pagos y descuento = deducciones.
- **Emisor** (empleador): si es persona física, necesita su CURP (NOM5); una persona moral no la lleva.
- **Receptor** (empleado): RFC de persona física (13 caracteres, NOM8), `taxRegimeCode` `605` (sueldos y salarios, NOM11) y `cfdiUseCode` `CN01` (nómina, NOM12). Mándalos siempre en el cuerpo: con otros valores, el PAC rechaza con esos códigos.

## 2. Datos laborales: por referencias o por valores

- **Por referencias:** registra una vez los [datos de empleado](https://docs.fiscalapi.com/employee-data/crear-datos-de-empleado.md) (`POST /api/v4/people/{personId}/employee`) y de [empleador](https://docs.fiscalapi.com/employer-data/crear-datos-de-empleador.md) (`POST /api/v4/people/{personId}/employer`), y emite con `issuer.id` y `recipient.id`. La CURP sale de la persona ([emisor en nómina](https://docs.fiscalapi.com/issuers/emisor-en-facturas-de-nomina.md), [receptor en nómina](https://docs.fiscalapi.com/recipients/receptor-en-facturas-de-nomina.md)). Cada persona tiene un solo registro de cada tipo: si ya existe, actualízalo con PUT.
- **Por valores:** los mismos datos van en `issuer.employerData` y `recipient.employeeData`, con la `curp` dentro.

Datos del empleado que más fallan:

- Obligatorios: `curp`, `employeeNumber` (1-15 caracteres), `satContractTypeId`, `satTaxRegimeTypeId`, `satPaymentPeriodicityId` y `satPayrollStateId` (estado donde trabaja, por ejemplo `JAL`).
- Contrato `01` a `08` (con relación laboral): el emisor necesita `employerRegistration` (registro patronal) y el empleado `socialSecurityNumber`, `laborRelationStartDate`, `seniority`, `satJobRiskId` e `integratedDailySalary` (NOM42, NOM44); el régimen debe ser `02`, `03` o `04` (NOM57). Contratos `09`, `10` y `99` no llevan registro patronal (NOM43).
- `seniority` es la antigüedad al final del periodo: `P{semanas}W` (por ejemplo `P54W`, sin pasarte de las semanas cumplidas, NOM54) o `P{a}Y{m}M{d}D` exacta (NOM55).
- Los valores de los [catálogos de nómina](https://docs.fiscalapi.com/catalogs/catalogos-de-nomina.md) distinguen acentos y mayúsculas: [sindicalizado](https://docs.fiscalapi.com/catalogs-info/nomina-12/sindicalizado.md) es `Sí` o `No`, no `Si` ni `SÍ`.

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

`otherPayments` va **dentro** de `earnings`; `deductions` y `disabilities` van en la raíz de `payroll`. La API calcula todos los totales (percepciones, gravado, exento, deducciones, impuestos retenidos y otros pagos): no los mandes. El monto de la deducción `002` (ISR) lo calcula tu sistema de nómina y lo mandas ya calculado.

## 4. Subsidio para el empleo

- Con régimen `02` (sueldos), el recibo lleva el otro pago `002` aunque sea en 0 (`amount` 0 y `subsidyCaused` 0), salvo que haya `007` o `008` (NOM105). Otros regímenes no lo llevan (NOM106).
- `amount` (subsidio entregado) no puede pasar de `subsidyCaused` (subsidio causado) (NOM107).
- Si en un periodo se entregó subsidio de más, se descuenta con la deducción `071`.

## 5. Antes de timbrar

1. Receptor con RFC de 13 caracteres, `605` y `CN01`; sin `paymentFormCode` en la raíz.
2. Contrato, régimen y registro patronal congruentes (sección 2).
3. Antigüedad que no exceda el periodo trabajado.
4. Subsidio `002` presente con régimen `02`.

Si el PAC rechaza, busca el código en [Errores Nómina 1.2](https://docs.fiscalapi.com/errors/nomina-12/errores-nomina-1-2.md) o usa la skill `fiscalapi-diagnostico`. Para cancelar, consultar el estatus ante el SAT o descargar el XML y el PDF, usa la skill `fiscalapi-ciclo-de-vida`.
