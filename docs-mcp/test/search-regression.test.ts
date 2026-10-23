import { describe, expect, it } from 'vitest';

import { DocsIndex } from '../src/docs-index.ts';
import { TOOL_NAMES } from '../src/tools/tool-conventions.ts';
import { dataDirUrl } from './helpers.ts';

const TOP_RESULTS = 3;

const EXPECTED_SECTIONS: ReadonlyArray<readonly [query: string, expectedUrl: RegExp]> = [
  ['cancelar una factura', /\/cancelar-factura\.md$/],
  ['complemento de pago', /crear-factura-de-pago|errores-pagos/],
  ['descargar xml', /obtener-xml-por-id|listar-xmls-por-id|descargar-xml-y-pdf/],
  ['crear cliente receptor', /recipients\/crear-receptor/],
  ['subir certificado csd', /subir-certificados/],
  ['nómina empleado', /employee-data\/|crear-factura-de-nomina/],
  ['webhook', /\/webhooks\//],
  ['saldo de timbres', /\/stamps\//],
  ['estatus ante el sat', /consultar-estado-de-factura|sat-validations\/validar\.md|los-siete-criterios/],
  ['descarga masiva', /download-info|download-requests\//],
  ['lista negra 69b', /sat-validations/],
  ['factura global', /factura-global|global-invoice/],
  ['enviar factura por correo', /enviar-factura-por-correo/],
  ['CFDI40147', /errores-cfdi-4-0/],
  ['objeto de impuesto', /objeto-imp/],
];

const docs = DocsIndex.load(dataDirUrl());

describe(`${TOOL_NAMES.searchDocs} relevance regression`, () => {
  it.each(EXPECTED_SECTIONS)('"%s" returns the expected section in the top 3', (query, expectedUrl) => {
    const topUrls = docs.search(query, TOP_RESULTS).map((result) => result.url);

    expect(topUrls).toEqual(expect.arrayContaining([expect.stringMatching(expectedUrl)]));
  });
});
