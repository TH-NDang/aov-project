import { normalizeImportPath } from "./import-files"

/** Capture entries during the drop event, before the browser clears its data store. */
export function readImportDrop(transfer: DataTransfer): Promise<Map<string, File>> {
  const items = Array.from(transfer.items).filter((item) => item.kind === "file")
  const entries = items.map((item) => item.webkitGetAsEntry?.() ?? null)
  const fallback = Array.from(transfer.files)
  return collect(entries, fallback)
}

async function collect(entries: (FileSystemEntry | null)[], fallback: File[]) {
  const files = new Map<string, File>()
  let visited = 0
  const add = (path: string, file: File) => {
    const normalized = normalizeImportPath(path)
    if (files.has(normalized)) throw new Error(`Trùng đường dẫn: ${normalized}`)
    files.set(normalized, file)
  }
  async function visit(entry: FileSystemEntry, prefix: string, depth: number): Promise<void> {
    if (++visited > 20000 || depth > 32)
      throw new Error("Thư mục quá lớn hoặc quá nhiều cấp. Hãy chọn thư mục nhỏ hơn.")
    const path = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject))
      add(path, file)
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      while (true) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
        if (!batch.length) break
        for (const child of batch) await visit(child, path, depth + 1)
      }
    }
  }
  if (entries.some(Boolean)) {
    if (entries.some((entry) => !entry))
      throw new Error("Không đọc được mục đã thả. Hãy dùng nút chọn thư mục hoặc file.")
    for (const entry of entries) await visit(entry!, "", 0)
  } else {
    for (const file of fallback) add(file.name, file)
  }
  if (!files.size) throw new Error("Không đọc được file. Hãy dùng nút chọn thư mục hoặc file.")
  return files
}
