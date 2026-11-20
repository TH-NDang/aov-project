import { useState } from "react"
import { useNavigate } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { confirmAction } from "@/components/confirm-dialog"
import { RecordPicker } from "@/features/tournaments/components/record-picker"
import { tournamentApi, tournamentError, tournamentKeys } from "@/features/tournaments/api/tournament-api"
import { pageKeys } from "../api/page-api"

/**
 * Folds this player into another profile of the same person (spec 04, merging players): roster lines, seats, MVPs
 * and awards move over, its names become aliases and this profile goes to the trash.
 */
export function MergePlayerSheet({ playerId, name, onClose }: { playerId: string; name: string; onClose: () => void }) {
  const client = useQueryClient()
  const navigate = useNavigate()
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null)
  const merge = useMutation({
    mutationFn: (intoId: string) => tournamentApi.mergePlayer(playerId, intoId),
    meta: { silent: true },
    onSuccess: async (result) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: tournamentKeys.all }),
        client.invalidateQueries({ queryKey: pageKeys.all }),
      ])
      const { rosterLines, repeatedRosterLines, games } = result.moved
      toast.success(
        `Đã gộp vào ${result.player.content.nickname}: ${rosterLines + repeatedRosterLines} dòng đội hình, ${games} ván.`,
      )
      onClose()
      void navigate(`/players?q=${encodeURIComponent(result.player.content.nickname)}`)
    },
  })
  async function submit() {
    if (!target) return
    const confirmed = await confirmAction({
      title: `Gộp “${name}” vào “${target.name}”?`,
      description:
        "Đội hình, ghế trong ván, MVP và giải thưởng chuyển sang hồ sơ được giữ. Tên của hồ sơ này thành tên gọi khác, rồi hồ sơ này vào thùng rác. Khôi phục hồ sơ sau đó không trả lại những gì đã chuyển.",
      confirmLabel: "Gộp hồ sơ",
    })
    if (confirmed) merge.mutate(target.id)
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !merge.isPending) onClose()
      }}
    >
      <SheetContent className="overflow-y-auto sm:max-w-lg" showCloseButton={!merge.isPending}>
        <SheetHeader>
          <SheetTitle>Gộp vào hồ sơ khác</SheetTitle>
          <SheetDescription>Dùng khi một người có hai hồ sơ, ví dụ "{name}" và một cách viết khác.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 py-6">
          <label className="grid gap-1.5">
            <span className="type-label">Hồ sơ được giữ</span>
            <RecordPicker
              kind="players"
              label="Hồ sơ được giữ"
              placeholder="Tìm tuyển thủ"
              value={target?.id ?? null}
              exclude={[playerId]}
              disabled={merge.isPending}
              onChange={(id, chosen) => setTarget(id ? { id, name: chosen } : null)}
            />
          </label>
          {merge.isError && (
            <p role="alert" className="type-body text-destructive">
              {tournamentError(merge.error)}
            </p>
          )}
          <Button type="button" disabled={!target || merge.isPending} onClick={() => void submit()}>
            {merge.isPending ? "Đang gộp…" : "Gộp hồ sơ"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
