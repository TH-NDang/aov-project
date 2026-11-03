import { useState, type ComponentType, type InputHTMLAttributes, type ReactNode } from "react"
import { BookOpenText, History, ImagePlus, Info, Link2, Plus, Trash2, Trophy, Users } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import type { ProfileContent, ProfileKind, ProfileMember } from "@aov/community-contracts"
import { ProfilePicker, TournamentPicker } from "./profile-pickers"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { PlatformIcon } from "./platform-icon"
import { ProfileImageField } from "./profile-image-field"
import { useQueries } from "@tanstack/react-query"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@aov/ui/components/sheet"
import { useTournamentAccess } from "@/features/esports/data/use-esports-data"
import { pageApi, pageKeys } from "./page-api"
import { ProfileRosterLineup } from "./profile-roster-lineup"
import { ProfileRosterMemberChoice } from "./profile-roster-member-choice"

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
}: {
  title: string
  children: ReactNode
  description?: string
  icon?: ComponentType<{ className?: string }>
}) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        {Icon && (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <Icon className="size-4" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="type-section-title">{title}</h2>
          {description && <p className="type-meta mt-1">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}
export function ProfileFields({
  content,
  onChange,
  tab,
  disabled,
  kind,
  onBusyChange,
}: {
  content: ProfileContent
  onChange: (value: ProfileContent) => void
  tab: string
  disabled?: boolean
  kind: ProfileKind
  onBusyChange: (value: boolean) => void
}) {
  const set = <K extends keyof ProfileContent>(key: K, value: ProfileContent[K]) =>
    onChange({ ...content, [key]: value })
  const input = (key: "name" | "shortName" | "country" | "avatarUrl" | "coverUrl", label: string, type = "text") => (
    <Field label={label} type={type} value={content[key] || ""} onChange={(event) => set(key, event.target.value)} />
  )
  return (
    <fieldset disabled={disabled} className="@container/profile-fields min-w-0 space-y-5 disabled:opacity-75">
      {tab === "overview" && (
        <>
          <Section title="Thông tin hồ sơ" icon={Info}>
            <div className="grid gap-4 sm:grid-cols-2">
              {input("name", "Tên hiển thị *")}
              {input("shortName", "Tên ngắn")}
              {input("country", "Quốc gia / khu vực")}
            </div>
            <label className="grid gap-2">
              <span className="type-label">Giới thiệu</span>
              <Textarea
                rows={6}
                maxLength={10000}
                value={content.biography || ""}
                onChange={(event) => set("biography", event.target.value)}
              />
            </label>
          </Section>
          <Section
            title="Hình ảnh"
            icon={ImagePlus}
            description="Ảnh tải lên được lưu vào Quản lý ảnh kèm chủ sở hữu, để ghi đúng bản quyền."
          >
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <ProfileImageField
                label={kind === "PLAYER" ? "Ảnh tuyển thủ" : kind === "TEAM" ? "Logo đội tuyển" : "Logo tổ chức"}
                shape={kind === "PLAYER" ? "portrait" : "logo"}
                subject={kind === "PLAYER" ? "player" : kind === "TEAM" ? "team" : "organization"}
                name={content.name}
                value={content.avatarUrl || ""}
                onChange={(url) => set("avatarUrl", url)}
                onBusyChange={onBusyChange}
              />
              <ProfileImageField
                label="Ảnh bìa"
                shape="cover"
                subject="cover"
                name={content.name}
                value={content.coverUrl || ""}
                onChange={(url) => set("coverUrl", url)}
                onBusyChange={onBusyChange}
              />
            </div>
          </Section>
          <Section
            title="Kênh liên hệ công khai"
            icon={Link2}
            description="Đánh dấu kênh chính thức khi kênh do chính tổ chức, đội hoặc tuyển thủ vận hành."
          >
            {content.links.map((item, index) => (
              <div
                key={index}
                className="grid items-end gap-3 rounded-lg border p-3 sm:grid-cols-[auto_1fr_2fr] lg:grid-cols-[auto_1fr_2fr_auto_auto]"
              >
                <PlatformIcon
                  url={item.url}
                  className="hidden size-9 rounded-md bg-muted text-muted-foreground sm:flex"
                />
                <Field
                  label="Tên kênh"
                  aria-label={`Tên kênh ${index + 1}`}
                  value={item.label}
                  onChange={(e) =>
                    set(
                      "links",
                      content.links.map((x, i) => (i === index ? { ...x, label: e.target.value } : x)),
                    )
                  }
                />
                <Field
                  label="Đường dẫn"
                  aria-label={`Đường dẫn kênh ${index + 1}`}
                  type="url"
                  value={item.url}
                  onChange={(e) =>
                    set(
                      "links",
                      content.links.map((x, i) => (i === index ? { ...x, url: e.target.value } : x)),
                    )
                  }
                />
                <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    aria-label={`Kênh ${index + 1} là kênh chính thức`}
                    checked={!!item.official}
                    onChange={(e) =>
                      set(
                        "links",
                        content.links.map((x, i) => (i === index ? { ...x, official: e.target.checked } : x)),
                      )
                    }
                  />
                  <span aria-hidden>
                    <OfficialBadge label="Kênh chính thức" />
                  </span>
                  Kênh chính thức
                </label>
                <Remove
                  label="Gỡ kênh"
                  name={`Gỡ kênh ${index + 1}`}
                  onClick={() =>
                    set(
                      "links",
                      content.links.filter((_, i) => i !== index),
                    )
                  }
                />
              </div>
            ))}
            <Add
              label="Thêm kênh"
              onClick={() => set("links", [...content.links, { label: "", url: "", official: false }])}
            />
          </Section>
        </>
      )}
      {tab === "roster" && kind === "TEAM" && (
        <RosterPanel value={content.roster} onChange={(value) => set("roster", value)} disabled={disabled} />
      )}
      {tab === "history" && (
        <Section
          title="Lịch sử và sự nghiệp"
          icon={History}
          description="Ghi rõ thời điểm, vai trò và nguồn cho mỗi lần gia nhập, rời đội hoặc đổi vị trí."
        >
          {content.history.map((item, index) => {
            const update = (key: string, value: string) =>
              set(
                "history",
                content.history.map((row, i) => (i === index ? { ...row, [key]: value || null } : row)),
              )
            return (
              <div key={index} className="space-y-3 rounded-lg border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Sự kiện / đội tuyển *"
                    value={item.title}
                    onChange={(e) => update("title", e.target.value)}
                  />
                  <Field label="Vai trò" value={item.role || ""} onChange={(e) => update("role", e.target.value)} />
                  <ProfilePicker
                    label="Liên kết đội / tổ chức"
                    value={item.relatedPageId}
                    onChange={(value) => update("relatedPageId", value)}
                  />
                  <Field
                    label="Từ ngày"
                    type="date"
                    value={item.startsOn || ""}
                    onChange={(e) => update("startsOn", e.target.value)}
                  />
                  <Field
                    label="Đến ngày"
                    type="date"
                    value={item.endsOn || ""}
                    onChange={(e) => update("endsOn", e.target.value)}
                  />
                  <Field
                    label="Nguồn"
                    type="url"
                    value={item.sourceUrl || ""}
                    onChange={(e) => update("sourceUrl", e.target.value)}
                  />
                </div>
                <Remove
                  label="Gỡ sự kiện"
                  onClick={() =>
                    set(
                      "history",
                      content.history.filter((_, i) => i !== index),
                    )
                  }
                />
              </div>
            )
          })}
          <Add label="Thêm mốc lịch sử" onClick={() => set("history", [...content.history, { title: "" }])} />
        </Section>
      )}
      {tab === "achievements" && (
        <Section title="Thành tích và giải thưởng" icon={Trophy}>
          {content.achievements.map((item, index) => {
            const update = (key: string, value: string) =>
              set(
                "achievements",
                content.achievements.map((row, i) => (i === index ? { ...row, [key]: value || null } : row)),
              )
            return (
              <div key={index} className="space-y-3 rounded-lg border p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Giải / danh hiệu *"
                    value={item.title}
                    onChange={(e) => update("title", e.target.value)}
                  />
                  <Field
                    label="Thứ hạng / giải thưởng *"
                    value={item.placement}
                    onChange={(e) => update("placement", e.target.value)}
                  />
                  <TournamentPicker value={item.tournamentId} onChange={(value) => update("tournamentId", value)} />
                  <Field
                    label="Ngày"
                    type="date"
                    value={item.date || ""}
                    onChange={(e) => update("date", e.target.value)}
                  />
                  <Field
                    label="Nguồn"
                    type="url"
                    value={item.sourceUrl || ""}
                    onChange={(e) => update("sourceUrl", e.target.value)}
                  />
                </div>
                <Remove
                  label="Gỡ thành tích"
                  onClick={() =>
                    set(
                      "achievements",
                      content.achievements.filter((_, i) => i !== index),
                    )
                  }
                />
              </div>
            )
          })}
          <Add
            label="Thêm thành tích"
            onClick={() => set("achievements", [...content.achievements, { title: "", placement: "" }])}
          />
        </Section>
      )}
      {tab === "sources" && (
        <Section
          title="Nguồn thông tin"
          icon={BookOpenText}
          description="Cần ít nhất một nguồn trước khi công bố hồ sơ."
        >
          {content.sources.map((item, index) => {
            const update = (key: string, value: string) =>
              set(
                "sources",
                content.sources.map((row, i) => (i === index ? { ...row, [key]: value || null } : row)),
              )
            return (
              <div key={index} className="grid items-end gap-3 sm:grid-cols-2">
                <Field label="Tên nguồn *" value={item.label} onChange={(e) => update("label", e.target.value)} />
                <Field
                  label="Đường dẫn *"
                  type="url"
                  value={item.url}
                  onChange={(e) => update("url", e.target.value)}
                />
                <Field
                  label="Ngày đối chiếu"
                  type="date"
                  value={item.checkedOn || ""}
                  onChange={(e) => update("checkedOn", e.target.value)}
                />
                <Remove
                  label="Gỡ nguồn"
                  onClick={() =>
                    set(
                      "sources",
                      content.sources.filter((_, i) => i !== index),
                    )
                  }
                />
              </div>
            )
          })}
          <Add label="Thêm nguồn" onClick={() => set("sources", [...content.sources, { label: "", url: "" }])} />
        </Section>
      )}
    </fieldset>
  )
}
function Add({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onClick}>
      <Plus className="size-4" />
      {label}
    </Button>
  )
}
/** `name` tells repeated rows apart for screen readers by adding the row number. */
function Remove({ label, name, onClick }: { label: string; name?: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" aria-label={name} onClick={onClick}>
      <Trash2 className="size-4" />
      {label}
    </Button>
  )
}

function RosterPanel({
  value,
  onChange,
  disabled,
}: {
  value: ProfileMember[]
  onChange: (value: ProfileMember[]) => void
  disabled?: boolean
}) {
  const access = useTournamentAccess()
  const ids = [...new Set(value.flatMap((member) => (member.pageId ? [member.pageId] : [])))]
  const profiles = useQueries({
    queries: ids.map((id) => ({
      queryKey: [...pageKeys, access.actorKey, id],
      queryFn: () => pageApi.read(id),
      staleTime: 60_000,
    })),
  })
  const [editing, setEditing] = useState<{ index: number; member: ProfileMember } | null>(null)
  const update = (key: keyof ProfileMember, value: string) =>
    setEditing(
      (current) =>
        current && {
          ...current,
          member: { ...current.member, [key]: key === "name" || key === "role" ? value : value || null },
        },
    )
  return (
    <Section title="Đội hình & ban huấn luyện" icon={Users}>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setEditing({ index: value.length, member: { name: "", role: "", status: "Chính thức" } })}
        >
          <Plus className="size-4" />
          Thêm thành viên
        </Button>
      </div>
      {value.length ? (
        <ProfileRosterLineup
          members={value}
          profiles={new Map(ids.map((id, i) => [id, profiles[i]?.data]))}
          disabled={disabled}
          onEdit={(index) => setEditing({ index, member: { ...value[index] } })}
          onRemove={(index) => onChange(value.filter((_, i) => i !== index))}
        />
      ) : (
        <p className="type-meta">Chưa có thành viên trong đội hình.</p>
      )}
      {editing && (
        <Sheet
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null)
          }}
        >
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{editing.index === value.length ? "Thêm thành viên" : "Chỉnh sửa thành viên"}</SheetTitle>
              <SheetDescription>Vị trí, trạng thái và thời gian tham gia đội tuyển.</SheetDescription>
            </SheetHeader>
            <form
              className="space-y-4 px-4 pb-6"
              onSubmit={(event) => {
                event.preventDefault()
                if (!disabled) {
                  onChange(
                    editing.index === value.length
                      ? [...value, editing.member]
                      : value.map((member, index) => (index === editing.index ? editing.member : member)),
                  )
                  setEditing(null)
                }
              }}
            >
              <fieldset disabled={disabled} className="space-y-4">
                <Field
                  label="Tên *"
                  required
                  value={editing.member.name}
                  onChange={(event) => update("name", event.target.value)}
                />
                <ProfilePicker
                  label="Liên kết hồ sơ thành viên"
                  value={editing.member.pageId}
                  onChange={(value) => update("pageId", value)}
                />
                <div className="grid items-start gap-4 sm:grid-cols-2">
                  <ProfileRosterMemberChoice
                    label="Vị trí trong đội *"
                    value={editing.member.role}
                    options={[
                      "Đường Tà thần",
                      "Đi rừng",
                      "Đường giữa",
                      "Đường Rồng",
                      "Trợ thủ",
                      "Huấn luyện viên",
                      "Phân tích đội tuyển",
                    ]}
                    roleIcons
                    disabled={disabled}
                    required
                    onChange={(value) => update("role", value)}
                  />
                  <ProfileRosterMemberChoice
                    label="Trạng thái"
                    value={editing.member.status || ""}
                    options={["Chính thức", "Dự bị", "Đã rời đội", "Cho mượn", "Thử việc"]}
                    disabled={disabled}
                    onChange={(value) => update("status", value)}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Ngày tham gia"
                    type="date"
                    value={editing.member.startsOn || ""}
                    onChange={(event) => update("startsOn", event.target.value)}
                  />
                  <Field
                    label="Ngày kết thúc"
                    type="date"
                    min={editing.member.startsOn || undefined}
                    value={editing.member.endsOn || ""}
                    onChange={(event) => update("endsOn", event.target.value)}
                  />
                </div>
                <Field
                  label="Nguồn đối chiếu"
                  type="url"
                  value={editing.member.sourceUrl || ""}
                  onChange={(event) => update("sourceUrl", event.target.value)}
                />
              </fieldset>
              <div className="flex gap-2">
                <Button type="submit" disabled={disabled}>
                  Áp dụng
                </Button>
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Hủy
                </Button>
              </div>
              <p className="type-meta">Thay đổi được ghi nhận sau khi bạn lưu nháp đội tuyển.</p>
            </form>
          </SheetContent>
        </Sheet>
      )}
    </Section>
  )
}
