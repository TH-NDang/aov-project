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
import { tournamentApi, tournamentError, tournamentKeys } from "../api/tournament-api"

/** Opens the editor of a tournament's final table. */
export function FinalTableEditButton({
  tournament,
  teamNames,
}: {
  tournament: DocumentView<TournamentContent>
  teamNames: { id: string; name: string }[]
}) {
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
      {editing && <FinalTableEditor tournament={tournament} teamNames={teamNames} onClose={() => setEditing(false)} />}
    </>
  )
}

const numberOrNull = (value: string) => {
  const parsed = Number(value.replace(",", "."))
  return value.trim() && Number.isFinite(parsed) ? parsed : null
}
const text = (value: number | null | undefined) => (value == null ? "" : String(value))

function FinalTableEditor({
  tournament,
  teamNames,
  onClose,
}: {
  tournament: DocumentView<TournamentContent>
  teamNames: { id: string; name: string }[]
  onClose: () => void
}) {
  const client = useQueryClient()
  const [placements, setPlacements] = useState<TournamentPlacement[]>(tournament.content.placements ?? [])
  const [awards, setAwards] = useState<TournamentAward[]>(tournament.content.awards ?? [])
  const [links, setLinks] = useState<TournamentLink[]>(tournament.content.links ?? [])
  const [currency, setCurrency] = useState(tournament.content.localCurrency ?? "")
  const save = useMutation({
    mutationFn: () => {
      const known = new Map(teamNames.map((entry) => [entry.name.toLocaleLowerCase(), entry.id]))
      return tournamentApi.save("tournaments", tournament, {
        ...tournament.content,
        localCurrency: currency.trim() || null,
        placements: placements
          .filter((line) => line.place.trim() && line.teamName.trim())
          .map((line) => ({ ...line, teamId: known.get(line.teamName.trim().toLocaleLowerCase()) ?? null })),
        awards: awards.filter((award) => award.title.trim() && award.recipientName.trim()),
        links: links.filter((link) => link.label.trim() && link.url.trim()),
      })
    },
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
  const update = <T,>(rows: T[], index: number, change: Partial<T>) =>
    rows.map((row, at) => (at === index ? { ...row, ...change } : row))
  const removeButton = (label: string, remove: () => void) => (
    <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={remove}>
      <X className="size-4" aria-hidden />
    </Button>
  )
  return (
    <Sheet open onOpenChange={(open) => !open && !save.isPending && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetTitle>Kết quả chung cuộc</SheetTitle>
        <SheetDescription>Bảng xếp hạng, giải thưởng và liên kết của {tournament.content.name}.</SheetDescription>
        <form className="mt-4 space-y-6" onSubmit={submit}>
          <datalist id="final-table-teams">
            {teamNames.map((entry) => (
              <option key={entry.id} value={entry.name} />
            ))}
          </datalist>
          <fieldset className="space-y-2">
            <legend className="type-section-title">Bảng xếp hạng</legend>
            <label className="type-label block max-w-48 space-y-1">
              <span>Đơn vị nội tệ</span>
              <Input value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={30} />
            </label>
            {placements.map((line, index) => (
              <div key={index} className="grid grid-cols-[72px_1fr_96px_96px_auto] items-center gap-2">
                <Input
                  aria-label="Hạng"
                  placeholder="Hạng"
                  value={line.place}
                  onChange={(event) => setPlacements(update(placements, index, { place: event.target.value }))}
                />
                <Input
                  aria-label="Đội"
                  placeholder="Đội"
                  list="final-table-teams"
                  value={line.teamName}
                  onChange={(event) => setPlacements(update(placements, index, { teamName: event.target.value }))}
                />
                <Input
                  aria-label="Tiền thưởng USD"
                  placeholder="USD"
                  inputMode="decimal"
                  value={text(line.prizeUsd)}
                  onChange={(event) =>
                    setPlacements(update(placements, index, { prizeUsd: numberOrNull(event.target.value) }))
                  }
                />
                <Input
                  aria-label="Tiền thưởng nội tệ"
                  placeholder="Nội tệ"
                  inputMode="decimal"
                  value={text(line.prizeLocal)}
                  onChange={(event) =>
                    setPlacements(update(placements, index, { prizeLocal: numberOrNull(event.target.value) }))
                  }
                />
                {removeButton(`Gỡ hạng ${line.place}`, () => setPlacements(placements.filter((_, at) => at !== index)))}
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
              <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
                <Input
                  aria-label="Tên giải thưởng"
                  placeholder="Giải thưởng"
                  value={award.title}
                  onChange={(event) => setAwards(update(awards, index, { title: event.target.value }))}
                />
                <Input
                  aria-label="Người nhận"
                  placeholder="Người nhận"
                  value={award.recipientName}
                  onChange={(event) => setAwards(update(awards, index, { recipientName: event.target.value }))}
                />
                <Input
                  aria-label="Đội của người nhận"
                  placeholder="Đội"
                  list="final-table-teams"
                  value={award.teamName ?? ""}
                  onChange={(event) => setAwards(update(awards, index, { teamName: event.target.value }))}
                />
                {removeButton(`Gỡ ${award.title}`, () => setAwards(awards.filter((_, at) => at !== index)))}
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
                  onChange={(event) => setLinks(update(links, index, { label: event.target.value }))}
                />
                <Input
                  aria-label="Địa chỉ liên kết"
                  placeholder="https://"
                  type="url"
                  value={link.url}
                  onChange={(event) => setLinks(update(links, index, { url: event.target.value }))}
                />
                {removeButton(`Gỡ ${link.label}`, () => setLinks(links.filter((_, at) => at !== index)))}
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
