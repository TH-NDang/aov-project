import type { ReactNode } from "react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@aov/ui/components/dropdown-menu"

/** The "…" menu at the end of a page header that holds create, import and setup actions. */
export function PageActionsMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="outline" className="size-9" aria-label={label} title={label}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
