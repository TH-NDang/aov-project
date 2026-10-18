import { useEffect, useMemo, useState } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { Languages, LoaderCircle, Plus } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { backendRequest } from "@/app/auth/session"
import { useIsWide } from "@/hooks/use-media-query"
import { errorMessage } from "@/lib/api/errors"
import { Field, control } from "../publishing/fields"
import type { Request } from "../publishing/publishing-api"
import { languageOptions } from "../users/profile-preference-picker"
import { characterImageKeys, type SkinBadgeRecord } from "./character-image-api"
import {
  badgeGroupKeys,
  badgeGroupKindLabels,
  badgeGroupLabel,
  createSkinBadgeGroupsApi,
  type BadgeGroup,
  type BadgeGroupKind,
  type BadgeGroupTranslation,
} from "./skin-badge-groups-api"

export function BadgeGroupSelect({
  value,
  onChange,
  locale,
  request = backendRequest,
  disabled = false,
}: {
  value: string | null
  onChange: (value: string | null) => void
  locale: string
  request?: Request
  disabled?: boolean
}) {
  const api = useMemo(() => createSkinBadgeGroupsApi(request), [request])
  const groups = useInfiniteQuery({
    queryKey: badgeGroupKeys.list(locale, ""),
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => api.groups(locale, "", pageParam, signal),
    getNextPageParam: (page) => ((page.page + 1) * page.size < page.totalElements ? page.page + 1 : undefined),
    staleTime: 60000,
  })
  const items = groups.data?.pages.flatMap((page) => page.items).filter((group) => group.id) ?? []
  return (
    <div className="space-y-2">
      <label className="grid gap-1.5 text-sm">
        <span>Nhóm nhãn</span>
        <select
          aria-label="Nhóm nhãn"
          className={control}
          value={value ?? ""}
          disabled={disabled || groups.isPending}
          onChange={(event) => onChange(event.target.value || null)}
        >
          <option value="">Chưa phân nhóm</option>
          {value && !items.some((group) => group.id === value) && <option value={value}>Nhóm hiện tại</option>}
          {items.map((group) => (
            <option key={group.id} value={group.id!}>
              {group.kind ? `${badgeGroupKindLabels[group.kind]} · ` : ""}
              {badgeGroupLabel(group)}
            </option>
          ))}
        </select>
      </label>
      {groups.hasNextPage && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || groups.isFetchingNextPage}
          onClick={() => groups.fetchNextPage()}
        >
          Tải thêm nhóm
        </Button>
      )}
      {groups.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(groups.error)}
        </p>
      )}
    </div>
  )
}

export function SkinBadgeGroupEditor({
  group,
  locale,
  onClose,
  request = backendRequest,
}: {
  group: BadgeGroup | null
  locale: string
  onClose: () => void
  request?: Request
}) {
  const wide = useIsWide()
  const client = useQueryClient()
  const [code, setCode] = useState(group?.code ?? "")
  const [kind, setKind] = useState<BadgeGroupKind>(group?.kind ?? "THEME")
  const [language, setLanguage] = useState(locale)
  const [translations, setTranslations] = useState<BadgeGroupTranslation[]>(
    () => group?.translations.map((text) => ({ ...text })) ?? [{ locale, displayName: "" }],
  )
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const translation = translations.find((text) => text.locale === language)
  const languages = Array.from(
    new Set([...languageOptions.map((option) => option.value), ...translations.map((text) => text.locale), locale]),
  )
  const close = () => {
    if (!busy && (!dirty || window.confirm("Có thay đổi nhóm chưa lưu. Đóng phần chỉnh sửa?"))) onClose()
  }
  useEffect(() => {
    if (!dirty && !busy) return
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", guard)
    return () => window.removeEventListener("beforeunload", guard)
  }, [dirty, busy])
  async function save() {
    setError("")
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code.trim())) {
      setError("Mã nhóm cần viết thường, dùng chữ, số và dấu gạch nối.")
      return
    }
    if (translations.some((text) => !text.displayName.trim())) {
      setError("Mỗi bản dịch đã thêm cần có tên nhóm.")
      return
    }
    setBusy(true)
    try {
      await createSkinBadgeGroupsApi(request).save(
        {
          code: code.trim(),
          kind,
          translations: translations.map((text) => ({ ...text, displayName: text.displayName.trim() })),
        },
        group,
      )
      await client.invalidateQueries({ queryKey: characterImageKeys.badges })
      onClose()
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={
          wide
            ? "flex w-[min(540px,90vw)] flex-col overflow-y-auto sm:max-w-none"
            : "flex max-h-[92dvh] flex-col overflow-y-auto rounded-t-2xl"
        }
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault()
        }}
      >
        <SheetHeader className="pr-8">
          <SheetTitle>{group ? "Chỉnh sửa nhóm nhãn" : "Tạo nhóm nhãn"}</SheetTitle>
          <SheetDescription>Gom các nhãn cùng bậc, sự kiện hoặc chủ đề.</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <Field
            label="Mã nhóm"
            value={code}
            disabled={!!group || busy}
            maxLength={64}
            placeholder="Ví dụ: ss, tet, hoc-vien"
            onChange={(value) => {
              setCode(value)
              setDirty(true)
            }}
          />
          <label className="grid gap-1.5 text-sm">
            <span>Loại nhóm</span>
            <select
              aria-label="Loại nhóm"
              className={control}
              value={kind}
              disabled={busy}
              onChange={(event) => {
                setKind(event.target.value as BadgeGroupKind)
                setDirty(true)
              }}
            >
              {Object.entries(badgeGroupKindLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-3 rounded-xl border p-4">
            <label className="grid gap-1.5 text-sm">
              <span className="flex items-center gap-2">
                <Languages className="size-4" />
                Ngôn ngữ tên nhóm
              </span>
              <select
                className={control}
                aria-label="Ngôn ngữ tên nhóm"
                value={language}
                disabled={busy}
                onChange={(event) => setLanguage(event.target.value)}
              >
                {languages.map((value) => (
                  <option key={value} value={value}>
                    {languageOptions.find((option) => option.value === value)?.label ?? value}
                    {translations.some((text) => text.locale === value) ? " · Đã có" : " · Chưa có"}
                  </option>
                ))}
              </select>
            </label>
            {translation ? (
              <Field
                label="Tên nhóm"
                value={translation.displayName}
                maxLength={255}
                disabled={busy}
                onChange={(displayName) => {
                  setTranslations((current) =>
                    current.map((text) => (text.locale === language ? { ...text, displayName } : text)),
                  )
                  setDirty(true)
                }}
              />
            ) : (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setTranslations((current) => [...current, { locale: language, displayName: "" }])
                  setDirty(true)
                }}
              >
                <Plus className="size-4" />
                Thêm tên nhóm · {language}
              </Button>
            )}
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" disabled={!dirty || busy} onClick={save}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}Lưu nhóm nhãn
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function SkinBadgeGroupAssignment({
  badge,
  locale,
  onClose,
  request = backendRequest,
}: {
  badge: SkinBadgeRecord
  locale: string
  onClose: () => void
  request?: Request
}) {
  const wide = useIsWide()
  const client = useQueryClient()
  const [groupId, setGroupId] = useState(badge.groupId ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function save() {
    setBusy(true)
    setError("")
    try {
      await createSkinBadgeGroupsApi(request).moveBadge(badge, groupId)
      await client.invalidateQueries({ queryKey: characterImageKeys.badges })
      onClose()
    } catch (failure) {
      setError(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <SheetContent
        side={wide ? "right" : "bottom"}
        className={wide ? "w-[min(460px,90vw)] sm:max-w-none" : "rounded-t-2xl"}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault()
        }}
        onPointerDownOutside={(event) => {
          if (busy) event.preventDefault()
        }}
      >
        <SheetHeader className="pr-8">
          <SheetTitle>Chuyển nhóm nhãn</SheetTitle>
          <SheetDescription>{badge.displayName || badge.code}</SheetDescription>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-6">
          <BadgeGroupSelect value={groupId} onChange={setGroupId} locale={locale} request={request} disabled={busy} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button disabled={busy || groupId === (badge.groupId ?? null)} onClick={save}>
            {busy && <LoaderCircle className="size-4 animate-spin" />}Lưu nhóm của nhãn
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
