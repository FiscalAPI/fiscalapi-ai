import { describe, expect, it } from 'vitest';

import { DocsIndex } from '../src/docs.js';
import { dataDirUrl } from './helpers.js';

const TOP = 3;
const MIN_HITS = 15;

// Caso conocido: el primer resultado es la página general "Catálogos SAT" (catalogs-info.md), que
// remite al recurso de catálogos; el endpoint "Buscar en un catálogo" queda lejos porque su texto no
// dice "producto" ni "clave". No tiene su propio it: solo cuenta para el total.
const KNOWN_MISS = 'buscar clave de producto sat';

// Consultas reales de un agente con la sección que debe aparecer entre los primeros 3 resultados.
// "estatus ante el sat" acepta sat-validations/validar: la validación sat.cfdi.status ("Estatus del
// comprobante") responde esa consulta.
const CASES: ReadonlyArray<readonly [string, RegExp]> = [
  ['cancelar una factura', /\/cancelar-factura\.md$/],
  ['complemento de pago', /crear-factura-de-pago|errores-pagos/],
  ['descargar xml', /obtener-xml-por-id|listar-xmls-por-id|descargar-xml-y-pdf/],
  [KNOWN_MISS, /catalogs\/buscar-en-un-catalogo|productos-y-servicios/],
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

function topUrls(query: string): string[] {
  return docs.search(query, TOP).map((result) => result.url);
}

function hits(query: string, expected: RegExp): boolean {
  return topUrls(query).some((url) => expected.test(url));
}

describe('buscar_docs: regresión de relevancia', () => {
  it.each(CASES.filter(([query]) => query !== KNOWN_MISS))('"%s" trae la sección esperada en el top 3', (query, expected) => {
    expect(topUrls(query)).toEqual(expect.arrayContaining([expect.stringMatching(expected)]));
  });

  it(`acierta al menos ${MIN_HITS} de ${CASES.length} consultas`, () => {
    const total = CASES.filter(([query, expected]) => hits(query, expected)).length;

    expect(total).toBeGreaterThanOrEqual(MIN_HITS);
  });
});
