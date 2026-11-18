import { useState } from "react"
import { useBeforeUnload } from "react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import {
  emptyProfile,
  isIndividualProfile,
  profileKindLabels,
  type ProfileKind,
  type CommunityProfile,
  type PersonRole,
} from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { pageApi, pageError, pageKeys } from "../api/page-api"
import { Field } from "./profile-form-primitives"
import { profileSlug } from "../model/profile-slug"
import { ProfileImageField } from "./profile-image-field"
import { ProfileCountryPicker } from "./profile-country-picker"
import { ProfilePersonRoles } from "./profile-person-roles"

export function CreateProfileSheet({
  kind,
  onClose,
  onCreated,
  initialName = "",
  initialSource = "",
  submitLabel = "Tạo và tiếp tục",
  initialRoles = [],
}: {
  kind: ProfileKind
  onClose: () => void
  onCreated: (entry: CommunityProfile) => void
  initialName?: string
  initialSource?: string
  submitLabel?: string
  initialRoles?: PersonRole[]
}) {
  const client = useQueryClient()
  const [name, setName] = useState(initialName)
  const [code, setCode] = useState(profileSlug(initialName) ?? "")
  // Once the code is typed by hand, renaming no longer overwrites it.
  const [codeTyped, setCodeTyped] = useState(false)
  const nonLatin = !!name.trim() && profileSlug(name) === null
  const [source, setSource] = useState(initialSource)
  const [country, setCountry] = useState("")
  const [personRoles, setPersonRoles] = useState<PersonRole[]>(initialRoles)
  const [avatarUrl, setAvatarUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const create = useMutation({
    mutationFn: () =>
      pageApi.create(kind, code, {
        ...emptyProfile(name),
        country: country || null,
        ...(isIndividualProfile(kind) ? { personRoles } : {}),
        avatarUrl: avatarUrl || null,
        sources: source ? [{ label: "Nguồn hồ sơ", url: source }] : [],
      }),
    meta: { silent: true, successMessage: "Đã tạo hồ sơ." },
    onSuccess: async (entry) => {
      await client.invalidateQueries({ queryKey: pageKeys })
      onClose()
      onCreated(entry)
    },
  })
  const busy = uploading || create.isPending
  useBeforeUnload((event) => {
    if (busy) {
      event.preventDefault()
      event.returnValue = ""
    }
  })
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <SheetContent className="overflow-y-auto sm:max-w-lg" showCloseButton={!busy}>
        <SheetHeader>
          <SheetTitle>Tạo hồ sơ {profileKindLabels[kind].toLowerCase()}</SheetTitle>
          <SheetDescription>Lưu nháp trước, bổ sung thông tin và xuất bản khi đã sẵn sàng.</SheetDescription>
        </SheetHeader>
        <form
          className="space-y-5 px-4 py-6"
          onSubmit={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (!busy && (kind !== "PERSON" || personRoles.length)) create.mutate()
          }}
        >
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            <Field
              label="Tên hiển thị *"
              required
              maxLength={200}
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (!codeTyped) setCode(profileSlug(e.target.value) ?? "")
              }}
            />
            <div className="grid gap-2">
              <Field
                label="Đường dẫn hồ sơ *"
                required
                pattern="[a-z0-9][a-z0-9-]{1,99}"
                placeholder={
                  kind === "CIRCUIT"
                    ? "dau-truong-danh-vong"
                    : kind === "TEAM"
                      ? "team-flash"
                      : isIndividualProfile(kind)
                        ? "ten-nhan-su"
                        : "garena-viet-nam"
                }
                aria-describedby="profile-code-hint"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setCodeTyped(true)
                }}
              />
              <p id="profile-code-hint" className="type-meta">
                {nonLatin && !codeTyped
                  ? "Tên có chữ không phải Latin nên không tự tạo được đường dẫn. Hãy tự đặt bằng chữ thường không dấu, số và gạch nối."
                  : "Chữ thường không dấu, số và gạch nối; dùng làm địa chỉ trang công khai."}
              </p>
            </div>
            <ProfileCountryPicker value={country} disabled={busy} onChange={setCountry} />
            {isIndividualProfile(kind) && (
              <ProfilePersonRoles
                value={personRoles}
                onChange={setPersonRoles}
                disabled={busy}
                required={kind === "PERSON"}
              />
            )}
            <Field
              label="Nguồn tham khảo"
              type="url"
              placeholder="https://…"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <ProfileImageField
              label={isIndividualProfile(kind) ? "Ảnh chân dung" : "Logo"}
              shape={isIndividualProfile(kind) ? "portrait" : "logo"}
              subject={
                kind === "CIRCUIT"
                  ? "circuit"
                  : kind === "PERSON"
                    ? "person"
                    : kind === "PLAYER"
                      ? "player"
                      : kind === "TEAM"
                        ? "team"
                        : "organization"
              }
              name={name}
              sourceUrl={source}
              value={avatarUrl}
              onChange={setAvatarUrl}
              onBusyChange={setUploading}
            />
            <p className="type-meta">
              Hồ sơ được tạo độc lập tài khoản đăng nhập. Bạn có thể bổ sung người đại diện sau.
            </p>
          </fieldset>
          {create.isError && (
            <p role="alert" className="type-body text-destructive">
              {pageError(create.error)}
            </p>
          )}
          <Button type="submit" disabled={busy || (kind === "PERSON" && !personRoles.length)}>
            {uploading ? "Đang tải ảnh…" : create.isPending ? "Đang tạo…" : submitLabel}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
