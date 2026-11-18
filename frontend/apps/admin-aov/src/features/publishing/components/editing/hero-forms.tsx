import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@aov/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@aov/ui/components/dialog"
import { cn } from "@aov/ui/lib/utils"
import { backendRequest } from "@/app/auth/session"
import { MediaImage } from "@/components/media-image"
import { errorMessage } from "@/lib/api/errors"
import { roleIcons } from "../workspace/hero-classification-badges"
import { formCandidates, heroFormChoices, replaceFormsBody, type HeroForms } from "../../model/hero-forms-model"
import { createPublishingApi, publishingKeys } from "../../api/publishing-api"
import { ROLES } from "../../api/types"

const api = createPublishingApi(backendRequest)

export function useHeroForms(heroId?: string) {
  return useQuery({
    queryKey: publishingKeys.forms(heroId ?? ""),
    queryFn: () => api.forms(heroId!),
    enabled: !!heroId,
    staleTime: 60_000,
    retry: false,
  })
}

/**
 * The form switcher beside a hero's name (ADR-024): each form, which is a hero of its own with its own drafts. Choosing
 * one opens that hero's page, so every section editor stays the same. The shared part is edited from the form pages;
 * its own page, opened from there, is marked so it is not mistaken for a form.
 */
export function HeroFormSwitcher({
  heroId,
  locale,
  disabled,
  onSelect,
}: {
  heroId: string
  locale: string
  disabled?: boolean
  onSelect: (heroId: string) => void
}) {
  const forms = useHeroForms(heroId)
  const choices = heroFormChoices(forms.data, locale, ROLES)
  if (!choices.length) return null
  const sharedPage = forms.data?.holder?.id === heroId

  return (
    <div role="group" aria-label="Dạng tướng" className="flex min-w-0 flex-wrap items-center gap-1.5">
      {sharedPage && (
        <span className="type-body rounded-md bg-secondary px-2.5 py-1.5 ring-1 ring-ring" aria-current="page">
          Phần chung
        </span>
      )}
      {choices.map((choice) => {
        const current = choice.id === heroId
        return (
          <Button
            key={choice.id}
            type="button"
            size="sm"
            variant={current ? "secondary" : "ghost"}
            aria-pressed={current}
            disabled={disabled}
            className={cn("h-8 gap-1.5 px-2.5", current && "ring-1 ring-ring")}
            title={choice.form ? choice.form.code : undefined}
            onClick={() => onSelect(choice.id)}
          >
            {choice.role && (
              <MediaImage
                path={`${import.meta.env?.BASE_URL ?? "/"}images/hero/vai-tro/${roleIcons[choice.role]}.png`}
                alt=""
                className="size-4 shrink-0 object-contain"
              />
            )}
            <span className="type-body">{choice.label}</span>
            {choice.form && !choice.form.published && <span className="type-meta">· chưa xuất bản</span>}
            {choice.form?.draftOpen && (
              <span className="size-1.5 shrink-0 rounded-full bg-(--aov-warning)" aria-label="Có bản nháp đang mở" />
            )}
          </Button>
        )
      })}
    </div>
  )
}

type FormRow = { id: string; code: string; label: string }

/**
 * Edits which heroes are the forms of this hero and their order; the first is the default form on the Wiki. Saving
 * applies at once and needs hero:publish. Forms are heroes coded "<hero code>-<key>", created like any hero.
 */
export function HeroFormsDialog({
  hero,
  open,
  onOpenChange,
}: {
  hero: { id: string; code: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const client = useQueryClient()
  const forms = useHeroForms(hero.id)
  const [rows, setRows] = useState<FormRow[] | null>(null)
  const current: FormRow[] =
    rows ?? (forms.data?.forms ?? []).map((form) => ({ id: form.id, code: form.code, label: form.code }))
  const candidates = useQuery({
    queryKey: publishingKeys.formCandidates(hero.code),
    queryFn: async () => (await api.heroes(0, { q: `${hero.code}-` })).items,
    enabled: open,
    staleTime: 30_000,
  })
  const available = formCandidates(hero, candidates.data ?? [], current)
  const save = useMutation({
    mutationFn: () => api.replaceForms(hero.id, replaceFormsBody(forms.data as HeroForms, hero.code, current)),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: publishingKeys.allForms })
      // The catalog and publish readiness group forms under their hero, so they read the new list too.
      await client.invalidateQueries({ queryKey: publishingKeys.heroes })
      toast.success("Đã lưu danh sách dạng")
      setRows(null)
      onOpenChange(false)
    },
    meta: { silent: true },
  })
  const move = (index: number, delta: number) => {
    const next = [...current]
    const [row] = next.splice(index, 1)
    next.splice(index + delta, 0, row)
    setRows(next)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setRows(null)
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Dạng của tướng</DialogTitle>
          <DialogDescription>
            Mỗi dạng là một tướng có mã <code>{hero.code}-…</code> với vai trò, kỹ năng, chỉ số riêng. Dạng đầu tiên là
            dạng mặc định trên Wiki. Thay đổi có hiệu lực ngay.
          </DialogDescription>
        </DialogHeader>
        <ol className="grid gap-2" aria-label="Thứ tự dạng">
          {current.map((row, index) => (
            <li key={row.id} className="flex items-center gap-2 rounded-md border px-3 py-2">
              <span className="type-body min-w-0 flex-1 truncate">
                {index + 1}. {row.code}
                {index === 0 && <span className="type-meta"> · mặc định</span>}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Đưa ${row.code} lên`}
                disabled={index === 0 || save.isPending}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Đưa ${row.code} xuống`}
                disabled={index === current.length - 1 || save.isPending}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Bỏ ${row.code} khỏi danh sách dạng`}
                disabled={save.isPending}
                onClick={() => setRows(current.filter((other) => other.id !== row.id))}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
          {!current.length && <li className="type-meta">Chưa có dạng: đây là tướng thường.</li>}
        </ol>
        <div className="grid gap-2">
          <p className="type-label">Thêm dạng</p>
          {available.length ? (
            <div className="flex flex-wrap gap-2">
              {available.map((row) => (
                <Button
                  key={row.id}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={save.isPending}
                  onClick={() => setRows([...current, { id: row.id, code: row.code, label: row.code }])}
                >
                  <Plus className="size-4" />
                  {row.code}
                </Button>
              ))}
            </div>
          ) : (
            <p className="type-meta">
              {candidates.isPending ? "Đang tìm tướng…" : `Tạo tướng có mã ${hero.code}-<khóa dạng> rồi thêm vào đây.`}
            </p>
          )}
        </div>
        {save.isError && (
          <p role="alert" className="type-body text-destructive">
            {errorMessage(save.error)}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Đóng
          </Button>
          <Button type="button" disabled={!rows || !forms.data || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Đang lưu…" : "Lưu danh sách dạng"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
