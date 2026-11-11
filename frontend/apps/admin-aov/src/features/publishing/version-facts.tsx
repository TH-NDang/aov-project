import type { ReactNode } from "react"
import { VERSION_CAUSES, type VersionCause } from "./version-causes"

/**
 * The version on screen as three labelled facts instead of one line joined by dots: which version it is, why it was
 * made (with what that means), and the patch it applies from.
 */
export function VersionFacts({ version, cause, patch }: { version: ReactNode; cause: string; patch: ReactNode }) {
  const meaning = VERSION_CAUSES[cause as VersionCause]
  const row = "grid gap-0.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4"
  return (
    <dl className="grid gap-3">
      {version && (
        <div className={row}>
          <dt className="type-label text-muted-foreground">Phiên bản</dt>
          <dd className="type-body">{version}</dd>
        </div>
      )}
      <div className={row}>
        <dt className="type-label text-muted-foreground">Lý do tạo</dt>
        <dd className="type-body">
          {meaning?.name ?? cause}
          {meaning?.note && <span className="type-meta block">{meaning.note}</span>}
        </dd>
      </div>
      <div className={row}>
        <dt className="type-label text-muted-foreground">Áp dụng từ</dt>
        <dd className="type-body min-w-0">{patch}</dd>
      </div>
    </dl>
  )
}
