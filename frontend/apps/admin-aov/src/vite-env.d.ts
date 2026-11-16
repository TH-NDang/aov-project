/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "memory" keeps routing in memory for hosts that cannot change the URL (static demos). */
  readonly VITE_ROUTER?: "browser" | "memory"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
