import { useId, useState, type ComponentType, type InputHTMLAttributes, type ReactNode } from "react"
import { ChevronUp, Pencil, Trash2 } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@aov/ui/components/tooltip"

export function Field({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="grid min-w-0 gap-2">
      <span className="type-label">{label}</span>
      <Input {...props} />
    </label>
  )
}

export function Section({
  title,
  children,
  description,
  icon: Icon,
  action,
}: {
  title: string
  children: ReactNode
  description?: string
  icon?: ComponentType<{ className?: string }>
  action?: ReactNode
}) {
  return (
    <section className="min-w-0 space-y-4 admin-section py-4 @xl/profile-editor:py-5">
      <div className="flex flex-wrap items-center gap-3">
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="type-section-title">{title}</h2>
          {description && <p className="type-meta mt-1">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function ProfileIconButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  expanded,
  controls,
}: {
  label: string
  icon: ComponentType<{ className?: string }>
  onClick: () => void
  disabled?: boolean
  expanded?: boolean
  controls?: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={label}
          aria-expanded={expanded}
          aria-controls={controls}
          disabled={disabled}
          onClick={onClick}
        >
          <Icon className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function CompactEntry({
  title,
  meta,
  icon: Icon,
  children,
  onRemove,
}: {
  title: string
  meta?: string
  icon: ComponentType<{ className?: string }>
  children: ReactNode
  onRemove: () => void
}) {
  const [open, setOpen] = useState(!title)
  const id = useId()
  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-3 p-3">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="type-body break-words">{title || "Mục mới"}</p>
          {meta && <p className="type-meta break-words">{meta}</p>}
        </div>
        <ProfileIconButton
          label={`${open ? "Thu gọn" : "Chỉnh sửa"} ${title || "mục mới"}`}
          icon={open ? ChevronUp : Pencil}
          expanded={open}
          controls={id}
          onClick={() => setOpen(!open)}
        />
        <ProfileIconButton label={`Gỡ ${title || "mục mới"}`} icon={Trash2} onClick={onRemove} />
      </div>
      {open && (
        <div id={id} className="space-y-3 border-t p-4">
          {children}
        </div>
      )}
    </div>
  )
}
