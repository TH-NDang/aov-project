/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WIKI_URL?: string
  /** "cloudflare" asks Cloudflare for resized copies of Media pictures; empty serves them at full size. */
  readonly VITE_IMAGE_RESIZE?: string
}
