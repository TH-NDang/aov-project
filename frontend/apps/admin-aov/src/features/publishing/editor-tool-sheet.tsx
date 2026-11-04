import { useState, type ReactElement, type ReactNode } from "react"
import { Button } from "@aov/ui/components/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@aov/ui/components/sheet"

export function EditorToolSheet<T>({
  trigger,
  title,
  description,
  value,
  onApply,
  children,
}: {
  trigger: ReactElement
  title: string
  description: string
  value: T
  onApply: (next: T) => void
  children: (draft: T, update: (next: T) => void, close: () => void) => ReactNode
}) {
  const [draft, setDraft] = useState<T | null>(null)
  const close = () => setDraft(null)
  return (
    <Sheet open={draft !== null} onOpenChange={(open) => setDraft(open ? value : null)}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent showCloseButton={false} className="w-full gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        {draft !== null && (
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault()
              // The portal still belongs to the main section form in React's event tree.
              event.stopPropagation()
              onApply(draft)
              close()
            }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">{children(draft, setDraft, close)}</div>
            <div className="flex shrink-0 justify-end gap-2 border-t p-3">
              <SheetClose asChild>
                <Button type="button" variant="ghost">
                  Hủy
                </Button>
              </SheetClose>
              <Button type="submit">Áp dụng</Button>
            </div>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
