import { imageFromUrl } from "./image-url"

const imageLimit = 25 * 1024 * 1024
const imageTypes = ["image/png", "image/jpeg", "image/webp"]
const resourcesPrefix = "/__resources/"
const assetsPrefix = `${resourcesPrefix}assets/`

function validatedImage(file: File, path: string): File {
  const type =
    file.type ||
    ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" }[
      path.split(".").at(-1)!.toLowerCase()
    ] ??
      "")
  if (!imageTypes.includes(type) || file.size === 0 || file.size > imageLimit)
    throw new Error(`Ảnh ${path} phải là PNG, JPEG hoặc WebP, tối đa 25 MB.`)
  return file.type ? file : new File([file], file.name, { type })
}

/** Decode each segment before validation; encoded separators must never change the resource namespace. */
function resourceImagePath(source: string): { path: string; url: string } {
  if (!source.startsWith(assetsPrefix) || source.length > 4096)
    throw new Error("Đường dẫn ảnh tài nguyên không hợp lệ.")
  const invalid = () => {
    throw new Error("Đường dẫn ảnh tài nguyên không hợp lệ.")
  }
  const segments = source
    .slice(resourcesPrefix.length)
    .split("/")
    .map((segment) => {
      if (!segment) return invalid()
      let decoded = segment
      for (let pass = 0; pass < 4; pass++) {
        if (/^[.]{1,2}$/.test(decoded) || /[\u0000-\u001f\u007f\\/?#]/.test(decoded)) return invalid()
        if (!decoded.includes("%")) return decoded
        try {
          decoded = decodeURIComponent(decoded)
        } catch {
          return invalid()
        }
      }
      return invalid()
    })
  const path = segments.join("/")
  if (segments[0] !== "assets" || normalizeImportPath(path) !== path) return invalid()
  return { path, url: resourcesPrefix + segments.map(encodeURIComponent).join("/") }
}

async function resourceImage(response: Response, path: string): Promise<File> {
  const type = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? ""
  const length = Number(response.headers.get("content-length"))
  if (!response.ok || !response.body || !imageTypes.includes(type)) {
    await response.body?.cancel().catch(() => {})
    throw new Error(`Không đọc được ảnh tài nguyên: ${path}. Chọn thư mục chứa ảnh để tiếp tục.`)
  }
  if (Number.isFinite(length) && length > imageLimit) {
    await response.body.cancel().catch(() => {})
    throw new Error("Ảnh tài nguyên vượt giới hạn 25 MB.")
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > imageLimit) throw new Error("Ảnh tài nguyên vượt giới hạn 25 MB.")
      chunks.push(new Uint8Array(value))
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
  return validatedImage(new File(chunks, path.split("/").at(-1)!, { type }), path)
}

export function detectImportImageBase(
  data: unknown,
  files: Map<string, File>,
  dataPath: string,
  current: string,
): string {
  const sources = new Set<string>()
  const pending: unknown[] = [data]
  while (pending.length) {
    const value = pending.pop()
    if (typeof value === "string" && /\.(png|jpe?g|webp|gif)$/i.test(value) && !/^(?:[a-z]+:|[/\\])/i.test(value))
      sources.add(value)
    else if (Array.isArray(value)) pending.push(...value)
    else if (value && typeof value === "object") pending.push(...Object.values(value))
  }
  const candidates = new Set([current])
  let directory = dataPath.includes("/") ? dataPath.slice(0, dataPath.lastIndexOf("/")) : ""
  while (directory) {
    candidates.add(directory)
    directory = directory.includes("/") ? directory.slice(0, directory.lastIndexOf("/")) : ""
  }
  candidates.add("")
  let best = current
  let bestScore = 0
  for (const candidate of candidates) {
    let score = 0
    for (const source of sources) {
      try {
        if (files.has(normalizeImportPath(`${candidate ? `${candidate}/` : ""}${source}`))) score++
      } catch {
        // Invalid paths remain errors during preview; never resolve outside the package.
      }
    }
    if (score > bestScore) {
      best = candidate
      bestScore = score
    }
  }
  return best
}

export function normalizeImportPath(path: string): string {
  if (path.includes("\0") || path.startsWith("\\") || /^(?:[a-z]+:|\/)/i.test(path))
    throw new Error("Chỉ dùng đường dẫn tương đối bên trong thư mục đã chọn.")
  const parts: string[] = []
  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue
    if (part === "..") {
      if (!parts.length) throw new Error("Đường dẫn ảnh nằm ngoài thư mục đã chọn.")
      parts.pop()
    } else parts.push(part)
  }
  return parts.join("/")
}
export function indexImportFiles(files: File[]): Map<string, File> {
  const index = new Map<string, File>()
  for (const file of files) {
    const relative = file.webkitRelativePath || file.name
    const path = normalizeImportPath(file.webkitRelativePath ? relative.slice(relative.indexOf("/") + 1) : relative)
    if (index.has(path)) throw new Error(`Trùng đường dẫn: ${path}`)
    index.set(path, file)
  }
  return index
}
export function resolveImportImage(source: string, files: Map<string, File>, base: string): File | string {
  if (source.startsWith(assetsPrefix)) {
    const { path, url } = resourceImagePath(source)
    const selected = files.get(path) ?? files.get(normalizeImportPath(`${base ? `${base}/` : ""}${path}`))
    return selected ? validatedImage(selected, path) : url
  }
  if (/^https:/i.test(source)) {
    const url = new URL(source)
    if (url.username || url.password) throw new Error("Link ảnh không được chứa tài khoản hoặc mật khẩu.")
    return url.href
  }
  if (/^[a-z]+:/i.test(source) || source.startsWith("/") || source.startsWith("\\"))
    throw new Error("Ảnh cần là link HTTPS hoặc đường dẫn tương đối.")
  const path = normalizeImportPath(`${base ? `${base}/` : ""}${source}`)
  const file = files.get(path)
  if (!file) throw new Error(`Không tìm thấy ảnh: ${path}. Chọn thư mục chứa ảnh hoặc sửa thư mục gốc.`)
  return validatedImage(file, path)
}
export async function importImageFile(source: string, files: Map<string, File>, base: string) {
  const resolved = resolveImportImage(source, files, base)
  if (typeof resolved === "string") {
    if (!resolved.startsWith(assetsPrefix)) return imageFromUrl(resolved)
    const response = await fetch(resolved, {
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(30000),
    })
    const file = await resourceImage(response, resourceImagePath(resolved).path)
    if ((await file.slice(0, 128).text()).startsWith("version https://git-lfs.github.com/spec/v1"))
      throw new Error(`Ảnh ${resolved} mới là Git LFS pointer. Hãy tải ảnh thật bằng git lfs pull trước khi import.`)
    return file
  }
  if ((await resolved.slice(0, 128).text()).startsWith("version https://git-lfs.github.com/spec/v1"))
    throw new Error(`Ảnh ${resolved.name} mới là Git LFS pointer. Hãy tải ảnh thật bằng git lfs pull trước khi import.`)
  return resolved
}
