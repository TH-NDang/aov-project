import { useState } from "react"
import { FileUp } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { LocalTime } from "@aov/ui/components/local-time"
import { errorMessage } from "@/lib/api/errors"

/** What every published capture set says about itself, whatever its kind. */
export interface CaptureSetRow {
  code: string
  capturedOn: string
  capturedAt: string
  sourceTimeZone?: string | null
}

/**
 * Brings in a capture set published to the private bucket with publish-captures (ADR-030), so a built Admin offers the
 * same sets as a dev server. One already imported shows as such. Builds and rankings use it with their own words.
 */
export function CaptureImportDialog<S extends CaptureSetRow>({
  open,
  title,
  description,
  emptyText,
  sets,
  importedCodes,
  describe,
  importSet,
  onOpenChange,
  onImported,
}: {
  open: boolean
  title: string
  description: string
  emptyText: string
  /** The published sets; null when the account cannot open source files. */
  sets: { isPending: boolean; isError: boolean; error: unknown; data?: S[] | null }
  importedCodes: string[]
  /** The two lines of a set: what it is, then its counts after the capture time. */
  describe: (set: S) => { name: string; counts: string }
  importSet: (capturedOn: string) => Promise<{ id: string }>
  onOpenChange: (open: boolean) => void
  onImported: (id: string) => void
}) {
  const [working, setWorking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const imported = new Set(importedCodes)

  const run = async (capturedOn: string) => {
    setWorking(capturedOn)
    setError(null)
    try {
      const detail = await importSet(capturedOn)
      onImported(detail.id)
      onOpenChange(false)
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setWorking(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {sets.isPending ? (
          <p className="type-body text-muted-foreground">Đang tìm bộ ảnh…</p>
        ) : sets.isError ? (
          <p className="type-body text-destructive">{errorMessage(sets.error)}</p>
        ) : !sets.data ? (
          <p className="type-body text-muted-foreground">
            Tài khoản này không mở được tệp nguồn, nên không có bộ ảnh nào để nhập.
          </p>
        ) : !sets.data.length ? (
          <p className="type-body text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sets.data.map((set) => {
              const { name, counts } = describe(set)
              return (
                <li key={set.capturedOn} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="type-body">{name}</p>
                    <p className="type-meta">
                      <LocalTime value={set.capturedAt} sourceTimeZone={set.sourceTimeZone ?? undefined} /> · {counts}
                    </p>
                  </div>
                  {imported.has(set.code) ? (
                    <span className="type-meta">Đã nhập</span>
                  ) : (
                    <Button type="button" size="sm" disabled={!!working} onClick={() => run(set.capturedOn)}>
                      <FileUp className="size-4" /> {working === set.capturedOn ? "Đang nhập…" : "Nhập"}
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {error && <p className="type-body text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
