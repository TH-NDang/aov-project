import type { ComponentType, ReactNode } from "react"
import { ImageOff, Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"

/** The picture of a directory entry, marked in its corner while the entry has none and only shows its initials. */
export function EntryPicture({ missing, label, children }: { missing: boolean; label: string; children: ReactNode }) {
  return (
    <span className="relative inline-flex shrink-0">
      {children}
      {missing && (
        <span
          role="img"
          aria-label={label}
          title={label}
          className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full border bg-background text-(--aov-warning)"
        >
          <ImageOff aria-hidden="true" className="size-3" />
        </span>
      )}
    </span>
  )
}

/** One action of an entry, above the link that covers its row or card. */
export function EntryAction({
  label,
  icon: Icon = Pencil,
  onClick,
}: {
  label: string
  icon?: ComponentType<{ className?: string }>
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="relative z-10 size-8 shrink-0 text-muted-foreground"
      aria-label={label}
      title={label}
      onClick={(event) => {
        // A player's row opens the profile on a click of its own.
        event.stopPropagation()
        onClick()
      }}
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  )
}
