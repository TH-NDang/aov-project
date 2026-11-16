import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { useSession } from "@/app/auth/auth-gate"
import { errorMessage } from "@/lib/api/errors"
import { videoApi, videoKeys } from "./video-api"
import { VideoFormDialog } from "./video-form-dialog"
import { VideoRow } from "./video-row"
import { usePatchCodes, useVideoActions } from "./use-video-actions"
import { capabilityFor, type AdminVideo, type VideoSubject } from "./video-model"

/**
 * Videos of one skill, managed beside that skill's text, so an editor sees what readers will watch and can add to it
 * without leaving for the Video tab. Saving takes effect at once and does not touch the hero draft.
 */
export function SkillVideosSection({
  heroId,
  skillKey,
  skillName,
}: {
  heroId: string
  skillKey: string
  skillName: string
}) {
  const filter = { subjectKind: "SKILL" as const, subjectId: heroId, subjectKey: skillKey, size: 50 }
  const list = useQuery({
    queryKey: videoKeys.list(filter),
    queryFn: ({ signal }) => videoApi.list(filter, signal),
  })
  const patchCodes = usePatchCodes()
  const actions = useVideoActions()
  const capabilities = useSession().actor?.capabilities ?? []
  const canAdd = capabilities.includes(capabilityFor("SKILL", "write"))
  const [form, setForm] = useState<{ video: AdminVideo | null } | null>(null)
  const videos = list.data?.items ?? []
  const subject: VideoSubject = { kind: "SKILL", id: heroId, key: skillKey, code: "", name: skillName, aliases: [] }

  return (
    <section className="grid gap-2 border-t pt-4" aria-label={`Video của ${skillName}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="type-label">Video kỹ năng{videos.length ? ` · ${videos.length}` : ""}</h5>
        <Button type="button" size="sm" variant="outline" disabled={!canAdd} onClick={() => setForm({ video: null })}>
          <Plus className="size-4" /> Thêm video
        </Button>
      </div>
      {[list.error, actions.error].filter(Boolean).map((failure, index) => (
        <p key={index} role="alert" className="type-meta text-destructive">
          {errorMessage(failure)}
        </p>
      ))}
      {list.isSuccess && !videos.length && (
        <p className="type-meta">
          Chưa có video. Dán liên kết YouTube, Facebook, TikTok, Twitch hoặc tệp .mp4 để người đọc xem ngay trong kỹ
          năng này.
        </p>
      )}
      {!!videos.length && (
        <ul className="grid gap-2">
          {videos.map((video) => (
            <VideoRow
              key={video.id}
              video={video}
              patchCode={video.patchVariantId ? patchCodes.get(video.patchVariantId) : undefined}
              busy={actions.busy}
              onEdit={() => setForm({ video })}
              onStatus={(status) => actions.setStatus.mutate({ video, status })}
              onDelete={() => actions.remove.mutate(video)}
              onMove={
                videos.length > 1 ? (direction) => actions.move.mutate({ videos, id: video.id, direction }) : undefined
              }
            />
          ))}
        </ul>
      )}
      <VideoFormDialog
        open={!!form}
        video={form?.video ?? null}
        subjects={[subject]}
        initialSubject={subject}
        onClose={() => setForm(null)}
      />
    </section>
  )
}
