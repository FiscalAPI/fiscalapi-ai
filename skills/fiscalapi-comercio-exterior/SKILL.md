---
name: fiscalapi-comercio-exterior
description: Emite con FiscalAPI un CFDI de exportación definitiva con complemento Comercio Exterior 2.0. Decide exportación 02, moneda y tipo de cambio, el tipo de cambio USD del DOF, el receptor extranjero (XEXX010101000, NumRegIdTrib, residencia fiscal), la clave de pedimento A1, el Incoterm, los domicilios, y las mercancías con fracción arancelaria, unidad y cantidad de aduana y valor en dólares ligadas a cada concepto. También evita los rechazos CCE más comunes. Úsala cuando vayas a facturar una venta al extranjero o una exportación de mercancías. Para un error CCE que ya devolvió la API, usa fiscalapi-diagnostico.
---

# Comercio Exterior 2.0 (exportación definitiva)

Antes de escribir el cuerpo, lee [Crear factura de comercio exterior](https://docs.fiscalapi.com/invoices-by-value/crear-factura-de-comercio-exterior.md) (por referencias: [esta sección](https://docs.fiscalapi.com/invoices-by-reference/crear-factura-de-comercio-exterior.md)). **No copies la mercancía de su ejemplo cURL**: la factura es de 400 USD y la mercancía declara 23.47 en `valorDolares`, que no cuadra. El ambiente, las llaves y el SDK están en la skill `fiscalapi-integracion`.

## 1. El comprobante

- `typeCode` `I`, `exportCode` `02` (exportación definitiva) y `complement.comercioExterior`. Sin el complemento, `02` lo rechaza el PAC (CCE104). FiscalAPI no exige el `02`: mándalo tú.
- **Moneda:** la de la venta. Con una moneda extranjera manda siempre `exchangeRate` (por ejemplo `currencyCode` `USD` y `exchangeRate` 17.1995): si lo omites, FiscalAPI escribe `TipoCambio` 1.
- **Receptor extranjero:** `tin` `XEXX010101000`, `legalName` real, `foreignTin` (su número de identificación fiscal; con Estados Unidos o Canadá, 9 dígitos), `countryId` (país de residencia, por ejemplo `USA`), `taxRegimeCode` `616`, `cfdiUseCode` `S01` y `zipCode` igual a `expeditionZipCode` (CFDI40149, CFDI40159). Sin `foreignTin` el PAC rechaza (CCE133).
- **Cada concepto** necesita `itemSku`: se escribe como `NoIdentificacion` y es la llave que liga el concepto con su mercancía en el complemento (CCE151, CCE152). Por referencias, el `NoIdentificacion` es el `id` del producto.

## 2. `complement.comercioExterior`

- `claveDePedimentoId` `A1` (exportación definitiva) y `certificadoOrigen` `0` (o `1` con `numCertificadoOrigen`).
- `incotermId`: obligatorio con exportación `02` (CCE120), por ejemplo `FOB`, `CIF` o `EXW`.
- `tipoCambioUSD`: pesos por dólar (sección 3).
- `emisor.domicilio`: `calle`, `estadoId` (clave de 3 letras, por ejemplo `QUE`), `paisId` `MEX`, `codigoPostalId`, y colonia, localidad y municipio de catálogo que correspondan a ese código postal.
- `receptor.domicilio`: `paisId` del receptor, distinto de `MEX` (CCE134). Si el país tiene estados en el catálogo `c_Estado` (Estados Unidos, Canadá), `estado` es su clave, por ejemplo `TX`, no "Texas" (CCE139); en otro país es texto libre. `codigoPostal` sigue el formato de códigos postales del país (CCE140), y municipio y colonia van en texto libre. El `numRegIdTrib` del receptor lo toma FiscalAPI del `foreignTin` del CFDI.
- `mercancias[]`, una por concepto:
  - `noIdentificacion`: igual al `itemSku` del concepto.
  - `fraccionArancelariaId`: la fracción vigente de la tarifa ([catálogos](https://docs.fiscalapi.com/catalogs/catalogos-de-comercio-exterior-2-0.md)).
  - `unidadAduanaId`: la unidad de medida de la tarifa (UMT) de esa fracción (CCE161, CCE167). El catálogo de la API no trae la UMT de cada fracción: tómala de la tarifa oficial o del agente aduanal.
  - `cantidadAduana` y `valorUnitarioAduana`: van juntas con la unidad (CCE165, CCE166).
  - `valorDolares`: el importe del concepto en dólares (sección 3).

FiscalAPI calcula solo `TotalUSD` y no valida la congruencia entre conceptos y mercancías: la valida el PAC.

## 3. Tipo de cambio y valor en dólares

- `tipoCambioUSD` es el tipo de cambio que publica el Banco de México en el DOF el día anterior a la fecha de la factura (o el de adquisición de la moneda); si no coincide, el PAC rechaza (CCE121). FiscalAPI no lo consulta: obtenlo del DOF o de Banxico en tu sistema.
- `valorDolares` de cada mercancía (CCE158, CCE172):
  - factura en USD: el importe del concepto;
  - factura en MXN: importe ÷ `tipoCambioUSD`;
  - otra moneda: importe × `exchangeRate` ÷ `tipoCambioUSD`.

## 4. Catálogos

Por la API de catálogos: `SatClavePedimento`, `SatINCOTERM`, `SatFraccionArancelaria`, `SatUnidadAduana`, `SatMotivoTraslado`, `SatTipoOperacion` y `SatCountries`. El nombre del catálogo distingue mayúsculas. No hay catálogo de códigos postales, y la fracción no trae su unidad: valida esos datos con su fuente oficial.

## 5. Antes de timbrar

1. `exportCode` `02`, complemento presente e `incotermId`.
2. Moneda extranjera con `exchangeRate`; `tipoCambioUSD` del DOF del día anterior.
3. Receptor `XEXX010101000` con `foreignTin`, `countryId`, `616`, `S01` y el código postal de expedición.
4. Cada concepto con `itemSku` igual al `noIdentificacion` de su mercancía, y `valorDolares` calculado con la sección 3.

Si el PAC rechaza, busca el código en [Errores Comercio Exterior 2.0](https://docs.fiscalapi.com/errors/comercio-exterior-20/errores-comercio-exterior-2-0.md) o usa la skill `fiscalapi-diagnostico`. Para consultar el estatus o cancelar, usa `fiscalapi-ciclo-de-vida`.
