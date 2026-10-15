// Revisa lo que publica el plugin antes de que llegue a un integrador:
// - el frontmatter de cada SKILL.md sigue el estándar de agentskills.io;
// - cada enlace a docs.fiscalapi.com responde 200 y, si lleva ancla, el ancla existe en la página;
// - lo mismo para los enlaces "Docs:" de las descripciones del OpenAPI público (/api/openapi/v4.json), que
//   fapi-back escribe a mano y que un título renombrado en fapi-docs rompería sin que nadie lo note.
// Las skills enlazan las docs en vez de copiarlas (D-03): un enlace roto deja a la skill sin su fuente.
//
// Uso: node scripts/check-skills.mjs [carpeta ...]   (por omisión, skills y commands)
// FISCALAPI_DOCS_ORIGIN=http://localhost:3100 revisa los enlaces contra un build local de fapi-docs, para
// validar secciones que todavía no están publicadas.
// FISCALAPI_OPENAPI_URL=<URL o ruta de un .json> lee el OpenAPI de un back local o de un archivo, para
// validar descripciones que todavía no están en producción.
// Sale con código 1 si hay algún hallazgo.

import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const DOCS_ORIGIN = 'https://docs.fiscalapi.com'
const CHECK_ORIGIN = process.env.FISCALAPI_DOCS_ORIGIN ?? DOCS_ORIGIN
const OPENAPI_SOURCE = process.env.FISCALAPI_OPENAPI_URL ?? 'https://live.fiscalapi.com/api/openapi/v4.json'
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']
const DOCS_URL = /https:\/\/docs\.fiscalapi\.com[^\s)<>"'`\]]*/g
const SKILL_NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/
const MAX_NAME = 64
const MAX_DESCRIPTION = 1024
const MAX_SKILL_LINES = 500

const roots = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ['skills', 'commands']

async function exists(target) {
  return stat(target).then(() => true, () => false)
}

async function markdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return markdownFiles(full)
      return entry.name.endsWith('.md') ? [full] : []
    }),
  )
  return nested.flat()
}

/** Las claves de una línea del frontmatter YAML (`clave: valor`, con o sin comillas). */
function frontmatter(source) {
  const match = source.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return null
  const fields = {}
  for (const line of match[1].split('\n')) {
    const field = line.match(/^([A-Za-z-]+):\s*(.*)$/)
    if (field) fields[field[1]] = field[2].trim().replace(/^(['"])([\s\S]*)\1$/, '$2')
  }
  return fields
}

function skillProblems(file, source) {
  const problems = []
  const folder = path.basename(path.dirname(file))
  const fields = frontmatter(source)
  if (!fields) return [`${file}: falta el frontmatter (--- … ---) al inicio`]

  const { name, description } = fields
  if (!name) problems.push(`${file}: falta 'name'`)
  else {
    if (name !== folder) problems.push(`${file}: 'name' (${name}) no es el nombre de la carpeta (${folder})`)
    if (!SKILL_NAME.test(name) || name.length > MAX_NAME)
      problems.push(`${file}: 'name' debe ser minúsculas, dígitos y guiones, de ${MAX_NAME} caracteres como máximo`)
  }
  if (!description) problems.push(`${file}: falta 'description'`)
  else if (/^[>|]/.test(description))
    problems.push(`${file}: 'description' va en una sola línea (este lector no interpreta bloques YAML > o |)`)
  else if (description.length > MAX_DESCRIPTION)
    problems.push(`${file}: 'description' tiene ${description.length} caracteres (máximo ${MAX_DESCRIPTION})`)

  const lines = source.split('\n').length
  if (lines >= MAX_SKILL_LINES) problems.push(`${file}: tiene ${lines} líneas (debe tener menos de ${MAX_SKILL_LINES})`)
  return problems
}

/** Las anclas de la página HTML: el `id` que el sitio genera para cada H2 y los `<a name>` explícitos. */
async function pageAnchors(pageUrl, cache) {
  if (!cache.has(pageUrl)) {
    cache.set(
      pageUrl,
      fetch(pageUrl).then(async (response) =>
        response.ok ? new Set([...(await response.text()).matchAll(/\s(?:id|name)="([^"]+)"/g)].map((m) => m[1])) : null,
      ),
    )
  }
  return cache.get(pageUrl)
}

async function linkProblems(url, anchorsCache) {
  const [published, anchor] = url.split('#')
  const address = published.replace(DOCS_ORIGIN, CHECK_ORIGIN)
  const response = await fetch(address, { method: 'GET', redirect: 'manual' })
  if (response.status !== 200) return [`${url}: responde ${response.status}`]
  if (!anchor) return []

  // El ancla vive en la página HTML; la copia .md de una página tiene las mismas secciones.
  const anchors = await pageAnchors(address.replace(/\.md$/, ''), anchorsCache)
  if (!anchors) return [`${url}: la página HTML de su ancla no responde`]
  return anchors.has(anchor) ? [] : [`${url}: el ancla #${anchor} no existe`]
}

/** Agrega a `urls` cada enlace a las docs de `text`, recordando dónde aparece (`where`). */
function collectDocsUrls(text, where, urls) {
  for (const [url] of (text ?? '').matchAll(DOCS_URL)) {
    const clean = url.replace(/[.,;:]+$/, '')
    urls.set(clean, [...(urls.get(clean) ?? []), where])
  }
}

async function readOpenApi(source) {
  if (!/^https?:\/\//.test(source)) return JSON.parse(await readFile(source, 'utf8'))
  const response = await fetch(source)
  if (!response.ok) throw new Error(`${source} responde ${response.status}`)
  return response.json()
}

/** Los enlaces a las docs de la descripción del documento y de cada operación, por operationId. */
async function openApiDocsUrls(source) {
  const document = await readOpenApi(source)
  const urls = new Map()
  collectDocsUrls(document.info?.description, 'OpenAPI info.description', urls)
  for (const [route, item] of Object.entries(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = item[method]
      if (operation) collectDocsUrls(operation.description, `OpenAPI ${operation.operationId ?? `${method} ${route}`}`, urls)
    }
  }
  return urls
}

async function main() {
  const files = []
  for (const root of roots) if (await exists(root)) files.push(...(await markdownFiles(root)))

  const problems = []
  const urls = new Map()
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    if (path.basename(file) === 'SKILL.md') problems.push(...skillProblems(file, source))
    collectDocsUrls(source, file, urls)
  }
  const skillUrlCount = urls.size

  let openApiUrlCount = 0
  try {
    const openApiUrls = await openApiDocsUrls(OPENAPI_SOURCE)
    openApiUrlCount = openApiUrls.size
    for (const [url, places] of openApiUrls) urls.set(url, [...(urls.get(url) ?? []), ...places])
  } catch (error) {
    problems.push(`${OPENAPI_SOURCE}: no se pudo leer el OpenAPI (${error.message})`)
  }

  const anchorsCache = new Map()
  for (const [url, places] of urls) {
    for (const problem of await linkProblems(url, anchorsCache)) problems.push(`${places.join(', ')}: ${problem}`)
  }

  console.log(
    `${files.length} archivos con ${skillUrlCount} enlaces y el OpenAPI (${OPENAPI_SOURCE}) con ${openApiUrlCount}: ` +
      `${urls.size} enlaces a ${DOCS_ORIGIN} revisados en ${CHECK_ORIGIN}, ${problems.length} hallazgos`,
  )
  for (const problem of problems) console.log(`- ${problem}`)
  process.exitCode = problems.length > 0 ? 1 : 0
}

await main()
