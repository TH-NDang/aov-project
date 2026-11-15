import { lazy, Suspense } from "react"
import { useSearchParams } from "react-router"
import { ImageManagementPage } from "../media/image-management-page"
import { readFileTab } from "./file-tabs"

const SourceFilesPage = lazy(() =>
  import("./source-files-page").then((module) => ({ default: module.SourceFilesPage })),
)
const StoragePage = lazy(() => import("./storage-page").then((module) => ({ default: module.StoragePage })))

/** One entry point for every file of the project: public images, private source files and R2 usage. */
export function FileManagementPage() {
  const [params] = useSearchParams()
  const tab = readFileTab(params)
  if (tab === "images") return <ImageManagementPage />
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 type-body text-muted-foreground">
          Đang tải nội dung…
        </p>
      }
    >
      {tab === "sources" ? <SourceFilesPage /> : <StoragePage />}
    </Suspense>
  )
}
