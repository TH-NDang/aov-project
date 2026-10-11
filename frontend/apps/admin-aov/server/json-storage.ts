import type { IncomingMessage, ServerResponse } from "node:http"
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { randomUUID } from "node:crypto"
import type { Plugin } from "vite"
import { validateTable, type StorageTable } from "../src/features/storage/storage-model.ts"

const MAX_BYTES = 20 * 1024 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function jsonStorage(root: string): Plugin {
  let queue: Promise<unknown> = Promise.resolve()
  const send = (res: ServerResponse, status: number, value: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" })
    res.end(JSON.stringify(value))
  }
  const read = async (id: string): Promise<StorageTable> =>
    JSON.parse(await readFile(resolve(root, `${id}.json`), "utf8"))
  const save = async (table: StorageTable) => {
    const content = JSON.stringify(table, null, 2) + "\n"
    if (Buffer.byteLength(content) > MAX_BYTES) throw new Error("Table exceeds 20 MB.")
    const temp = resolve(root, `${table.id}.${randomUUID()}.tmp`)
    await writeFile(temp, content, "utf8")
    await rename(temp, resolve(root, `${table.id}.json`))
  }
  const checkName = async (name: string, id: string) => {
    const files = (await readdir(root)).filter((file) => UUID.test(file.slice(0, -5)) && file.endsWith(".json"))
    for (const file of files) {
      const existing = await read(file.slice(0, -5))
      if (existing.id !== id && existing.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())
        throw new Error("Table name already exists.")
    }
  }
  const body = async (req: IncomingMessage) => {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > MAX_BYTES) throw new Error("Table exceeds 20 MB.")
      chunks.push(Buffer.from(chunk))
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  }
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const origin = req.headers.origin
      if (origin && new URL(origin).host !== req.headers.host)
        return send(res, 403, { message: "Origin is not allowed." })
      if (req.headers["sec-fetch-site"] === "cross-site")
        return send(res, 403, { message: "Cross-site access is not allowed." })
      await mkdir(root, { recursive: true })
      const pathname = (req.url ?? "/").split("?")[0]!
      const id = pathname.replace(/^\//, "")
      if (id && !UUID.test(id)) return send(res, 404, { message: "Table not found." })
      if (req.method === "GET") {
        if (id) return send(res, 200, await read(id))
        const files = (await readdir(root)).filter((file) => UUID.test(file.slice(0, -5)) && file.endsWith(".json"))
        const tables = await Promise.all(files.map((file) => read(file.slice(0, -5))))
        return send(
          res,
          200,
          tables.map(({ rows, ...table }) => ({ ...table, rowCount: rows.length })),
        )
      }
      if (!["POST", "PUT"].includes(req.method ?? "")) return send(res, 405, { message: "Method not allowed." })
      if (!req.headers["content-type"]?.startsWith("application/json"))
        return send(res, 415, { message: "JSON content is required." })
      const input = await body(req)
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid table data.")
      const job = queue.then(async () => {
        if (req.method === "POST" && !id) {
          const table: StorageTable = {
            id: randomUUID(),
            name: String(input.name ?? ""),
            version: 1,
            columns: [],
            idColumn: null,
            rows: [],
            archived: false,
          }
          validateTable(table)
          await checkName(table.name, table.id)
          await save(table)
          send(res, 201, table)
        } else if (req.method === "PUT" && id) {
          const current = await read(id)
          if (input.version !== current.version)
            return send(res, 409, { message: "Table was changed elsewhere. Reload before saving." })
          if (current.rows.length && input.idColumn !== current.idColumn)
            throw new Error("Cannot change the ID column of a populated table.")
          if (
            (input.idColumn !== null && typeof input.idColumn !== "string") ||
            !Array.isArray(input.columns) ||
            !input.columns.every((column: unknown) => typeof column === "string") ||
            !Array.isArray(input.rows) ||
            !input.rows.every((row: unknown) => row && typeof row === "object" && !Array.isArray(row))
          )
            throw new Error("Invalid table data.")
          const table: StorageTable = {
            id,
            name: String(input.name ?? ""),
            version: current.version + 1,
            columns: input.columns,
            idColumn: input.idColumn,
            rows: input.rows,
            archived: Boolean(input.archived),
          }
          validateTable(table)
          await checkName(table.name, table.id)
          await save(table)
          send(res, 200, table)
        } else send(res, 405, { message: "Method not allowed." })
      })
      queue = job.catch(() => {})
      await job
    } catch (error) {
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT"
      send(res, missing ? 404 : 400, {
        message: missing ? "Table not found." : error instanceof Error ? error.message : "Storage request failed.",
      })
    }
  }
  return {
    name: "admin-json-storage",
    configureServer(server) {
      server.middlewares.use("/__storage", handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use("/__storage", handler)
    },
  }
}
