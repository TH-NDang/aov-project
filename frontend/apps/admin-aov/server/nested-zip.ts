import { createReadStream, createWriteStream } from "node:fs"
import { mkdir, open, rename, rm, stat, type FileHandle } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { dirname } from "node:path"
import { PassThrough, type Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import { promisify } from "node:util"
import { createInflateRaw, inflateRaw } from "node:zlib"

const END_OF_DIRECTORY = 0x06054b50
const DIRECTORY_ENTRY = 0x02014b50
const LOCAL_ENTRY = 0x04034b50
const MAX_COMMENT = 0xffff
const STORED = 0
const DEFLATED = 8
const inflate = promisify(inflateRaw)

export interface ZipEntry {
  name: string
  method: number
  compressedSize: number
  size: number
  localOffset: number
}

async function readAt(file: FileHandle, position: number, length: number) {
  const buffer = Buffer.alloc(length)
  const { bytesRead } = await file.read(buffer, 0, length, position)
  if (bytesRead !== length) throw new Error("ZIP file ended unexpectedly.")
  return buffer
}

export async function readZipDirectory(file: FileHandle): Promise<Map<string, ZipEntry>> {
  const { size } = await file.stat()
  const tailLength = Math.min(size, 22 + MAX_COMMENT)
  const tail = await readAt(file, size - tailLength, tailLength)
  let end = -1
  for (let index = tail.length - 22; index >= 0 && end < 0; index--)
    if (tail.readUInt32LE(index) === END_OF_DIRECTORY) end = index
  if (end < 0) throw new Error("ZIP end-of-directory record was not found.")
  const count = tail.readUInt16LE(end + 10)
  const directorySize = tail.readUInt32LE(end + 12)
  const directoryOffset = tail.readUInt32LE(end + 16)
  if (count === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff)
    throw new Error("ZIP64 archives are not supported.")
  const directory = await readAt(file, directoryOffset, directorySize)
  const entries = new Map<string, ZipEntry>()
  let position = 0
  for (let index = 0; index < count; index++) {
    if (directory.readUInt32LE(position) !== DIRECTORY_ENTRY) throw new Error("ZIP directory entry is invalid.")
    const nameLength = directory.readUInt16LE(position + 28)
    const extraLength = directory.readUInt16LE(position + 30)
    const commentLength = directory.readUInt16LE(position + 32)
    const name = directory.toString("utf8", position + 46, position + 46 + nameLength)
    entries.set(name, {
      name,
      method: directory.readUInt16LE(position + 10),
      compressedSize: directory.readUInt32LE(position + 20),
      size: directory.readUInt32LE(position + 24),
      localOffset: directory.readUInt32LE(position + 42),
    })
    position += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

/** Local headers may carry a different extra field than the directory, so the data offset is read from there. */
async function entryDataOffset(file: FileHandle, entry: ZipEntry) {
  const header = await readAt(file, entry.localOffset, 30)
  if (header.readUInt32LE(0) !== LOCAL_ENTRY) throw new Error(`ZIP entry ${entry.name} has an invalid header.`)
  return entry.localOffset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28)
}

export async function readZipEntry(file: FileHandle, entry: ZipEntry): Promise<Buffer> {
  const compressed = await readAt(file, await entryDataOffset(file, entry), entry.compressedSize)
  if (entry.method === STORED) return compressed
  if (entry.method === DEFLATED) return inflate(compressed)
  throw new Error(`ZIP entry ${entry.name} uses unsupported method ${entry.method}.`)
}

/**
 * Unpacks one archive stored inside another. The outer entries are deflated, so reading a single inner file always means
 * inflating the whole inner archive; keeping it on disk avoids repeating that for every image. The source is only read.
 */
export async function extractInnerArchive(outerPath: string, innerName: string, target: string): Promise<void> {
  const file = await open(outerPath, "r")
  let entry: ZipEntry | undefined
  let start: number
  try {
    entry = (await readZipDirectory(file)).get(innerName)
    if (!entry) throw new Error(`${innerName} is not in ${outerPath}.`)
    if (entry.method !== STORED && entry.method !== DEFLATED)
      throw new Error(`ZIP entry ${entry.name} uses unsupported method ${entry.method}.`)
    start = await entryDataOffset(file, entry)
  } finally {
    await file.close()
  }
  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.${randomUUID()}.tmp`
  const decoder: Transform = entry.method === DEFLATED ? createInflateRaw() : new PassThrough()
  try {
    await pipeline(
      createReadStream(outerPath, { start, end: start + entry.compressedSize - 1 }),
      decoder,
      createWriteStream(temporary),
    )
    if ((await stat(temporary)).size !== entry.size) throw new Error(`${innerName} was not fully extracted.`)
    await rename(temporary, target)
  } catch (failure) {
    await rm(temporary, { force: true })
    // Another dev server may have finished the same extraction first; Windows refuses to replace an open file.
    const existing = await stat(target).catch(() => null)
    if (existing?.size !== entry.size) throw failure
  }
}
