import { useId, useState, type KeyboardEvent } from "react"
import { CircleHelp } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@aov/ui/components/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"

type Props = { kind: "terminal" } | { kind: "external"; sourceGroup: string; selectedItem: string }

function explanation(props: Props) {
  switch (props.kind) {
    case "terminal":
      return {
        label: "Giải thích vùng trang bị hoàn chỉnh",
        title: "Vì sao là trang bị hoàn chỉnh?",
        text: "Các món này không dùng làm nguyên liệu và không tạo thành từ trang bị ở cột 3.",
      }
    case "external":
      return {
        label: `Giải thích vùng thuộc tính ${props.sourceGroup}`,
        title: `${props.sourceGroup} · Thuộc tính khác`,
        text: `Thuộc nhóm ${props.sourceGroup}, có quan hệ ghép với ${props.selectedItem}; hiển thị dưới đúng cột của nhóm nguồn.`,
      }
  }
}

export function ItemShopRegionHelp(props: Props) {
  const info = explanation(props)
  const titleId = useId()
  const [expanded, setExpanded] = useState(false)
  const [hint, setHint] = useState(false)
  function escape(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Escape" || (!expanded && !hint)) return
    event.stopPropagation()
    setExpanded(false)
    setHint(false)
  }
  return (
    <Popover
      open={expanded}
      onOpenChange={(open) => {
        setExpanded(open)
        setHint(false)
      }}
    >
      <Tooltip open={hint && !expanded} onOpenChange={setHint}>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={info.label}
              data-item-region-help
              onKeyDown={escape}
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring sm:size-6"
            >
              <CircleHelp aria-hidden className="size-3.5" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={6}
          collisionPadding={12}
          className="w-80 max-w-[calc(100vw-2rem)] space-y-1 text-left leading-relaxed"
        >
          <p className="font-semibold">{info.title}</p>
          <p>{info.text}</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        data-item-region-help
        aria-labelledby={titleId}
        align="start"
        sideOffset={6}
        collisionPadding={12}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onKeyDown={escape}
        className="w-80 max-w-[calc(100vw-2rem)] space-y-2 rounded-xl p-3 text-sm leading-relaxed"
      >
        <p id={titleId} className="font-semibold">
          {info.title}
        </p>
        <p className="text-muted-foreground">{info.text}</p>
      </PopoverContent>
    </Popover>
  )
}
