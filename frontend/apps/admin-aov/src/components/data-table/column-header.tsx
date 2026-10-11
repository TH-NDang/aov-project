import type { RowData } from "@tanstack/react-table"
import type { DataColumn as Column } from "./table-features"
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@aov/ui/components/dropdown-menu"
import { cn } from "@aov/ui/lib/utils"

interface ColumnHeaderProps<TData extends RowData, TValue> {
  column: Column<TData, TValue>
  title: string
  className?: string
}

export function ColumnHeader<TData extends RowData, TValue>({
  column,
  title,
  className,
}: ColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) return <div className={className}>{title}</div>
  const sorted = column.getIsSorted()
  return (
    <div className={cn("flex items-center", className)}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="-ml-3 h-8 data-[state=open]:bg-accent">
            <span>{title}</span>
            {sorted === "desc" ? (
              <ArrowDown />
            ) : sorted === "asc" ? (
              <ArrowUp />
            ) : (
              <ChevronsUpDown className="opacity-50" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => column.toggleSorting(false)}>
            <ArrowUp /> Tăng dần
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => column.toggleSorting(true)}>
            <ArrowDown /> Giảm dần
          </DropdownMenuItem>
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => column.toggleVisibility(false)}>
                <EyeOff /> Ẩn cột
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
