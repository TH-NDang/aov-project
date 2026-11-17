import { useEffect, useMemo, useState } from "react"
import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { FileUp, Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@aov/ui/components/select"
import { useSession } from "@/app/auth/auth-gate"
import { Page, PageHeader } from "@/components/page-header"
import { SearchField } from "@/components/search-field"
import { useSearchParam } from "@/hooks/use-search-param"
import { errorMessage } from "@/lib/api/errors"
import { CrawlImportDialog } from "./crawl-import-dialog"
import { videoApi, videoKeys, type VideoFilter } from "./video-api"
import { VideoFormDialog } from "./video-form-dialog"
import { VideoRow } from "./video-row"
import { usePatchCodes, useVideoActions, useVideoSubjects } from "./use-video-actions"
import {
  KIND_LABELS,
  PURPOSE_LABELS,
  STATUS_LABELS,
  subjectLabel,
  type AdminVideo,
  type VideoPurpose,
  type VideoStatus,
  type VideoSubjectKind,
} from "./video-model"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { nextPageOf } from "@aov/ui/lib/page-slice"

const ALL = "ALL"
const PAGE_SIZE = 30
const STATUSES: VideoStatus[] = ["DRAFT", "PUBLISHED", "HIDDEN"]
const WRITE_CAPABILITIES = ["hero:write", "item:write", "enchantment:write", "arcana:write", "spell:write"]

/** Reviews what is waiting, finds any video across the catalog, and brings in collected data. */
export function VideosPage() {
  // Filters live in the URL, so a reload or a shared link keeps them.
  const [statusParam, setStatus] = useSearchParam("status", "DRAFT")
  const [kindParam, setKind] = useSearchParam("kind", ALL)
  const [purposeParam, setPurpose] = useSearchParam("purpose", ALL)
  const [query, setQuery] = useSearchParam("q")
  const status = statusParam as VideoStatus | typeof ALL
  const kind = kindParam as VideoSubjectKind | typeof ALL
  const purpose = purposeParam as VideoPurpose | typeof ALL
  const [search, setSearch] = useState(query)
  const [form, setForm] = useState<{ video: AdminVideo | null } | null>(null)
  const [importing, setImporting] = useState(false)
  const capabilities = useSession().actor?.capabilities ?? []
  const canWrite = WRITE_CAPABILITIES.some((capability) => capabilities.includes(capability))

  useEffect(() => {
    if (search.trim() === query) return
    const timer = setTimeout(() => setQuery(search.trim()), 250)
    return () => clearTimeout(timer)
  }, [search, query, setQuery])

  const filter: VideoFilter = {
    status: status === ALL ? undefined : status,
    subjectKind: kind === ALL ? undefined : kind,
    purpose: purpose === ALL ? undefined : purpose,
    q: query || undefined,
    size: PAGE_SIZE,
  }
  const list = useInfiniteQuery({
    queryKey: videoKeys.list(filter),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => videoApi.list({ ...filter, page: pageParam }, signal),
    getNextPageParam: nextPageOf,
    placeholderData: keepPreviousData,
  })
  const videos = list.data?.pages.flatMap((page) => page.items) ?? []
  const waitingFilter: VideoFilter = { status: "DRAFT", size: 1 }
  const waiting = useQuery({
    queryKey: videoKeys.list(waitingFilter),
    queryFn: ({ signal }) => videoApi.list(waitingFilter, signal),
  })
  const directory = useVideoSubjects()
  const patchCodes = usePatchCodes()
  const actions = useVideoActions()
  const subjects = useMemo(() => directory.data ?? [], [directory.data])

  const heroCounts = useMemo(() => {
    const counts = { heroes: 0, skins: 0 }
    for (const subject of subjects) {
      if (subject.kind === "HERO") counts.heroes++
      if (subject.kind === "SKIN") counts.skins++
    }
    return counts
  }, [subjects])

  return (
    <Page>
      <PageHeader
        title="Video"
        description="Video gắn vào tướng, kỹ năng, trang phục và kho trang bị."
        search={
          <SearchField
            placement="header"
            label="Tìm theo tiêu đề hoặc liên kết"
            placeholder="Tìm theo tiêu đề hoặc liên kết…"
            value={search}
            onChange={setSearch}
          />
        }
        actions={
          <>
            <Button type="button" variant="outline" disabled={!canWrite} onClick={() => setImporting(true)}>
              <FileUp className="size-4" /> Nhập dữ liệu thu thập
            </Button>
            <Button type="button" disabled={!canWrite || !subjects.length} onClick={() => setForm({ video: null })}>
              <Plus className="size-4" /> Thêm video
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <FilterTabs label="Trạng thái">
          {STATUSES.map((option) => (
            <FilterTab
              key={option}
              active={status === option}
              count={option === "DRAFT" ? waiting.data?.totalElements : undefined}
              onClick={() => setStatus(option)}
            >
              {STATUS_LABELS[option]}
            </FilterTab>
          ))}
          <FilterTab active={status === ALL} onClick={() => setStatus(ALL)}>
            Tất cả
          </FilterTab>
        </FilterTabs>
        <Select value={kind} onValueChange={(value) => setKind(value as VideoSubjectKind | typeof ALL)}>
          <SelectTrigger className="w-40" aria-label="Loại mục">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi loại mục</SelectItem>
            {(Object.keys(KIND_LABELS) as VideoSubjectKind[]).map((option) => (
              <SelectItem key={option} value={option}>
                {KIND_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={purpose} onValueChange={(value) => setPurpose(value as VideoPurpose | typeof ALL)}>
          <SelectTrigger className="w-48" aria-label="Loại video">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mọi loại video</SelectItem>
            {(Object.keys(PURPOSE_LABELS) as VideoPurpose[]).map((option) => (
              <SelectItem key={option} value={option}>
                {PURPOSE_LABELS[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {list.data && <p className="type-meta ml-auto self-center">{list.data.pages[0]?.totalElements ?? 0} video</p>}
      </div>

      {[list.error, actions.error, directory.error].filter(Boolean).map((failure, index) => (
        <p key={index} role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          {errorMessage(failure)}
        </p>
      ))}
      {list.isPending && <p className="type-meta">Đang tải video…</p>}
      {list.isSuccess && !videos.length && (
        <p className="rounded-lg border border-dashed p-8 text-center type-body">
          {status === "DRAFT" && !query ? "Không có video nào đang chờ duyệt." : "Không có video khớp bộ lọc."}
        </p>
      )}

      <ul className="grid gap-2">
        {videos.map((video) => (
          <VideoRow
            key={video.id}
            video={video}
            context={`${KIND_LABELS[video.subjectKind]} · ${subjectLabel(directory.data, video)}`}
            patchCode={video.patchVariantId ? patchCodes.get(video.patchVariantId) : undefined}
            busy={actions.busy}
            onEdit={() => setForm({ video })}
            onStatus={(next) => actions.setStatus.mutate({ video, status: next })}
            onDelete={() => actions.remove.mutate(video)}
          />
        ))}
      </ul>

      <InfiniteScroll query={list} label="Đang tải thêm video" />

      <VideoFormDialog
        open={!!form}
        video={form?.video ?? null}
        subjects={subjects}
        initialSubject={null}
        onClose={() => setForm(null)}
        showHero
      />
      <CrawlImportDialog
        open={importing}
        onClose={() => setImporting(false)}
        subjects={subjects}
        subjectSummary={`${heroCounts.heroes} tướng và ${heroCounts.skins} trang phục`}
      />
    </Page>
  )
}
