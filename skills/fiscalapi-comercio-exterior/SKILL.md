---
name: fiscalapi-comercio-exterior
description: Timbra con FiscalAPI un CFDI/Factura de comercio exterior (complemento Comercio Exterior 2.0, exportación definitiva) con exportación 02, moneda y tipo de cambio USD del DOF, receptor extranjero, clave de pedimento A1, Incoterm, domicilios y mercancías con fracción arancelaria, unidad de aduana y valor en dólares por concepto, sin los rechazos CCE más comunes. Úsala cuando vayas a facturar una venta al extranjero o una exportación de mercancías. No la uses para diagnosticar un error CCE que ya devolvió la API (usa `fiscalapi-diagnostico`).
---

# CFDI/Factura de comercio exterior (complemento Comercio Exterior 2.0, exportación definitiva)

El CFDI/Factura de comercio exterior es una factura de ingreso con el complemento Comercio Exterior 2.0 que ampara la exportación definitiva de mercancías a un receptor en el extranjero. El `valorDolares` de cada mercancía se calcula con el importe de su concepto (sección 3).

Antes de escribir el cuerpo, lee [Crear factura de comercio exterior](https://docs.fiscalapi.com/invoices-by-value/crear-factura-de-comercio-exterior.md) (por referencias: [esta sección](https://docs.fiscalapi.com/invoices-by-reference/crear-factura-de-comercio-exterior.md)). El ambiente, la API key y el SDK están en la skill `fiscalapi-integracion`.

## 1. El comprobante

- `typeCode` `I`, `exportCode` `02` (exportación definitiva) y `complement.comercioExterior`. Manda siempre el `02` junto con el complemento: con `02` y sin complemento, el PAC rechaza (CCE104).
- **Moneda:** la de la venta. Con una moneda extranjera manda siempre `exchangeRate` (por ejemplo `currencyCode` `USD` y `exchangeRate` 17.1995): si lo omites, el CFDI queda con `TipoCambio` 1.
- **Receptor extranjero:** `tin` `XEXX010101000`, `legalName` real, `foreignTin` (su número de identificación fiscal; con Estados Unidos o Canadá, 9 dígitos), `countryId` (país de residencia, por ejemplo `USA`), `taxRegimeCode` `616`, `cfdiUseCode` `S01` y `zipCode` igual a `expeditionZipCode` (CFDI40149, CFDI40159). Sin `foreignTin` el PAC rechaza (CCE133).
- **Cada concepto** necesita `itemSku`: se escribe como `NoIdentificacion` y debe ser igual al `noIdentificacion` de su mercancía en el complemento (CCE151, CCE152). Por referencias, el `NoIdentificacion` es el `id` del producto.

## 2. `complement.comercioExterior`

- `claveDePedimentoId` `A1` (exportación definitiva) y `certificadoOrigen` `0` (o `1` con `numCertificadoOrigen`).
- `incotermId`: obligatorio con exportación `02` (CCE120), por ejemplo `FOB`, `CIF` o `EXW`.
- `tipoCambioUSD`: pesos por dólar (sección 3).
- `emisor.domicilio`: `calle`, `estadoId` (clave de 3 letras, por ejemplo `QUE`), `paisId` `MEX`, `codigoPostalId`, y colonia, localidad y municipio de catálogo que correspondan a ese código postal.
- `receptor.domicilio`: `paisId` del receptor, distinto de `MEX` (CCE134). Si el país tiene estados en el catálogo `c_Estado` (Estados Unidos, Canadá), `estado` es su clave, por ejemplo `TX`, no "Texas" (CCE139); en otro país es texto libre. `codigoPostal` sigue el formato de códigos postales del país (CCE140), y municipio y colonia van en texto libre. El `numRegIdTrib` del receptor lo toma FiscalAPI del `foreignTin` del CFDI.
- `mercancias[]`, una por concepto:
  - `noIdentificacion`: igual al `itemSku` del concepto.
  - `fraccionArancelariaId`: la fracción vigente de la tarifa ([catálogos](https://docs.fiscalapi.com/catalogs/catalogos-de-comercio-exterior-2-0.md)).
  - `unidadAduanaId`: la unidad de medida de la tarifa (UMT) de esa fracción (CCE161, CCE167). Toma la UMT de cada fracción de la tarifa oficial (TIGIE) o de tu agente aduanal.
  - `cantidadAduana` y `valorUnitarioAduana`: van juntas con la unidad (CCE165, CCE166).
  - `valorDolares`: el importe del concepto en dólares (sección 3).

La API calcula `TotalUSD`. Cada mercancía debe corresponder a su concepto en `noIdentificacion` y en valor; si no, el PAC rechaza con los códigos de las secciones 1 y 3.

## 3. Tipo de cambio y valor en dólares

- `tipoCambioUSD` es el tipo de cambio que publica el Banco de México en el DOF el día anterior a la fecha de la factura (o el de adquisición de la moneda); si no coincide, el PAC rechaza (CCE121). Obtén el valor del DOF o de Banxico en tu sistema y mándalo en cada factura.
- `valorDolares` de cada mercancía (CCE158, CCE172):
  - factura en USD: el importe del concepto;
  - factura en MXN: importe entre `tipoCambioUSD`;
  - otra moneda: importe por `exchangeRate` entre `tipoCambioUSD`.

## 4. Catálogos

Por la API de catálogos: `SatClavePedimento`, `SatINCOTERM`, `SatFraccionArancelaria`, `SatUnidadAduana`, `SatMotivoTraslado`, `SatTipoOperacion` y `SatCountries`. El nombre del catálogo distingue mayúsculas. Toma el código postal, la colonia, la localidad y el municipio del emisor de su domicilio fiscal real y comprueba que correspondan entre sí con los catálogos `c_CodigoPostal` y `c_Colonia` del SAT. La UMT de cada fracción sale de la tarifa oficial (sección 2).

## 5. Antes de timbrar

1. `exportCode` `02`, complemento presente e `incotermId`.
2. Moneda extranjera con `exchangeRate`; `tipoCambioUSD` del DOF del día anterior.
3. Receptor `XEXX010101000` con `foreignTin`, `countryId`, `616`, `S01` y el código postal de expedición.
4. Cada concepto con `itemSku` igual al `noIdentificacion` de su mercancía, y `valorDolares` calculado con la sección 3.

Si el PAC rechaza, busca el código en [Errores Comercio Exterior 2.0](https://docs.fiscalapi.com/errors/comercio-exterior-20/errores-comercio-exterior-2-0.md) o usa la skill `fiscalapi-diagnostico`. Para cancelar, consultar el estatus ante el SAT o descargar el XML y el PDF, usa la skill `fiscalapi-ciclo-de-vida`.
