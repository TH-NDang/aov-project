import type { DocumentView, TournamentContent, TournamentStatus } from "@aov/community-contracts"
import { CircleDot, CopyPlus, Layers, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { STATUS_LABELS } from "@/features/esports/model/labels"
import { STATUS_ORDER } from "../model/tournament-status"

type Entry = DocumentView<TournamentContent>

/** What an editor may do to a tournament from its row; a reader's list has none of it. */
export type TournamentRowActions = {
  duplicate: (entry: Entry) => void
  addPart: (entry: Entry) => void
  edit: (entry: Entry) => void
  changeStatus: (entry: Entry, status: TournamentStatus) => void
  trash: (entry: Entry) => void
}

export function TournamentRowMenu({ entry, actions }: { entry: Entry; actions: TournamentRowActions }) {
  const { name, status } = entry.content
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-9 text-muted-foreground"
          aria-label={`Thao tác với ${name}`}
          title="Thao tác"
        >
          <MoreHorizontal aria-hidden="true" className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onSelect={() => actions.duplicate(entry)}>
          <CopyPlus />
          Nhân bản thành mùa mới
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => actions.addPart(entry)}>
          <Layers />
          Thêm phần
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => actions.edit(entry)}>
          <Pencil />
          Sửa thông tin
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <CircleDot />
            Đổi trạng thái
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={status ?? "UNKNOWN"}>
              {STATUS_ORDER.map((value) => (
                <DropdownMenuRadioItem key={value} value={value} onSelect={() => actions.changeStatus(entry, value)}>
                  {STATUS_LABELS[value]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => actions.trash(entry)}>
          <Trash2 />
          Đưa vào thùng rác
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
