/** Local development mapping. Only validated, immutable asset paths can reach the filer. */
export function mediaPath(path: string, bucket: string) {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/.test(bucket)) throw new Error("Invalid media bucket")
  const match = /^\/media\/([a-f0-9-]{36})\/([a-f0-9-]{36}\.(?:png|jpg|webp))$/.exec(path)
  return match ? `/buckets/${bucket}/assets/${match[1]}/${match[2]}` : "/__invalid_public_asset__"
}
