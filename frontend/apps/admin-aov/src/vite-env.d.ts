/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "memory" keeps routing in memory for hosts that cannot change the URL (static demos). */
  readonly VITE_ROUTER?: "browser" | "memory"
  /** Base URL of the working data set; defaults to the dev middleware mount. */
  readonly VITE_RESOURCES_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
