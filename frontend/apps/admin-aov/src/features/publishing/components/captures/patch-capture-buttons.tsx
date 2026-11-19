import { Images } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { usePatchCaptureContext } from "../../api/use-patch-captures"

/** Header toggle for the whole panel; hidden for an account that cannot open source files. */
export function PatchCaptureToggle() {
  const captures = usePatchCaptureContext()
  if (!captures || captures.state.status === "idle" || captures.state.status === "unavailable") return null
  const count = captures.groups.length ? captures.groups.flatMap((group) => group.images).length : null
  const label = captures.open ? "Đóng khung ảnh gốc" : "Mở khung ảnh gốc của tướng"
  return (
    <Button
      type="button"
      variant={captures.open ? "secondary" : "outline"}
      size="sm"
      className="shrink-0"
      aria-pressed={captures.open}
      aria-label={label}
      title={label}
      onClick={captures.toggle}
    >
      <Images className="size-4" />
      <span className="@max-5xl:sr-only">Ảnh gốc</span>
      {count !== null && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
    </Button>
  )
}

/** Sits beside one item so its own screenshots are a single click away; says so plainly when there are none. */
export function PatchCaptureLink({ groupKey, name, skinKey }: { groupKey: string; name: string; skinKey?: string }) {
  const captures = usePatchCaptureContext()
  const group = captures?.groups.find((item) => item.key === groupKey)
  if (!captures || !group) return null
  const own = skinKey ? group.images.filter((image) => image.skinKey === skinKey) : group.images
  const count = own.length
  const label = count ? `Xem ${count} ảnh gốc của ${name}` : `${name} không có ảnh gốc`
  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="shrink-0 text-muted-foreground"
      aria-label={label}
      title={label}
      onClick={() => captures.reveal(groupKey, own[0]?.id)}
    >
      <Images />
      {count ? <span className="tabular-nums">{count}</span> : "Không có ảnh"}
    </Button>
  )
}
