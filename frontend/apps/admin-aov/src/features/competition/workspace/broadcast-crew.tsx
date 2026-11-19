import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import type { CrewMember, DocumentView, TournamentContent } from "@aov/community-contracts"
import { Mic, Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Section } from "@/features/community/components/profile-form-primitives"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { CrewEditor, CrewList } from "@/features/tournaments/components/crew-people"
import { MAX_TOURNAMENT_CREW } from "@/features/tournaments/model/crew-model"
import type { Workspace } from "./parts"

/** Who presented, cast and interviewed for the whole tournament; read-only until the edit button, written on save. */
export function BroadcastCrew({ ws, tournament }: { ws: Workspace; tournament?: DocumentView<TournamentContent> }) {
  const client = useQueryClient()
  const saved = tournament?.content.broadcast ?? []
  const [draft, setDraft] = useState<CrewMember[] | null>(null)
  const save = useMutation({
    mutationFn: (crew: CrewMember[]) =>
      tournamentApi.save("tournaments", tournament!, { ...tournament!.content, broadcast: crew }),
    meta: { silent: true, successMessage: "Đã lưu ê-kíp phát sóng." },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
      setDraft(null)
    },
  })
  const unchanged = JSON.stringify(draft) === JSON.stringify(saved)

  return (
    <Section
      title="Ê-kíp phát sóng"
      icon={Mic}
      action={
        ws.canEdit &&
        tournament &&
        !draft && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Sửa ê-kíp phát sóng"
            title="Sửa ê-kíp phát sóng"
            onClick={() => setDraft(saved)}
          >
            <Pencil size={16} />
          </Button>
        )
      }
    >
      {draft ? (
        <div className="space-y-4">
          <CrewEditor
            value={draft}
            onChange={setDraft}
            people={ws.entry.content.people}
            actorKey={ws.access.actorKey}
            max={MAX_TOURNAMENT_CREW}
            disabled={save.isPending}
          />
          {save.error && (
            <p role="alert" className="type-body text-destructive">
              {tournamentError(save.error)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={save.isPending || unchanged} onClick={() => save.mutate(draft)}>
              Lưu
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={save.isPending}
              onClick={() => {
                save.reset()
                setDraft(null)
              }}
            >
              Hủy
            </Button>
          </div>
        </div>
      ) : (
        <CrewList
          crew={saved}
          people={ws.entry.content.people}
          actorKey={ws.access.actorKey}
          empty={tournament ? "Chưa ghi nhận ê-kíp phát sóng." : "Đang tải ê-kíp phát sóng…"}
        />
      )}
    </Section>
  )
}
