/**
 * Sync tool for private source files (ADR-030 section 8). It talks to the Admin API only, so it never needs R2 keys:
 * bytes go to storage through presigned URLs and are read back to check their SHA-256.
 *
 *   node --experimental-strip-types server/source-sync.ts plan <folder|zip> --collection <code> [options]
 *   node --experimental-strip-types server/source-sync.ts push <folder|zip> --collection <code> --apply [options]
 *   node --experimental-strip-types server/source-sync.ts pull --collection <code> --to <folder> [--apply]
 *
 * Options: --category <CATEGORY> --label <text> --captured-on <yyyy-mm-dd> (to create a missing collection),
 * --prefix <folder in the collection>, --exclude <text in a path> (repeatable), --replace (overwrite a path that names
 * other bytes), --workers <1-4>, --backend <url>, --keycloak <url>. The token comes from the local CLI client, as for the
 * research import tools: WIKI_IMPORT_USERNAME and WIKI_IMPORT_PASSWORD, or the local realm file in development.
 *
 * Nothing is written without --apply. Receipts are appended with fsync to .local-state/source-sync/<collection>.jsonl.
 */
import { createHash } from "node:crypto"
import { createReadStream, existsSync, fsyncSync, mkdirSync, openSync, closeSync, writeSync } from "node:fs"
import { mkdir, open, readdir, readFile, stat, writeFile, rename } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"
import { extractInnerArchive, readZipDirectory, readZipEntry } from "./nested-zip.ts"

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  json: "application/json",
  jsonl: "text/plain",
  csv: "text/csv",
  md: "text/markdown",
  zip: "application/zip",
  txt: "text/plain",
  py: "text/plain",
  mjs: "text/plain",
  js: "text/plain",
  ts: "text/plain",
  ps1: "text/plain",
  log: "text/plain",
}
const FORBIDDEN = /[\\:*?"<>|\p{Cc}\p{Cf}]/u
const ESTIMATE_CHUNK = 20_000
const LINK_CHUNK = 200

export interface SourceItem {
  path: string
  sizeBytes: number
  sha256: string
  contentType: string
  read: () => Promise<Buffer>
}

export interface Collected {
  items: SourceItem[]
  skipped: { path: string; reason: string }[]
}

export function contentTypeOf(path: string) {
  const name = basename(path)
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : ""
  return TYPES[extension] ?? null
}

/** The same path rules as the backend (SourcePaths): relative, NFC, no empty, "." or ".." segment. */
export function normalizePath(path: string): string | null {
  const value = path.normalize("NFC")
  if (!value || value.length > 512 || value.startsWith("/") || FORBIDDEN.test(value)) return null
  for (const segment of value.split("/"))
    if (!segment.trim() || segment === "." || segment === ".." || segment.endsWith(".") || segment.endsWith(" "))
      return null
  return value
}

function withPrefix(prefix: string, path: string) {
  const clean = prefix.split("/").filter(Boolean).join("/")
  return clean ? `${clean}/${path}` : path
}

async function hashFile(file: string) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(file)) hash.update(chunk as Buffer)
  return hash.digest("hex")
}

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex")

function accept(collected: Collected, path: string, sizeBytes: number) {
  const contentType = contentTypeOf(path)
  const normalized = normalizePath(path)
  if (!contentType) collected.skipped.push({ path, reason: "unsupported type" })
  else if (!normalized) collected.skipped.push({ path, reason: "unsafe path" })
  else return { contentType, path: normalized, sizeBytes }
  return null
}

/** Every file below {@code folder}; paths are relative to it and use "/". */
export async function collectFolder(folder: string, prefix = "", excludes: string[] = []): Promise<Collected> {
  const collected: Collected = { items: [], skipped: [] }
  const walk = async (directory: string) => {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const full = join(directory, entry.name)
      const local = relative(folder, full).split(sep).join("/")
      if (excludes.some((text) => local.includes(text))) continue
      if (entry.isDirectory()) await walk(full)
      else if (entry.isFile()) {
        const size = (await stat(full)).size
        const accepted = accept(collected, withPrefix(prefix, local), size)
        if (accepted) collected.items.push({ ...accepted, sha256: await hashFile(full), read: () => readFile(full) })
      }
    }
  }
  await walk(folder)
  return collected
}

/** One loose file, placed at {@code prefix}/its name. */
export async function collectFile(file: string, prefix = ""): Promise<Collected> {
  const collected: Collected = { items: [], skipped: [] }
  const accepted = accept(collected, withPrefix(prefix, basename(file)), (await stat(file)).size)
  if (accepted) collected.items.push({ ...accepted, sha256: await hashFile(file), read: () => readFile(file) })
  return collected
}

/**
 * The files of a ZIP as delivered, with archives inside it opened one level down, as the capture sets are packed.
 * Paths start with the archive names without ".zip", so every entry keeps where it came from.
 */
export async function collectZip(zipPath: string, prefix = "", excludes: string[] = []): Promise<Collected> {
  const collected: Collected = { items: [], skipped: [] }
  const outerName = basename(zipPath).replace(/\.zip$/i, "")
  const cache = join(
    tmpdir(),
    "aov-source-sync",
    createHash("sha256").update(resolve(zipPath)).digest("hex").slice(0, 16),
  )

  const addEntries = async (archive: string, base: string) => {
    const handle = await open(archive, "r")
    try {
      const entries = [...(await readZipDirectory(handle)).values()].filter((entry) => !entry.name.endsWith("/"))
      for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const local = `${base}/${entry.name}`
        if (excludes.some((text) => local.includes(text))) continue
        if (/\.zip$/i.test(entry.name) && archive === zipPath) {
          const inner = join(cache, entry.name.replaceAll("/", "_"))
          if (!existsSync(inner)) await extractInnerArchive(zipPath, entry.name, inner)
          await addEntries(inner, `${base}/${entry.name.replace(/\.zip$/i, "")}`)
          continue
        }
        const accepted = accept(collected, withPrefix(prefix, local), entry.size)
        if (!accepted) continue
        const read = async () => {
          const file = await open(archive, "r")
          try {
            return await readZipEntry(file, entry)
          } finally {
            await file.close()
          }
        }
        collected.items.push({ ...accepted, sha256: sha256(await read()), read })
      }
    } finally {
      await handle.close()
    }
  }
  await mkdir(cache, { recursive: true })
  await addEntries(zipPath, outerName)
  return collected
}

interface UploadTicket {
  uploadId: string
  method: string
  uploadUrl: string
  headers: Record<string, string>
}

interface Collection {
  id: string
  code: string
  version: number
}

interface RemoteFile {
  id: string
  path: string
  sha256: string
  sizeBytes: number
}

// Plain fields instead of parameter properties: Node runs this file by stripping types only.
class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly context: Record<string, unknown>

  constructor(status: number, code: string, context: Record<string, unknown>) {
    super(`${status} ${code}`)
    this.status = status
    this.code = code
    this.context = context
  }
}

/** The Admin API as the sync tool needs it; one token, renewed before it runs out. */
export class SourceApi {
  private token: { value: string; until: number } | null = null

  private readonly backend: string
  private readonly authenticate: () => Promise<{ token: string; expiresIn: number }>

  constructor(backend: string, authenticate: () => Promise<{ token: string; expiresIn: number }>) {
    this.backend = backend
    this.authenticate = authenticate
  }

  async call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    if (!this.token || Date.now() >= this.token.until) {
      const result = await this.authenticate()
      this.token = { value: result.token, until: Date.now() + (result.expiresIn - 30) * 1000 }
    }
    const response = await fetch(`${this.backend}/api/wiki/v1${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.token.value}`,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      redirect: "error",
    })
    if (response.status === 204) return undefined as T
    const text = await response.text()
    const body = text ? JSON.parse(text) : {}
    if (!response.ok) throw new ApiError(response.status, body.code ?? "HTTP_ERROR", body.context ?? {})
    return body as T
  }

  async findCollection(code: string): Promise<Collection | null> {
    const page = await this.call<{ items: Collection[] }>(
      `/admin/source-collections?q=${encodeURIComponent(code)}&size=100`,
    )
    return page.items.find((item) => item.code === code) ?? null
  }

  async files(collectionId: string): Promise<RemoteFile[]> {
    const files: RemoteFile[] = []
    for (let page = 0; ; page++) {
      const slice = await this.call<{ items: RemoteFile[]; totalElements: number }>(
        `/admin/source-collections/${collectionId}/files?page=${page}&size=200`,
      )
      files.push(...slice.items)
      if (slice.items.length === 0 || files.length >= slice.totalElements) return files
    }
  }

  async linksByPath(collectionId: string, paths: string[]) {
    const links = new Map<string, { url: string; sha256: string }>()
    for (let start = 0; start < paths.length; start += LINK_CHUNK) {
      const result = await this.call<{ items: { path: string; url: string; sha256: string }[] }>(
        `/admin/source-collections/${collectionId}/links`,
        { method: "POST", body: { paths: paths.slice(start, start + LINK_CHUNK) } },
      )
      for (const item of result.items) links.set(item.path, item)
    }
    return links
  }
}

export interface Estimate {
  newFiles: number
  newBytes: number
  knownFiles: number
  classA: number
  classB: number
  storageBytesAfter: number
  storageShareAfter: number
  level: string
}

/** Asks the backend what the batch adds; source bytes already stored cost nothing. */
export async function estimate(api: SourceApi, items: SourceItem[]): Promise<Estimate> {
  if (items.length > ESTIMATE_CHUNK) throw new Error(`Split the batch: at most ${ESTIMATE_CHUNK} files at once.`)
  return api.call<Estimate>("/admin/storage/estimates", {
    method: "POST",
    body: { target: "SOURCES", files: items.map((item) => ({ sha256: item.sha256, sizeBytes: item.sizeBytes })) },
  })
}

/** Appends one JSON line and forces it to disk, so a crash never loses a receipt that was printed. */
export function appendReceipt(file: string, receipt: Record<string, unknown>) {
  mkdirSync(dirname(file), { recursive: true })
  const handle = openSync(file, "a")
  try {
    writeSync(handle, JSON.stringify(receipt) + "\n")
    fsyncSync(handle)
  } finally {
    closeSync(handle)
  }
}

export interface PushOptions {
  workers?: number
  replace?: boolean
  receipts: string
  log?: (line: string) => void
}

/** Uploads every item, then reads each stored file back through a presigned link and compares its SHA-256. */
export async function push(api: SourceApi, collection: Collection, items: SourceItem[], options: PushOptions) {
  const log = options.log ?? console.log
  const result = { uploaded: 0, stored: 0, failed: 0 }
  let next = 0
  const work = async () => {
    while (next < items.length) {
      const item = items[next++]
      try {
        const status = await pushOne(api, collection, item, options.replace ?? false)
        const verified = await verify(api, collection, item)
        appendReceipt(options.receipts, {
          at: new Date().toISOString(),
          collection: collection.code,
          path: item.path,
          sha256: item.sha256,
          sizeBytes: item.sizeBytes,
          status,
          verified,
        })
        if (!verified) throw new Error("stored bytes differ from the local file")
        result[status === "STORED" ? "stored" : "uploaded"]++
      } catch (failure) {
        result.failed++
        const message = failure instanceof Error ? failure.message : String(failure)
        appendReceipt(options.receipts, {
          at: new Date().toISOString(),
          collection: collection.code,
          path: item.path,
          sha256: item.sha256,
          status: "FAILED",
          error: message,
        })
        log(`FAILED ${item.path}: ${message}`)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, Math.max(1, options.workers ?? 3)) }, work))
  return result
}

async function pushOne(api: SourceApi, collection: Collection, item: SourceItem, replace: boolean) {
  const body = { path: item.path, sha256: item.sha256, sizeBytes: item.sizeBytes, contentType: item.contentType }
  let requested: { status: "STORED" | "UPLOAD_REQUIRED"; upload: UploadTicket | null }
  try {
    requested = await api.call(`/admin/source-collections/${collection.id}/uploads`, { method: "POST", body })
  } catch (failure) {
    if (!(failure instanceof ApiError) || failure.code !== "SOURCE_FILE_PATH_TAKEN" || !replace) throw failure
    const { fileId, version } = failure.context as { fileId: string; version: number }
    requested = await api.call(`/admin/source-collections/${collection.id}/uploads`, {
      method: "POST",
      body: { ...body, replace: { fileId, expectedVersion: version } },
    })
  }
  if (requested.status === "STORED" || !requested.upload) return "STORED" as const

  const ticket = requested.upload
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(ticket.uploadUrl, {
      method: ticket.method,
      headers: ticket.headers,
      body: new Uint8Array(await item.read()),
      redirect: "error",
    }).catch((error: unknown) => error as Error)
    if (!(response instanceof Error) && response.ok) break
    if (attempt >= 3)
      throw new Error(`upload failed: ${response instanceof Error ? response.message : response.status}`)
    await new Promise((done) => setTimeout(done, 1000 * attempt))
  }
  await api.call(`/admin/source-uploads/${ticket.uploadId}/complete`, { method: "POST" })
  return "UPLOADED" as const
}

async function verify(api: SourceApi, collection: Collection, item: SourceItem) {
  const link = (await api.linksByPath(collection.id, [item.path])).get(item.path)
  if (!link) return false
  const response = await fetch(link.url, { redirect: "error" })
  if (!response.ok) return false
  return sha256(Buffer.from(await response.arrayBuffer())) === item.sha256
}

/** Downloads a collection into {@code target}, keeping files that already have the right bytes. */
export async function pull(api: SourceApi, collection: Collection, target: string, apply: boolean, log = console.log) {
  const root = resolve(target)
  const files = await api.files(collection.id)
  const result = { kept: 0, downloaded: 0, failed: 0, plannedBytes: 0 }
  const missing: RemoteFile[] = []
  for (const file of files) {
    const path = normalizePath(file.path)
    const local = path ? resolve(root, ...path.split("/")) : null
    if (!local || !local.startsWith(root + sep)) {
      result.failed++
      log(`REFUSED ${file.path}: the path leaves the target folder`)
      continue
    }
    if (existsSync(local) && (await hashFile(local)) === file.sha256) result.kept++
    else {
      missing.push(file)
      result.plannedBytes += file.sizeBytes
    }
  }
  if (!apply) return { ...result, toDownload: missing.length }

  for (let start = 0; start < missing.length; start += LINK_CHUNK) {
    const chunk = missing.slice(start, start + LINK_CHUNK)
    const links = await api.linksByPath(
      collection.id,
      chunk.map((file) => file.path),
    )
    for (const file of chunk) {
      const local = resolve(root, ...file.path.split("/"))
      const link = links.get(file.path)
      const response = link ? await fetch(link.url, { redirect: "error" }) : null
      const bytes = response?.ok ? Buffer.from(await response.arrayBuffer()) : null
      if (!bytes || sha256(bytes) !== file.sha256) {
        result.failed++
        log(`FAILED ${file.path}: missing or different bytes`)
        continue
      }
      await mkdir(dirname(local), { recursive: true })
      await writeFile(`${local}.part`, bytes)
      await rename(`${local}.part`, local)
      result.downloaded++
    }
  }
  return { ...result, toDownload: missing.length }
}

function option(args: string[], name: string) {
  const index = args.indexOf(`--${name}`)
  return index >= 0 ? args[index + 1] : undefined
}

function options(args: string[], name: string) {
  return args.flatMap((value, index) => (value === `--${name}` && args[index + 1] ? [args[index + 1]] : []))
}

/** The password grant of the local CLI client, as the research import tools use it. */
function localLogin(keycloak: string) {
  return async () => {
    const username = process.env.WIKI_IMPORT_USERNAME ?? "admin"
    let password = process.env.WIKI_IMPORT_PASSWORD
    if (password === undefined) {
      const realmFile = new URL(
        "../../../../backend/wiki-service/infra/local/keycloak/wikiaov-realm.json",
        import.meta.url,
      )
      const realm = JSON.parse(await readFile(realmFile, "utf8"))
      const user = realm.users.find((candidate: { username: string }) => candidate.username === username)
      password = user?.credentials?.find((item: { type: string }) => item.type === "password")?.value
      if (!password) throw new Error(`Set WIKI_IMPORT_PASSWORD for ${username}.`)
    }
    const response = await fetch(`${keycloak}/realms/wikiaov/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: "wiki-local-cli", grant_type: "password", username, password }),
    })
    if (!response.ok) throw new Error(`Sign-in failed with HTTP ${response.status}.`)
    const body = (await response.json()) as { access_token: string; expires_in: number }
    return { token: body.access_token, expiresIn: body.expires_in }
  }
}

const gigabytes = (bytes: number) => `${(bytes / 1e9).toFixed(3)} GB`

async function main(args: string[]) {
  const [command, source] = args
  const code = option(args, "collection")
  if (!command || !["plan", "push", "pull"].includes(command) || !code)
    throw new Error(
      "Usage: source-sync.ts plan|push <folder|zip> --collection <code> | pull --collection <code> --to <folder>",
    )
  const api = new SourceApi(
    option(args, "backend") ?? "http://localhost:8080",
    localLogin(option(args, "keycloak") ?? "http://localhost:8081"),
  )
  const receipts = resolve(".local-state", "source-sync", `${code}.jsonl`)

  if (command === "pull") {
    const target = option(args, "to")
    if (!target) throw new Error("pull needs --to <folder>.")
    const collection = await api.findCollection(code)
    if (!collection) throw new Error(`Collection ${code} does not exist.`)
    const result = await pull(api, collection, target, args.includes("--apply"))
    console.log(JSON.stringify(result, null, 2))
    if (!args.includes("--apply")) console.log("Plan only. Add --apply to download.")
    return
  }

  if (!source) throw new Error(`${command} needs a folder or a ZIP file.`)
  const prefix = option(args, "prefix") ?? ""
  const excludes = options(args, "exclude")
  const collected = /\.zip$/i.test(source)
    ? await collectZip(source, prefix, excludes)
    : (await stat(source)).isFile()
      ? await collectFile(source, prefix)
      : await collectFolder(source, prefix, excludes)
  const bytes = collected.items.reduce((sum, item) => sum + item.sizeBytes, 0)
  // The same bytes under two paths are stored once, so the distinct contents are what costs storage.
  const distinct = new Map(collected.items.map((item) => [item.sha256, item.sizeBytes]))
  const distinctBytes = [...distinct.values()].reduce((sum, size) => sum + size, 0)
  console.log(
    `${collected.items.length} files, ${gigabytes(bytes)}; ${distinct.size} distinct contents, ` +
      `${gigabytes(distinctBytes)}; ${collected.skipped.length} skipped.`,
  )
  for (const skipped of collected.skipped.slice(0, 20)) console.log(`  skipped ${skipped.path}: ${skipped.reason}`)

  let existing: Collection | null = null
  let planned: Estimate | null = null
  try {
    existing = await api.findCollection(code)
    planned = await estimate(api, collected.items)
    console.log(
      `New: ${planned.newFiles} files, ${gigabytes(planned.newBytes)}; already in R2: ${planned.knownFiles}. ` +
        `Operations: ${planned.classA} class A, ${planned.classB + planned.newFiles} class B with the read-back. ` +
        `Storage after: ${gigabytes(planned.storageBytesAfter)} (${(planned.storageShareAfter * 100).toFixed(1)}% of the free tier, ${planned.level}).`,
    )
  } catch (failure) {
    if (command === "push" && args.includes("--apply")) throw failure
    console.log(`No estimate: the Admin API did not answer (${failure instanceof Error ? failure.message : failure}).`)
  }
  const sourceName = (prefix ? `${prefix}.${basename(source)}` : basename(source)).replace(/[^A-Za-z0-9._-]/g, "_")
  const planFile = resolve(".local-state", "source-sync", `${code}.${sourceName}.plan.json`)
  await mkdir(dirname(planFile), { recursive: true })
  await writeFile(
    planFile,
    JSON.stringify(
      {
        collection: code,
        collectionExists: existing !== null,
        source: resolve(source),
        prefix,
        excludes,
        files: collected.items.length,
        bytes,
        distinctFiles: distinct.size,
        distinctBytes,
        skipped: collected.skipped,
        estimate: planned,
        items: collected.items.map(({ path, sizeBytes, sha256: hash, contentType }) => ({
          path,
          sizeBytes,
          sha256: hash,
          contentType,
        })),
      },
      null,
      2,
    ),
  )
  console.log(`Plan written to ${planFile}.`)
  if (command === "plan" || !args.includes("--apply")) {
    console.log("Plan only. Add --apply to push.")
    return
  }

  let collection = existing
  if (!collection) {
    const category = option(args, "category")
    const label = option(args, "label")
    if (!category || !label) throw new Error("A new collection needs --category and --label.")
    collection = await api.call<Collection>("/admin/source-collections", {
      method: "POST",
      body: { code, category, label, capturedOn: option(args, "captured-on") ?? null, note: null },
    })
  }
  const result = await push(api, collection, collected.items, {
    workers: Number(option(args, "workers") ?? 3),
    replace: args.includes("--replace"),
    receipts,
  })
  console.log(JSON.stringify({ ...result, receipts }, null, 2))
  if (result.failed > 0) process.exitCode = 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch((failure) => {
    console.error(failure instanceof Error ? failure.message : failure)
    process.exitCode = 1
  })
}
