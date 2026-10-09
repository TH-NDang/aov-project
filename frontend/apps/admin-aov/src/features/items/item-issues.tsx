import { useState } from "react"
import { Badge } from "@aov/ui/components/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@aov/ui/components/table"
import { ToggleGroup, ToggleGroupItem } from "@aov/ui/components/toggle-group"
import type { Item, ItemIssue, ItemIssueCode } from "@/lib/api/types"
import { MediaImage } from "@/components/media-image"
import { ISSUE_LABEL } from "@/lib/domain/items"

interface ItemIssuesProps {
  issues: ItemIssue[]
  items: Item[]
  selectedId: string | null
  onSelect: (itemId: string) => void
}

export function ItemIssues({ issues, items, selectedId, onSelect }: ItemIssuesProps) {
  const [code, setCode] = useState<"all" | ItemIssueCode>("all")
  const byId = new Map(items.map((item) => [item.id, item]))
  const codes = Object.keys(ISSUE_LABEL) as ItemIssueCode[]
  const visible = issues.filter((issue) => code === "all" || issue.code === code)

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Khác biệt giữa bảng Excel và dữ liệu Garena khi thu thập. Bấm tên trang bị để mở chi tiết và sửa.
      </p>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        spacing={1}
        value={code}
        onValueChange={(value) => value && setCode(value as typeof code)}
        className="flex-wrap"
      >
        <ToggleGroupItem value="all">
          Tất cả{" "}
          <Badge variant="secondary" className="h-5 px-1.5">
            {issues.length}
          </Badge>
        </ToggleGroupItem>
        {codes.map((value) => (
          <ToggleGroupItem key={value} value={value}>
            {ISSUE_LABEL[value]}{" "}
            <Badge variant="secondary" className="h-5 px-1.5">
              {issues.filter((issue) => issue.code === value).length}
            </Badge>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-36">Loại</TableHead>
              <TableHead>Trang bị</TableHead>
              <TableHead>Chi tiết</TableHead>
              <TableHead className="w-20">Ô Excel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((issue) => (
              <TableRow key={issue.id} data-state={issue.itemIds.includes(selectedId ?? "") ? "selected" : undefined}>
                <TableCell>
                  <Badge variant="outline">{ISSUE_LABEL[issue.code]}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1.5">
                    {issue.itemIds.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => onSelect(id)}
                        className="flex items-center gap-1.5 rounded-md border px-1.5 py-1 text-sm hover:bg-accent"
                      >
                        <MediaImage path={byId.get(id)?.image} className="size-5 object-contain" />
                        {byId.get(id)?.name ?? id}
                      </button>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-sm whitespace-normal">
                  <p>{issue.message}</p>
                  {issue.excelLevel !== undefined && (
                    <p className="text-xs text-muted-foreground">
                      Excel cấp {issue.excelLevel} · Garena cấp {issue.garenaLevel}
                    </p>
                  )}
                  {issue.position && (
                    <p className="text-xs text-muted-foreground">
                      {issue.position.group} · hàng {issue.position.row}, cột {issue.position.column}
                    </p>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">{issue.excelCell ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
