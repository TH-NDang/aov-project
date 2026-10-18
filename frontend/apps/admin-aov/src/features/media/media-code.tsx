import { CopyButton } from "@/components/copy-button"

export function MediaCode({ value, label }: { value: string; label: string }) {
  return (
    <span className="group/code inline-flex min-w-0 max-w-full items-center gap-0.5 rounded-md bg-muted/70 pl-1.5 text-muted-foreground ring-1 ring-border/50 ring-inset">
      <code className="truncate text-[11px] leading-5 font-normal" title={`${label}: ${value}`}>
        <span className="sr-only">{label}: </span>
        {value}
      </code>
      <span className="flex shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/code:opacity-100 sm:group-focus-within/code:opacity-100">
        <CopyButton value={value} label={`Sao chép ${label.toLowerCase()} ${value}`} />
      </span>
    </span>
  )
}
