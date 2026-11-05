import type { ReactNode } from "react"
import { Check } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"

export function CompetitionEditSheet({
  title,
  disabled,
  children,
  onApply,
  onClose,
}: {
  title: string
  disabled: boolean
  children: ReactNode
  onApply: () => void
  onClose: () => void
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b p-6 pr-12">
          <SheetTitle className="type-section-title">{title}</SheetTitle>
          <SheetDescription>Áp dụng để cập nhật trang. Lưu bản nháp để lưu các thay đổi của giải.</SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault()
            if (!disabled) onApply()
          }}
        >
          <fieldset disabled={disabled} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            {children}
          </fieldset>
          <div className="flex shrink-0 justify-end gap-2 border-t bg-background p-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" disabled={disabled}>
              <Check size={16} /> Áp dụng
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
