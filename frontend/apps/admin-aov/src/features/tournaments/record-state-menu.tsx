import { Check, Ellipsis, List, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"

export function RecordStateMenu({ deleted, onChange }: { deleted: boolean; onChange: (deleted: boolean) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={deleted ? "secondary" : "ghost"}
          size="icon"
          aria-label="Trạng thái danh sách"
          title={deleted ? "Đang xem thùng rác" : "Trạng thái danh sách"}
        >
          {deleted ? <Trash2 size={16} /> : <Ellipsis size={17} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onChange(false)}>
          <List size={14} />
          Đang dùng{!deleted && <Check size={13} className="ml-auto" />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onChange(true)}>
          <Trash2 size={14} />
          Thùng rác{deleted && <Check size={13} className="ml-auto" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
