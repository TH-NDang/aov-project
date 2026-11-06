import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Clapperboard, Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { useSession } from "@/app/auth/auth-gate"
import { errorMessage } from "@/lib/api/errors"
import { videoApi, videoKeys } from "./video-api"
import { VideoFormDialog } from "./video-form-dialog"
import { VideoRow } from "./video-row"
import { usePatchCodes, useVideoActions, useVideoSubjects } from "./use-video-actions"
import {
  capabilityFor,
  KIND_LABELS,
  subjectId,
  videoSubjectId,
  type AdminVideo,
  type VideoSubject,
  type VideoSubjectKind,
} from "./video-model"

interface VideoGroup {
  id: string
  label: string
  subject: VideoSubject | null
  videos: AdminVideo[]
}

/** The subject's own videos come first, then one group per skill and skin that has any. */
function groupVideos(videos: readonly AdminVideo[], subjects: readonly VideoSubject[]): VideoGroup[] {
  const groups = new Map<string, VideoGroup>()
  for (const video of videos) {
    const id = videoSubjectId(video)
    let group = groups.get(id)
    if (!group) {
      const subject = subjects.find((candidate) => subjectId(candidate) === id) ?? null
      const name = video.subjectKey ? (subject?.name ?? video.subjectKey) : null
      group = {
        id,
        subject,
        label: name
          ? `${KIND_LABELS[video.subjectKind]} · ${name}`
          : `Video của ${KIND_LABELS[video.subjectKind].toLowerCase()}`,
        videos: [],
      }
      groups.set(id, group)
    }
    group.videos.push(video)
  }
  const rank = (group: VideoGroup) =>
    group.videos[0].subjectKind === "SKILL" ? 1 : group.videos[0].subjectKind === "SKIN" ? 2 : 0
  return [...groups.values()].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, "vi"))
}

/**
 * Manages every video of one catalog entry. A hero's panel also covers its skills and skins, so an editor sees them all
 * in one place and can pick the exact target when adding.
 */
export function SubjectVideosPanel({
  kind,
  id,
  name,
}: {
  kind: VideoSubjectKind
  id: string
  /** Shown before the subject directory has loaded, or for an entry too new to be listed. */
  name: string
}) {
  const filter = { subjectKind: kind, subjectId: id, size: 100 }
  const list = useQuery({
    queryKey: videoKeys.list(filter),
    queryFn: ({ signal }) => videoApi.list(filter, signal),
  })
  const directory = useVideoSubjects()
  const patchCodes = usePatchCodes()
  const actions = useVideoActions()
  const capabilities = useSession().actor?.capabilities ?? []
  const canAdd = capabilities.includes(capabilityFor(kind, "write"))
  const [form, setForm] = useState<{ video: AdminVideo | null; subject: VideoSubject | null } | null>(null)

  const subjects = useMemo(() => {
    const own = (directory.data ?? []).filter((subject) => subject.id === id)
    return own.length ? own : [{ kind, id, key: null, code: "", name, aliases: [] }]
  }, [directory.data, id, kind, name])
  const groups = useMemo(() => groupVideos(list.data?.items ?? [], subjects), [list.data, subjects])
  const ownSubject = subjects.find((subject) => subject.kind === kind) ?? subjects[0]

  return (
    <section className="grid gap-4" aria-label="Video">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="type-section-title">Video</h2>
          <p className="type-meta">
            {kind === "HERO"
              ? "Gắn nhiều video cho tướng, từng kỹ năng hoặc từng trang phục. Có hiệu lực ngay, không cần xuất bản lại tướng."
              : "Có hiệu lực ngay, không cần xuất bản lại mục này."}
          </p>
        </div>
        <Button type="button" disabled={!canAdd} onClick={() => setForm({ video: null, subject: ownSubject })}>
          <Plus className="size-4" /> Thêm video
        </Button>
      </header>

      {[list.error, actions.error].filter(Boolean).map((failure, index) => (
        <p key={index} role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm text-destructive">
          {errorMessage(failure)}
        </p>
      ))}
      {list.isPending && <p className="type-meta">Đang tải video…</p>}
      {list.isSuccess && !groups.length && (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
          <Clapperboard className="size-6 text-muted-foreground" />
          <p className="type-body">Chưa có video nào.</p>
          <p className="type-meta">
            {kind === "HERO"
              ? "Thêm video cách chơi, combo, cốt truyện hoặc thay đổi sau một bản cập nhật."
              : "Thêm video hướng dẫn hoặc thay đổi sau một bản cập nhật."}
          </p>
        </div>
      )}

      {groups.map((group) => (
        <section key={group.id} className="grid gap-2" aria-label={group.label}>
          <h3 className="type-label">
            {group.label} · {group.videos.length}
          </h3>
          <ul className="grid gap-2">
            {group.videos.map((video) => (
              <VideoRow
                key={video.id}
                video={video}
                patchCode={video.patchVariantId ? patchCodes.get(video.patchVariantId) : undefined}
                busy={actions.busy}
                onEdit={() => setForm({ video, subject: group.subject })}
                onStatus={(status) => actions.setStatus.mutate({ video, status })}
                onDelete={() => actions.remove.mutate(video)}
                onMove={
                  group.videos.length > 1
                    ? (direction) => actions.move.mutate({ videos: group.videos, id: video.id, direction })
                    : undefined
                }
              />
            ))}
          </ul>
        </section>
      ))}

      <VideoFormDialog
        open={!!form}
        video={form?.video ?? null}
        subjects={subjects}
        initialSubject={form?.subject ?? ownSubject}
        onClose={() => setForm(null)}
      />
    </section>
  )
}
