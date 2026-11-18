import { useRef, useState } from "react"
import { useSearchParams } from "react-router"
import { useQueryClient } from "@tanstack/react-query"
import {
  Archive,
  ChartColumn,
  Eraser,
  FileJson,
  FolderPlus,
  Gamepad2,
  Hammer,
  Pencil,
  RefreshCw,
  ScanFace,
  ShoppingBag,
  Trash2,
  Trophy,
  Upload,
} from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { DropdownMenuItem, DropdownMenuSeparator } from "@aov/ui/components/dropdown-menu"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { LocalTime } from "@aov/ui/components/local-time"
import { formatCalendarDate } from "@aov/ui/lib/time-zone"
import { cn } from "@aov/ui/lib/utils"
import { useSession } from "@/app/auth/auth-gate"
import { confirmAction } from "@/components/confirm-dialog"
import { MasterDetail } from "@/components/master-detail"
import { PageActionsMenu } from "@/components/page-actions-menu"
import { Page, PageHeader } from "@/components/page-header"
import { SearchField } from "@/components/search-field"
import { control } from "../publishing/components/fields"
import { CollectionFormSheet } from "./collection-form-sheet"
import { FileTabs } from "./file-tabs"
import {
  refreshSourceFiles,
  SOURCE_CATEGORIES,
  useDeleteCollection,
  useSourceCollection,
  useSourceCollections,
  useSourceFiles,
  useSourceLinks,
  type SourceCategory,
  type SourceCollection,
  type SourceFile,
} from "./files-api"
import { CATEGORY_HINTS, CATEGORY_LABELS, fileKind, formatCount, formatStorage } from "./files-format"
import { OrphansSheet } from "./orphans-sheet"
import { SourceFileSheet } from "./source-file-sheet"
import { SourceUploadDialog } from "./source-upload-dialog"
import { ErrorState, LoadingState } from "@/components/query-state"

export const CATEGORY_ICONS: Record<SourceCategory, typeof Archive> = {
  HERO_CAPTURE: ScanFace,
  SHOP_CAPTURE: ShoppingBag,
  BUILD_CAPTURE: Hammer,
  RANKING_CAPTURE: ChartColumn,
  GAME_MODE_SOURCE: Gamepad2,
  ESPORTS_SOURCE: Trophy,
  IMPORT_DATA: FileJson,
  ARCHIVE: Archive,
}

/**
 * Private source files by function (ADR-030 section 12): capture runs and import data, with their size and where they
 * are used. Images are shown through short-lived presigned links; nothing here is public.
 */
export function SourceFilesPage() {
  const [params, setParams] = useSearchParams()
  const category = (SOURCE_CATEGORIES as readonly string[]).includes(params.get("category") ?? "")
    ? (params.get("category") as SourceCategory)
    : null
  const query = params.get("q") ?? ""
  const selectedId = params.get("collection")
  const fileId = params.get("file")
  const writable = !!useSession().actor?.capabilities.includes("media:write")
  const client = useQueryClient()
  const [creating, setCreating] = useState(false)
  const collections = useSourceCollections(category, query)
  const rows = collections.data?.pages.flatMap((page) => page.items) ?? []
  const total = collections.data?.pages[0]?.totalElements ?? 0
  const listRef = useRef<HTMLDivElement>(null)

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes))
          if (value === null || value === "") next.delete(key)
          else next.set(key, value)
        return next
      },
      { preventScrollReset: true },
    )

  return (
    <Page className="min-h-0 gap-3 pb-0">
      <PageHeader
        title="Quản lý tệp"
        actions={
          <PageActionsMenu label="Tùy chọn tệp nguồn">
            {writable && (
              <>
                <DropdownMenuItem onSelect={() => setCreating(true)}>
                  <FolderPlus />
                  Tạo bộ tệp
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => update({ orphans: "1" })}>
                  <Eraser />
                  Dọn dữ liệu tệp mồ côi
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem disabled={collections.isFetching} onSelect={() => void refreshSourceFiles(client)}>
              <RefreshCw aria-hidden className={collections.isFetching ? "motion-safe:animate-spin" : undefined} />
              Làm mới
            </DropdownMenuItem>
          </PageActionsMenu>
        }
      >
        <FileTabs current="sources" />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2" role="region" aria-label="Bộ lọc tệp nguồn">
        <label className="flex items-center gap-2">
          <span className="type-label">Chức năng</span>
          <select
            className={cn(control, "w-auto min-w-48")}
            value={category ?? ""}
            onChange={(event) => update({ category: event.target.value || null, collection: null, file: null })}
          >
            <option value="">Tất cả chức năng</option>
            {SOURCE_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
        <SearchField
          value={query}
          onChange={(value) => update({ q: value || null })}
          placeholder="Tìm bộ tệp"
          label="Tìm bộ tệp"
        />
        <p className="type-meta" role="status">
          {collections.isPending ? "Đang tải…" : `${formatCount(total)} bộ`}
        </p>
      </div>

      <MasterDetail
        className="-mx-4 md:-mx-6"
        detailTitle="Bộ tệp"
        onCloseDetail={() => update({ collection: null, file: null })}
        detail={
          selectedId ? (
            <CollectionDetail
              collectionId={selectedId}
              writable={writable}
              onOpenFile={(id) => update({ file: id })}
              onDeleted={() => update({ collection: null, file: null })}
            />
          ) : null
        }
      >
        <div ref={listRef} className="grid content-start gap-2 px-4 pb-6 md:px-6">
          {collections.isLoadingError ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 p-3">
              <p className="type-body text-destructive">Không đọc được danh sách bộ tệp.</p>
              <Button variant="outline" size="sm" onClick={() => void collections.refetch()}>
                Thử tải lại
              </Button>
            </div>
          ) : !collections.isPending && rows.length === 0 ? (
            <EmptyCollections writable={writable} filtered={!!category || !!query} onCreate={() => setCreating(true)} />
          ) : (
            rows.map((collection, index) => (
              <div key={collection.id} className="grid gap-2">
                {(index === 0 || rows[index - 1].category !== collection.category) && (
                  <h2 className="mt-2 type-section-title">{CATEGORY_LABELS[collection.category]}</h2>
                )}
                <CollectionRow
                  collection={collection}
                  selected={collection.id === selectedId}
                  onOpen={() => update({ collection: collection.id, file: null })}
                />
              </div>
            ))
          )}
          <InfiniteScroll query={collections} label="bộ tệp" rootRef={listRef} />
        </div>
      </MasterDetail>

      <SourceFileSheet fileId={fileId} writable={writable} onClose={() => update({ file: null })} />
      <OrphansSheet
        open={params.get("orphans") === "1"}
        writable={writable}
        onClose={() => update({ orphans: null })}
      />
      <CollectionFormSheet
        open={creating}
        collection={null}
        onClose={() => setCreating(false)}
        onSaved={(saved) => {
          setCreating(false)
          update({ collection: saved.id, category: null, q: null })
        }}
      />
    </Page>
  )
}

function CollectionRow({
  collection,
  selected,
  onOpen,
}: {
  collection: SourceCollection
  selected: boolean
  onOpen: () => void
}) {
  const Icon = CATEGORY_ICONS[collection.category]
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "grid grid-cols-[2.5rem_1fr] items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        selected && "border-[var(--aov-accent)] bg-[var(--aov-accent-soft)]",
      )}
    >
      <span className="grid size-10 place-items-center rounded-md bg-[var(--aov-raised)]" aria-hidden>
        <Icon className="size-5" />
      </span>
      <span className="grid min-w-0 gap-0.5">
        <span className="truncate type-body">
          <strong>{collection.label}</strong>
        </span>
        <span className="flex flex-wrap gap-x-2 type-meta">
          <code className="truncate">{collection.code}</code>
          {collection.capturedOn && <span>Chụp {formatCalendarDate(collection.capturedOn)}</span>}
          <span className="tabular-nums">
            {formatCount(collection.fileCount)} tệp · {formatStorage(collection.totalBytes)}
          </span>
        </span>
      </span>
    </button>
  )
}

function EmptyCollections({
  writable,
  filtered,
  onCreate,
}: {
  writable: boolean
  filtered: boolean
  onCreate: () => void
}) {
  return (
    <div className="grid justify-items-start gap-2 rounded-lg border border-dashed p-6">
      <p className="type-body">{filtered ? "Không có bộ tệp nào khớp bộ lọc." : "Chưa có bộ tệp nguồn nào trên R2."}</p>
      {!filtered && (
        <p className="type-meta">
          Bộ tệp lớn (ảnh chụp theo patch, ZIP) được đẩy lên bằng công cụ đồng bộ dòng lệnh; tệp lẻ có thể tải lên tại
          đây.
        </p>
      )}
      {writable && !filtered && (
        <Button variant="outline" onClick={onCreate}>
          <FolderPlus />
          Tạo bộ tệp
        </Button>
      )}
    </div>
  )
}

function CollectionDetail({
  collectionId,
  writable,
  onOpenFile,
  onDeleted,
}: {
  collectionId: string
  writable: boolean
  onOpenFile: (id: string) => void
  onDeleted: () => void
}) {
  const collection = useSourceCollection(collectionId)
  const deletion = useDeleteCollection()
  const [query, setQuery] = useState("")
  const [uploading, setUploading] = useState(false)
  const [editing, setEditing] = useState(false)
  const files = useSourceFiles(collectionId, query)
  const rows = files.data?.pages.flatMap((page) => page.items) ?? []
  const images = rows.filter((file) => file.contentType.startsWith("image/")).slice(0, 200)
  const links = useSourceLinks(images.map((file) => file.sha256))
  const scrollRef = useRef<HTMLDivElement>(null)

  if (collection.isLoadingError)
    return (
      <ErrorState
        className="p-4"
        message="Không đọc được bộ tệp này; có thể bộ đã bị xóa."
        onRetry={() => void collection.refetch()}
      />
    )
  if (!collection.data) return <LoadingState className="p-4">Đang tải bộ tệp…</LoadingState>
  const current = collection.data
  const Icon = CATEGORY_ICONS[current.category]

  const remove = async () => {
    const accepted = await confirmAction({
      title: `Xóa bộ "${current.label}"?`,
      description: `${formatCount(current.fileCount)} tệp sẽ rời khỏi danh mục. Dữ liệu tệp vẫn nằm trên R2 và thành dữ liệu tệp mồ côi nếu không còn chỗ nào dùng; chỉ thao tác Dọn dữ liệu tệp mồ côi mới xóa hẳn.`,
      confirmLabel: "Xóa bộ",
    })
    if (!accepted) return
    deletion.mutate(current, { onSuccess: onDeleted })
  }

  return (
    <div ref={scrollRef} className="grid h-full content-start gap-4 overflow-y-auto p-4 md:p-5">
      <div className="grid gap-2">
        {/* The detail pane's close button sits over the top-right corner, so the menu and a long title stop short of it. */}
        <div className="flex items-start gap-3 pr-8">
          <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[var(--aov-raised)]" aria-hidden>
            <Icon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="type-section-title">{current.label}</h2>
            <p className="flex flex-wrap gap-x-2 type-meta">
              <Badge variant="outline">{CATEGORY_LABELS[current.category]}</Badge>
              <code>{current.code}</code>
              {current.capturedOn && <span>Chụp {formatCalendarDate(current.capturedOn)}</span>}
            </p>
          </div>
          {writable && (
            // Editing and deleting are rarer and riskier than uploading, so they wait behind a menu.
            <PageActionsMenu label="Tùy chọn bộ tệp">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil />
                Sửa thông tin
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={deletion.isPending} onSelect={() => void remove()}>
                <Trash2 />
                {deletion.isPending ? "Đang xóa…" : "Xóa bộ"}
              </DropdownMenuItem>
            </PageActionsMenu>
          )}
        </div>
        <p className="type-meta">{current.note ?? CATEGORY_HINTS[current.category]}</p>
        <p className="type-body tabular-nums">
          {formatCount(current.fileCount)} tệp · {formatStorage(current.totalBytes)} · cập nhật{" "}
          <LocalTime value={current.updatedAt} />
        </p>
        {writable && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setUploading(true)}>
              <Upload />
              Tải tệp lên
            </Button>
          </div>
        )}
      </div>

      <SearchField value={query} onChange={setQuery} placeholder="Tìm theo đường dẫn" label="Tìm tệp trong bộ" />
      {files.isLoadingError ? (
        <p role="alert" className="type-body text-destructive">
          Không đọc được danh sách tệp.
        </p>
      ) : (
        <ul className="grid gap-1" aria-label="Tệp trong bộ">
          {rows.map((file) => (
            <FileRow
              key={file.id}
              file={file}
              preview={links.data?.[file.sha256]?.url}
              onOpen={() => onOpenFile(file.id)}
            />
          ))}
          {!files.isPending && rows.length === 0 && (
            <li className="type-meta">{query ? "Không có tệp nào khớp." : "Bộ chưa có tệp nào."}</li>
          )}
        </ul>
      )}
      <InfiniteScroll query={files} label="tệp" rootRef={scrollRef} />

      <SourceUploadDialog open={uploading} collection={current} onClose={() => setUploading(false)} />
      <CollectionFormSheet
        open={editing}
        collection={current}
        onClose={() => setEditing(false)}
        onSaved={() => setEditing(false)}
      />
    </div>
  )
}

function FileRow({ file, preview, onOpen }: { file: SourceFile; preview: string | undefined; onOpen: () => void }) {
  const slash = file.path.lastIndexOf("/")
  const folder = slash < 0 ? "" : file.path.slice(0, slash + 1)
  const name = file.path.slice(slash + 1)
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="grid w-full grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 text-left hover:bg-accent/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <span className="grid size-12 place-items-center overflow-hidden rounded-md bg-[var(--aov-raised)]">
          {preview ? (
            <img src={preview} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <span className="type-meta">{fileKind(file.contentType).replace("Ảnh ", "")}</span>
          )}
        </span>
        <span className="grid min-w-0">
          <span className="truncate type-body">{name}</span>
          {folder && <span className="truncate type-meta">{folder}</span>}
        </span>
        <span className="type-meta tabular-nums">{formatStorage(file.sizeBytes)}</span>
      </button>
    </li>
  )
}
