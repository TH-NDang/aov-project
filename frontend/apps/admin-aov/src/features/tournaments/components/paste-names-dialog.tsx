import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { Check, CircleAlert } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { Textarea } from "@aov/ui/components/textarea"
import { cn } from "@aov/ui/lib/utils"
import { recordIcon, recordName } from "../model/record-reason"
import { goesByName, pastedNames } from "../model/roster-board-model"
import { tournamentApi, tournamentError, type PickerContext, type TournamentRecords } from "../api/tournament-api"
import { RegistryLogo } from "./registry-logo"

type Kind = "teams" | "players"
export type FoundRecord<K extends Kind = Kind> = { id: string; content: TournamentRecords[K]; name: string }

const NOUNS: Record<Kind, string> = { teams: "đội", players: "tuyển thủ" }

const namesOf = (kind: Kind, content: TournamentRecords[Kind]) => {
  if (kind === "teams") {
    const team = content as TournamentRecords["teams"]
    return [team.name, team.shortName, team.code, ...(team.aliases ?? [])]
  }
  const player = content as TournamentRecords["players"]
  return [player.nickname, player.fullName, player.code, ...(player.aliases ?? [])]
}

/**
 * Adds many records from a list of names, such as one copied from an announcement. Each name is looked up in the
 * registry; only a record that goes by exactly that name is taken, and the names left over are shown.
 */
export function PasteNamesDialog<K extends Kind>({
  kind,
  context,
  exclude,
  onAdd,
  onClose,
}: {
  kind: K
  context?: PickerContext
  /** Records already in the list. */
  exclude: readonly string[]
  onAdd: (records: FoundRecord<K>[]) => void
  onClose: () => void
}) {
  const [text, setText] = useState("")
  const names = pastedNames(text)
  const search = useMutation({
    mutationFn: async () => {
      const rows: { name: string; found?: FoundRecord<K> }[] = []
      for (const name of names) {
        const slice = await tournamentApi.pick(kind, { q: name, ...context })
        const match = slice.items.filter((row) => goesByName(name, namesOf(kind, row.content)))
        // Two records of one name are left to the editor, unless one belongs to the context.
        const row = match.length === 1 ? match[0] : match.find((item) => item.context)
        rows.push({ name, found: row && { id: row.id, content: row.content, name: recordName(kind, row.content) } })
      }
      return rows
    },
    meta: { silent: true },
  })
  const rows = search.data
  const fresh = [
    ...new Map(
      (rows ?? []).flatMap((row) => (row.found && !exclude.includes(row.found.id) ? [[row.found.id, row.found]] : [])),
    ).values(),
  ]
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="type-section-title">Dán danh sách {NOUNS[kind]}</DialogTitle>
          <DialogDescription className="type-meta">Mỗi dòng một tên, hoặc cách nhau bằng dấu phẩy.</DialogDescription>
        </DialogHeader>
        <Textarea
          rows={6}
          autoFocus
          aria-label={`Danh sách ${NOUNS[kind]}`}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            search.reset()
          }}
        />
        {rows && (
          <ul className="divide-y rounded-lg border">
            {rows.map(({ name, found }) => {
              const taken = !!found && exclude.includes(found.id)
              return (
                <li key={name} className="flex items-center gap-3 px-3 py-2">
                  {found ? (
                    <RegistryLogo
                      url={recordIcon(kind, found.content) ?? undefined}
                      name={found.name}
                      portrait={kind === "players"}
                    />
                  ) : (
                    <CircleAlert className="size-5 shrink-0 text-(--aov-warning)" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="type-body block truncate">{found?.name ?? name}</span>
                    <span className={cn("type-meta block", !found && "text-(--aov-warning)")}>
                      {found ? (taken ? "Đã có trong danh sách" : name) : "Chưa có hồ sơ mang đúng tên này"}
                    </span>
                  </span>
                  {found && !taken && <Check className="size-4 shrink-0 text-(--aov-success)" aria-hidden />}
                </li>
              )
            })}
          </ul>
        )}
        {search.error && (
          <p className="type-body text-destructive" role="alert">
            {tournamentError(search.error)}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Hủy
          </Button>
          {rows ? (
            <Button
              type="button"
              disabled={!fresh.length}
              onClick={() => {
                onAdd(fresh)
                onClose()
              }}
            >
              Thêm {fresh.length} {NOUNS[kind]}
            </Button>
          ) : (
            <Button type="button" disabled={!names.length || search.isPending} onClick={() => search.mutate()}>
              {search.isPending ? "Đang tìm…" : `Tìm ${names.length} tên`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
