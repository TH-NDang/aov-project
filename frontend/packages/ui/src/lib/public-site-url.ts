/** Keep local navigation on the current host, including LAN and IPv6 addresses. */
export function publicSiteUrl(configuredUrl: string | undefined, port: number, currentOrigin: string): string {
  if (configuredUrl?.trim()) return new URL(configuredUrl.trim(), currentOrigin).href

  const target = new URL(currentOrigin)
  target.port = String(port)
  return target.href
}
