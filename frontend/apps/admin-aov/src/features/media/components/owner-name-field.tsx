import { useId, type ComponentProps } from "react"
import { Copyright } from "lucide-react"
import { cn } from "@aov/ui/lib/utils"
import { useMediaOwners } from "./media-owners"
import { similarOwner } from "@/features/media/model/media-owner-names"

const quickPicks = 3

/** A free-text owner input that suggests the owners already in the catalog. */
export function OwnerNameInput({
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange" | "list"> & {
  value: string
  onValueChange: (value: string) => void
}) {
  const listId = useId()
  const owners = useMediaOwners().data ?? []
  return (
    <>
      <input
        {...props}
        list={owners.length ? listId : undefined}
        maxLength={200}
        autoComplete="off"
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
      {owners.length > 0 && (
        <datalist id={listId}>
          {/* A label attribute keeps the option text out of the surrounding label's text. */}
          {owners.map((owner) => (
            <option key={owner.id} value={owner.name} label={`${owner.assetCount} ảnh`} />
          ))}
        </datalist>
      )}
    </>
  )
}

/**
 * Keeps one spelling per owner: offers the most used owners while the field is empty and asks before saving a name
 * that only looks like an existing one. Never fills the field by itself.
 */
export function OwnerNameHints({
  value,
  onPick,
  disabled = false,
  showQuickPicks = true,
  className,
}: {
  value: string
  onPick: (name: string) => void
  disabled?: boolean
  showQuickPicks?: boolean
  className?: string
}) {
  const owners = useMediaOwners().data ?? []
  const similar = value.trim() ? similarOwner(value, owners) : undefined
  const picks = showQuickPicks && !value.trim() ? owners.slice(0, quickPicks) : []
  if (!similar && !picks.length) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {similar ? (
        <p role="status" className="type-meta flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-(--aov-warning)">
            Gần giống chủ sở hữu đã có: <span className="font-semibold">{similar.name}</span>
          </span>
          <button
            type="button"
            disabled={disabled}
            className="font-medium text-primary hover:underline disabled:opacity-50"
            onClick={() => onPick(similar.name)}
          >
            Dùng tên này
          </button>
        </p>
      ) : (
        <>
          <span className="type-meta">Đã dùng:</span>
          {picks.map((owner) => (
            <button
              key={owner.id}
              type="button"
              disabled={disabled}
              title={`${owner.assetCount} ảnh`}
              className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs hover:bg-muted disabled:opacity-50"
              onClick={() => onPick(owner.name)}
            >
              <Copyright aria-hidden="true" className="size-3 shrink-0" />
              <span className="truncate">{owner.name}</span>
            </button>
          ))}
        </>
      )}
    </div>
  )
}
