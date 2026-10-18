import { lazy, Suspense } from "react"
import { PersistentWorkspace } from "./persistent-workspace"
const ImportWorkspace = lazy(() =>
  import("@/features/publishing/import-hero-page").then((module) => ({ default: module.ImportHeroWorkspace })),
)
/** The import runner stays outside route tabs and Activity so navigation never tears it down. */
export function ImportWorkspaceHost() {
  return (
    <PersistentWorkspace path="/publishing/import">
      <Suspense
        fallback={
          <p className="p-6" role="status">
            Đang mở import…
          </p>
        }
      >
        <ImportWorkspace />
      </Suspense>
    </PersistentWorkspace>
  )
}
