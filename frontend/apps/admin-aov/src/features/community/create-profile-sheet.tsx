import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { ArrowRight } from "lucide-react"
import { emptyProfile, profileKindLabels, type ProfileKind, type CommunityProfile } from "@aov/community-contracts"
import { Button } from "@aov/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { pageApi, pageError, pageKeys } from "./page-api"
import { Field } from "./profile-fields"

function profileSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function CreateProfileSheet({
  kind,
  onClose,
  onCreated,
  initialName = "",
  initialSource = "",
  submitLabel = "Tạo và tiếp tục",
}: {
  kind: ProfileKind
  onClose: () => void
  onCreated: (entry: CommunityProfile) => void
  initialName?: string
  initialSource?: string
  submitLabel?: string
}) {
  const client = useQueryClient()
  const [name, setName] = useState(initialName)
  const [code, setCode] = useState(profileSlug(initialName))
  const [source, setSource] = useState(initialSource)
  const create = useMutation({
    mutationFn: () =>
      pageApi.create(kind, code, {
        ...emptyProfile(name),
        sources: source ? [{ label: "Nguồn hồ sơ", url: source }] : [],
      }),
    onSuccess: async (entry) => {
      await client.invalidateQueries({ queryKey: pageKeys })
      onClose()
      onCreated(entry)
    },
  })
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open && !create.isPending) onClose()
      }}
    >
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Tạo hồ sơ {profileKindLabels[kind].toLowerCase()}</SheetTitle>
          <SheetDescription>Lưu nháp trước, bổ sung thông tin và công bố khi đã sẵn sàng.</SheetDescription>
        </SheetHeader>
        <form
          className="space-y-5 px-4 py-6"
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate()
          }}
        >
          <Field
            label="Tên hiển thị *"
            required
            maxLength={200}
            autoFocus
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setCode(
                e.target.value
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .replace(/[đĐ]/g, "d")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "-")
                  .replace(/^-|-$/g, ""),
              )
            }}
          />
          <Field
            label="Đường dẫn hồ sơ *"
            required
            pattern="[a-z0-9][a-z0-9-]{1,99}"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Field
            label="Nguồn tham khảo"
            type="url"
            placeholder="https://…"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <p className="type-meta">
            Hồ sơ được tạo độc lập tài khoản đăng nhập. Bạn có thể bổ sung người đại diện sau.
          </p>
          {create.isError && (
            <p role="alert" className="type-body text-destructive">
              {pageError(create.error)}
            </p>
          )}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Đang tạo…" : submitLabel}
            <ArrowRight className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  )
}
