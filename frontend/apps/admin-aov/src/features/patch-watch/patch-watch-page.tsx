import { useState } from "react"
import { Loader2, Plus, RefreshCw } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { FilterTab, FilterTabs } from "@aov/ui/components/filter-tabs"
import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { Page, PageHeader } from "@/components/page-header"
import { useSearchParam } from "@/hooks/use-search-param"
import { errorMessage } from "@/lib/api/errors"
import { AddPostDialog } from "./add-post-dialog"
import type { PatchNoteSource } from "./patch-watch-api"
import { STATE_LABELS, type PatchNotePostState } from "./patch-watch-model"
import { PostRow } from "./post-row"
import { ScheduleDialog } from "./schedule-dialog"
import { SourceCard } from "./source-card"
import { usePatchNotePosts, usePatchWatchAccess, usePatchWatchActions, usePatchWatchOverview } from "./use-patch-watch"
import "./patch-watch-page.css"

const ALL = "ALL"
const TABS: PatchNotePostState[] = ["NEW", "DONE", "DISMISSED", "EARLIER"]

function zoneLabel(zone: string | undefined) {
  return !zone || zone === "Asia/Ho_Chi_Minh" ? "giờ Việt Nam" : zone
}

/** New patch notes from the official sites and the test servers, and when each site is read. */
export function PatchWatchPage() {
  const [stateParam, setState] = useSearchParam("state", "NEW")
  const state = (TABS as string[]).includes(stateParam) ? (stateParam as PatchNotePostState) : null
  const { canWrite } = usePatchWatchAccess()
  const overview = usePatchWatchOverview()
  const posts = usePatchNotePosts(state)
  const actions = usePatchWatchActions()
  const [editing, setEditing] = useState<PatchNoteSource | null>(null)
  const [adding, setAdding] = useState(false)
  const items = posts.data?.pages.flatMap((page) => page.items) ?? []
  const zone = zoneLabel(overview.data?.zone)
  const failure = posts.isLoadingError ? posts.error : (overview.error ?? actions.error)

  return (
    <Page>
      <PageHeader
        title="Theo dõi cập nhật"
        description="Bài cập nhật mới từ trang chính thức và máy chủ thử nghiệm."
        actions={
          canWrite && (
            <>
              <Button type="button" variant="outline" onClick={() => setAdding(true)}>
                <Plus className="size-4" /> Thêm bài
              </Button>
              <Button type="button" disabled={actions.check.isPending} onClick={() => actions.check.mutate()}>
                {actions.check.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Kiểm tra ngay
              </Button>
            </>
          )
        }
      />

      {failure && (
        <p role="alert" className="rounded-lg border border-destructive/30 p-3 type-body text-destructive">
          {errorMessage(failure)}
        </p>
      )}

      <div className="pw-layout">
        <section className="pw-layout-sources" aria-labelledby="pw-sources-title">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="pw-sources-title" className="type-section-title">
              Nguồn
            </h2>
            {overview.data && !overview.data.scheduled && <span className="type-meta">Lịch tự động đang tắt</span>}
          </div>
          {overview.isPending && <p className="type-meta">Đang tải nguồn…</p>}
          <ul className="pw-sources">
            {overview.data?.sources.map((source) => (
              <SourceCard
                key={source.code}
                source={source}
                zoneLabel={zone}
                canWrite={canWrite}
                onEdit={() => setEditing(source)}
              />
            ))}
          </ul>
        </section>

        <section className="pw-layout-inbox" aria-label="Bài cập nhật">
          <FilterTabs label="Trạng thái">
            {TABS.map((option) => (
              <FilterTab
                key={option}
                active={state === option}
                count={option === "NEW" ? overview.data?.newCount : undefined}
                onClick={() => setState(option)}
              >
                {STATE_LABELS[option]}
              </FilterTab>
            ))}
            <FilterTab active={state === null} onClick={() => setState(ALL)}>
              Tất cả
            </FilterTab>
          </FilterTabs>

          {posts.isPending && <p className="type-meta">Đang tải bài…</p>}
          {posts.isSuccess && !items.length && (
            <p className="rounded-lg border border-dashed p-8 text-center type-body">
              {state === "NEW" ? "Chưa có bài mới." : "Không có bài nào ở đây."}
            </p>
          )}
          <ul className="pw-posts">
            {items.map((post) => (
              <PostRow
                key={post.id}
                post={post}
                canWrite={canWrite}
                busy={actions.move.isPending}
                onMove={(next) => actions.move.mutate({ post, state: next })}
              />
            ))}
          </ul>
          <InfiniteScroll query={posts} label="Đang tải thêm bài" />
        </section>
      </div>

      <ScheduleDialog source={editing} zoneLabel={zone} onClose={() => setEditing(null)} />
      <AddPostDialog open={adding} onClose={() => setAdding(false)} />
    </Page>
  )
}
