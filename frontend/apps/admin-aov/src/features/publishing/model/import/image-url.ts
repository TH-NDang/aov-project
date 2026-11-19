import { MAX_IMAGE_BYTES, UPLOAD_IMAGE_TYPES } from "@/lib/image-types"
/** Download directly in the browser; never forward API credentials to an image host. */
export async function imageFromUrl(input: string): Promise<File> {
  const url = new URL(input)
  if (url.protocol !== "https:") throw new Error("Liên kết ảnh phải dùng HTTPS.")
  if (url.username || url.password) throw new Error("Liên kết ảnh không được chứa tài khoản hoặc mật khẩu.")
  const response = await fetch(url, {
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    signal: AbortSignal.timeout(30000),
  }).catch(() => {
    throw new Error(
      "Nguồn ảnh không cho tải trực tiếp (CORS), chuyển hướng hoặc đã hết thời gian. Hãy tải ảnh về máy rồi chọn tệp.",
    )
  })
  if (!response.ok || !response.body) throw new Error("Không tải được ảnh từ liên kết.")
  const type = response.headers.get("content-type")?.split(";")[0] ?? ""
  if (!UPLOAD_IMAGE_TYPES.includes(type)) throw new Error("Liên kết phải trỏ trực tiếp tới ảnh PNG, JPEG hoặc WebP.")
  const limit = MAX_IMAGE_BYTES
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > limit) throw new Error("Ảnh vượt quá 25 MB.")
      chunks.push(new Uint8Array(value))
    }
  } finally {
    await reader.cancel()
  }
  return new File(chunks, `import.${type === "image/jpeg" ? "jpg" : type.split("/")[1]}`, { type })
}
