import { useState, type FormEvent } from "react"
import type {
  DocumentView,
  TournamentAward,
  TournamentContent,
  TournamentLink,
  TournamentPlacement,
} from "@aov/community-contracts"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Pencil, Plus, Save, X } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@aov/ui/components/sheet"
import { confirmAction } from "@/components/confirm-dialog"
import { tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"
import {
  awardRecipient,
  awardTeam,
  finalTableToSave,
  placementTeam,
  withAwardRecipient,
  withAwardTeam,
  withPlacementTeam,
} from "../model/final-table-model"
import { LinkedNameField } from "./linked-name-field"

/** Opens the editor of a tournament's final table. */
export function FinalTableEditButton({ tournament }: { tournament: DocumentView<TournamentContent> }) {
  const [editing, setEditing] = useState(false)
  const { placements, awards, links } = tournament.content
  const empty = !placements?.length && !awards?.length && !links?.length
  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setEditing(true)}
      >
        <Pencil className="size-3.5" aria-hidden />
        {empty ? "Thêm" : "Sửa"}
      </button>
      {editing && <FinalTableEditor tournament={tournament} onClose={() => setEditing(false)} />}
    </>
  )
}

const numberOrNull = (value: string) => {
  const parsed = Number(value.replace(",", "."))
  return value.trim() && Number.isFinite(parsed) ? parsed : null
}
const text = (value: number | null | undefined) => (value == null ? "" : String(value))
const shownText = (...parts: (string | null | undefined)[]) =>
  parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" · ")

/**
 * Teams and recipients are picked from the records, so the table links them; a name with no record is written as
 * text, and writing another name over a linked one takes the link off.
 */
function FinalTableEditor({
  tournament,
  onClose,
}: {
  tournament: DocumentView<TournamentContent>
  onClose: () => void
}) {
  const client = useQueryClient()
  const tournamentId = tournament.id
  const [placements, setPlacements] = useState<TournamentPlacement[]>(tournament.content.placements ?? [])
  const [awards, setAwards] = useState<TournamentAward[]>(tournament.content.awards ?? [])
  const [links, setLinks] = useState<TournamentLink[]>(tournament.content.links ?? [])
  const [currency, setCurrency] = useState(tournament.content.localCurrency ?? "")
  const save = useMutation({
    mutationFn: () =>
      tournamentApi.save("tournaments", tournament, {
        ...tournament.content,
        localCurrency: currency.trim() || null,
        ...finalTableToSave(placements, awards, links),
      }),
    meta: { silent: true, successMessage: "Đã lưu bảng kết quả." },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: tournamentKeys.all })
      onClose()
    },
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }
  const update = <T,>(rows: T[], index: number, change: (row: T) => T) =>
    rows.map((row, at) => (at === index ? change(row) : row))
  /** `shown` is what the line holds; an empty line goes at once, one with content only after a question. */
  const removeButton = (label: string, shown: string, remove: () => void) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      onClick={async () => {
        const confirmed =
          !shown ||
          (await confirmAction({
            title: `${label}?`,
            description: `${shown} → không còn trong bảng khi bạn bấm Lưu.`,
            confirmLabel: "Gỡ",
          }))
        if (confirmed) remove()
      }}
    >
      <X className="size-4" aria-hidden />
    </Button>
  )
  const placedTeams = (index: number) =>
    placements.flatMap((line, at) => (line.teamId && at !== index ? [line.teamId] : []))
  return (
    <Sheet open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetTitle>Kết quả chung cuộc</SheetTitle>
        <SheetDescription>Bảng xếp hạng, giải thưởng và liên kết của {tournament.content.name}.</SheetDescription>
        <form className="mt-4 space-y-6" onSubmit={submit}>
          <fieldset className="space-y-2">
            <legend className="type-section-title">Bảng xếp hạng</legend>
            <label className="type-label block max-w-48 space-y-1">
              <span>Đơn vị nội tệ</span>
              <Input value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={30} />
            </label>
            {placements.map((line, index) => (
              <div key={index} className="grid grid-cols-[72px_minmax(0,1fr)_96px_96px_auto] items-center gap-2">
                <Input
                  aria-label="Hạng"
                  placeholder="Hạng"
                  value={line.place}
                  onChange={(event) =>
                    setPlacements(update(placements, index, (row) => ({ ...row, place: event.target.value })))
                  }
                />
                <LinkedNameField
                  kind="teams"
                  value={placementTeam(line)}
                  textLabel="Đội"
                  pickerLabel="Đội"
                  context={{ tournamentId }}
                  exclude={placedTeams(index)}
                  onChange={(team) => setPlacements(update(placements, index, (row) => withPlacementTeam(row, team)))}
                />
                <Input
                  aria-label="Tiền thưởng USD"
                  placeholder="USD"
                  inputMode="decimal"
                  value={text(line.prizeUsd)}
                  onChange={(event) =>
                    setPlacements(
                      update(placements, index, (row) => ({ ...row, prizeUsd: numberOrNull(event.target.value) })),
                    )
                  }
                />
                <Input
                  aria-label="Tiền thưởng nội tệ"
                  placeholder="Nội tệ"
                  inputMode="decimal"
                  value={text(line.prizeLocal)}
                  onChange={(event) =>
                    setPlacements(
                      update(placements, index, (row) => ({ ...row, prizeLocal: numberOrNull(event.target.value) })),
                    )
                  }
                />
                {removeButton(`Gỡ hạng ${line.place}`, shownText(line.place, line.teamName), () =>
                  setPlacements(placements.filter((_, at) => at !== index)),
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPlacements([...placements, { place: "", teamName: "" }])}
            >
              <Plus className="size-4" aria-hidden />
              Thêm hạng
            </Button>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="type-section-title">Giải thưởng</legend>
            {awards.map((award, index) => (
              <div key={index} className="space-y-2 rounded-lg border p-2">
                <div className="flex items-center gap-2">
                  <Input
                    aria-label="Tên giải thưởng"
                    placeholder="Giải thưởng"
                    value={award.title}
                    onChange={(event) =>
                      setAwards(update(awards, index, (row) => ({ ...row, title: event.target.value })))
                    }
                  />
                  {removeButton(`Gỡ ${award.title || "giải thưởng"}`, shownText(award.title, award.recipientName), () =>
                    setAwards(awards.filter((_, at) => at !== index)),
                  )}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <LinkedNameField
                    kind="players"
                    value={awardRecipient(award)}
                    textLabel="Người nhận"
                    pickerLabel="Tuyển thủ"
                    context={{ tournamentId, teamId: award.teamId || undefined }}
                    onChange={(recipient) =>
                      setAwards(update(awards, index, (row) => withAwardRecipient(row, recipient)))
                    }
                  />
                  <LinkedNameField
                    kind="teams"
                    value={awardTeam(award)}
                    textLabel="Đội của người nhận"
                    pickerLabel="Đội"
                    context={{ tournamentId }}
                    onChange={(team) => setAwards(update(awards, index, (row) => withAwardTeam(row, team)))}
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAwards([...awards, { title: "", recipientName: "" }])}
            >
              <Plus className="size-4" aria-hidden />
              Thêm giải thưởng
            </Button>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="type-section-title">Liên kết</legend>
            {links.map((link, index) => (
              <div key={index} className="grid grid-cols-[160px_1fr_auto] items-center gap-2">
                <Input
                  aria-label="Tên liên kết"
                  placeholder="Tên"
                  value={link.label}
                  onChange={(event) => setLinks(update(links, index, (row) => ({ ...row, label: event.target.value })))}
                />
                <Input
                  aria-label="Địa chỉ liên kết"
                  placeholder="https://"
                  type="url"
                  value={link.url}
                  onChange={(event) => setLinks(update(links, index, (row) => ({ ...row, url: event.target.value })))}
                />
                {removeButton(`Gỡ ${link.label || "liên kết"}`, shownText(link.label, link.url), () =>
                  setLinks(links.filter((_, at) => at !== index)),
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLinks([...links, { label: "", url: "" }])}
            >
              <Plus className="size-4" aria-hidden />
              Thêm liên kết
            </Button>
          </fieldset>
          {save.isError && (
            <p role="alert" className="type-body text-destructive">
              {tournamentError(save.error)}
            </p>
          )}
          <Button type="submit" disabled={save.isPending}>
            <Save className="size-4" aria-hidden />
            Lưu
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
