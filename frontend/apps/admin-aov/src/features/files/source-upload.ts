import { completeUpload, requestUpload, type SourceFile } from "./files-api"

/** Larger files, such as capture archives, go through the sync tool, which streams instead of holding them in memory. */
export const MAX_BROWSER_UPLOAD_BYTES = 200_000_000

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  json: "application/json",
  csv: "text/csv",
  md: "text/markdown",
  zip: "application/zip",
  txt: "text/plain",
  // Scripts are stored as plain text: a browser must never run them (ADR-030 section 5).
  py: "text/plain",
  mjs: "text/plain",
  js: "text/plain",
  ts: "text/plain",
  ps1: "text/plain",
  log: "text/plain",
}

/** The stored type of a file, from its extension; null when the private bucket does not accept it. */
export function sourceContentType(name: string): string | null {
  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : ""
  return TYPES[extension] ?? null
}

export async function sha256Hex(file: Blob) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

/** A file name as a path segment: the same rules as the backend, so a picked file never fails on its name. */
export function safeFileName(name: string) {
  return name
    .normalize("NFC")
    .replace(/[\\/:*?"<>|\p{Cc}\p{Cf}]/gu, "-")
    .replace(/[. ]+$/u, "")
}

export function joinPath(folder: string, name: string) {
  const clean = folder
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/")
  return clean ? `${clean}/${name}` : name
}

/**
 * Stores one file in a collection: bytes already in R2 are placed at once; otherwise they go straight to storage with
 * the presigned PUT, never through the backend, and the backend checks them on complete.
 */
export async function uploadSourceFile(input: {
  collectionId: string
  path: string
  file: File
  sha256: string
  contentType: string
  replace?: { fileId: string; expectedVersion: number }
  signal?: AbortSignal
}): Promise<{ file: SourceFile; stored: boolean }> {
  const requested = await requestUpload(
    input.collectionId,
    {
      path: input.path,
      sha256: input.sha256,
      sizeBytes: input.file.size,
      contentType: input.contentType,
      replace: input.replace,
    },
    input.signal,
  )
  if (requested.status === "STORED") return { file: requested.file, stored: true }

  const { upload } = requested
  const response = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers: upload.headers,
    body: input.file,
    credentials: "omit",
    redirect: "error",
    signal: input.signal,
  })
  if (!response.ok) throw new Error(`Không tải được tệp lên kho (HTTP ${response.status}).`)

  const completed = await completeUpload(upload.uploadId, input.signal)
  return { file: completed.file, stored: false }
}
