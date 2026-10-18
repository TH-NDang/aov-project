import { unzip } from "fflate"
import { normalizeImportPath } from "./import-files"

const supported = /\.(json|csv|png|jpe?g|webp)$/i

/** Decode locally; no archive or unselected image is sent to Media. */
export async function readImportZip(file: File): Promise<Map<string, File>> {
  if (file.size > 256 * 1024 * 1024) throw new Error("ZIP tối đa 256 MB. Với bộ ảnh lớn, hãy chọn thư mục.")
  const bytes = new Uint8Array(await file.arrayBuffer())
  const paths = new Set<string>()
  let total = 0
  let count = 0
  const contents = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(
      bytes,
      {
        filter(entry) {
          if (++count > 20000) throw new Error("ZIP có quá nhiều file (tối đa 20.000).")
          const path = normalizeImportPath(entry.name)
          if (entry.name.endsWith("/") || path.startsWith("__MACOSX/") || !supported.test(path)) return false
          if (paths.has(path)) throw new Error(`Trùng đường dẫn trong ZIP: ${path}`)
          paths.add(path)
          total += entry.originalSize
          const limit = /\.(json|csv)$/i.test(path) ? 5 : 25
          if (entry.originalSize > limit * 1024 * 1024 || total > 512 * 1024 * 1024)
            throw new Error(
              "ZIP vượt giới hạn giải nén: dữ liệu 5 MB/file, ảnh 25 MB/file, tổng 512 MB. Hãy chọn thư mục.",
            )
          return true
        },
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    )
  })
  const files = new Map<string, File>()
  for (const [path, bytes] of Object.entries(contents)) {
    files.set(normalizeImportPath(path), new File([new Uint8Array(bytes)], path.split("/").at(-1)!))
  }
  if (![...files.keys()].some((path) => /\.(json|csv)$/i.test(path)))
    throw new Error("ZIP không có file JSON hoặc CSV.")
  return files
}

export function importDataDirectory(path: string) {
  return normalizeImportPath(path).split("/").slice(0, -1).join("/")
}
