import type { StorageTable } from "./storage-model"

export type TableSummary = Omit<StorageTable, "rows"> & { rowCount: number }

async function request<T>(path: string, method = "GET", value?: unknown): Promise<T> {
  const response = await fetch(`/__storage${path}`, {
    method,
    headers: value === undefined ? undefined : { "Content-Type": "application/json" },
    body: value === undefined ? undefined : JSON.stringify(value),
  })
  if (!response.headers.get("content-type")?.includes("application/json")) {
    throw new Error("JSON storage requires the local dev or preview server.")
  }
  const result = await response.json()
  if (!response.ok) throw new Error(result.message ?? "Storage request failed.")
  return result as T
}

export const storageApi = {
  list: () => request<TableSummary[]>("/"),
  get: (id: string) => request<StorageTable>(`/${id}`),
  create: (name: string) => request<StorageTable>("/", "POST", { name }),
  save: (table: StorageTable) => request<StorageTable>(`/${table.id}`, "PUT", table),
}
