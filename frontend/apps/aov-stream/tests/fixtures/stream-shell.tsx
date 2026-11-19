/** Stands in for `src/components/stream-shell.tsx`: the page content without the portal's top bar. */
import type { ReactNode } from "react"

export const WIKI_URL = "http://localhost:5173"
export const ADMIN_URL = "http://localhost:5175"

export function StreamShell({ children, aside, lead }: { children: ReactNode; aside?: ReactNode; lead?: ReactNode }) {
  return (
    <main>
      {lead}
      {children}
      {aside}
    </main>
  )
}
