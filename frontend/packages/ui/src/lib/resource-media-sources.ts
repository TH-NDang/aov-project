import type { MediaSourceInput } from "./media-credit"

export const resourceSourceFiles = [
  "nguon-thu-thap.json",
  "danh-sach-anh.json",
  "nguon-icon-chieu.json",
  "nguon-icon-tuong.json",
  "portrait-sources.json",
  "trang-bi-nguon-du-lieu.json",
  "phu-hieu.json",
  "ngoc.json",
  "phu-tro.json",
]
type Row = Record<string, unknown>
export interface ResourceMediaSource {
  path: string
  sha256?: string
  source: MediaSourceInput
}
const http = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined
  try {
    const url = new URL(value)
    return /^(https?:)$/.test(url.protocol) && !url.username && !url.password ? url.href : undefined
  } catch {
    return undefined
  }
}

/** Reads the documented manifests, preserving original-image and derived-image distinctions. */
export function buildResourceMediaSources(documents: Record<string, unknown>): ResourceMediaSource[] {
  const output: ResourceMediaSource[] = []
  const collection = documents["nguon-thu-thap.json"] as { sources?: Row[] } | undefined
  const figma = collection?.sources?.find((row) => row.id === "figma-portrait")
  const walk = (value: unknown, manifest: string, collectedOn?: string) => {
    if (Array.isArray(value)) {
      value.forEach((row) => walk(row, manifest, collectedOn))
      return
    }
    if (!value || typeof value !== "object") return
    const row = value as Row
    const date =
      "collectedOn" in row ? (typeof row.collectedOn === "string" ? row.collectedOn : undefined) : collectedOn
    const path =
      typeof row.file === "string" ? row.file : typeof row.image_file === "string" ? row.image_file : undefined
    if (path && /\.(png|jpe?g|webp)$/i.test(path)) {
      let url = http(row.sourceUrl) ?? http(row.image_url) ?? http(row.url) ?? http(row.source)
      const derived = row.derived === true || row.method === "ai-reconstruction" || !!row.edit
      const figmaExport = manifest === "portrait-sources.json" && row.source === "User-provided Figma PNG export"
      const providedZip = manifest === "phu-tro.json" && row.sourceType === "provided-zip"
      if (figmaExport && typeof figma?.fileKey === "string") {
        const node = typeof row.nodeId === "string" ? row.nodeId : row.frameId
        url = `https://www.figma.com/design/${encodeURIComponent(figma.fileKey)}/${typeof node === "string" ? `?node-id=${encodeURIComponent(node.replace(":", "-"))}` : ""}`
      }
      if (url || figmaExport || providedZip) {
        const host = url ? new URL(url).hostname : ""
        const page = http(row.page) ?? http(row.source_page)
        const garena = host === "lienquan.garena.vn" || (page && new URL(page).hostname === "lienquan.garena.vn")
        const liquipedia = host === "liquipedia.net"
        const source: MediaSourceInput = {
          type: derived
            ? "OTHER"
            : figmaExport || providedZip
              ? "GAME_CLIENT"
              : garena
                ? "OFFICIAL"
                : liquipedia
                  ? "COMMUNITY"
                  : "OTHER",
          label: derived
            ? "Ảnh đã xử lý / tái tạo theo mẫu Garena"
            : figmaExport
              ? "Ảnh chụp Liên Quân — gói Figma do người dùng cung cấp"
              : providedZip
                ? "Ảnh chụp Liên Quân — gói phu-tro.zip do người dùng cung cấp"
                : garena
                  ? "Garena Liên Quân Mobile"
                  : liquipedia
                    ? "Liquipedia — Arena of Valor"
                    : host || "Nguồn được ghi trong tài nguyên",
          url: url ?? null,
          ownerName:
            !derived && (garena || figmaExport || providedZip || liquipedia) ? "Garena / Liên Quân Mobile" : null,
          contactUrl: null,
          note: `${path}\nManifest: data/${manifest}${date ? `\nCollected on: ${date}` : ""}${derived ? `\nDerived: ${String(row.method ?? "edited")}` : ""}`,
        }
        output.push({ path, sha256: typeof row.sha256 === "string" ? row.sha256 : undefined, source })
        if (typeof row.sourceFile === "string")
          output.push({ path: row.sourceFile, sha256: typeof row.sha256 === "string" ? row.sha256 : undefined, source })
      }
    }
    for (const child of Object.values(row)) if (child && typeof child === "object") walk(child, manifest, date)
  }
  for (const name of resourceSourceFiles) walk(documents[name], name)
  return output
}

export function findResourceMediaSource(index: ResourceMediaSource[], path: string, digest?: string): MediaSourceInput {
  const normalized = path.replace(/^\/__resources\//, "")
  const direct = index.find((row) => row.path === normalized && (!digest || !row.sha256 || row.sha256 === digest))
  const match = direct ?? (digest ? index.find((row) => row.sha256 === digest) : undefined)
  if (match) return { ...match.source, note: `${normalized}\n${match.source.note ?? ""}`.slice(0, 2000) }
  const url = http(path)
  return {
    type: "OTHER",
    label: url ? new URL(url).hostname : "Chưa xác minh nguồn",
    url: url ?? null,
    ownerName: null,
    contactUrl: null,
    note: normalized.slice(0, 2000),
  }
}
