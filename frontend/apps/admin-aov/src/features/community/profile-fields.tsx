import type { ComponentType, InputHTMLAttributes, ReactNode } from "react"
import { BookOpenText, History, ImagePlus, Info, Link2, Plus, Trash2, Trophy, Users } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Input } from "@aov/ui/components/input"
import { Textarea } from "@aov/ui/components/textarea"
import type { ProfileContent, ProfileKind } from "@aov/community-contracts"
import { ProfilePicker, TournamentPicker } from "./profile-pickers"
import { OfficialBadge } from "@aov/ui/components/official-badge"
import { PlatformIcon } from "./platform-icon"
import { ProfileImageField } from "./profile-image-field"

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
    <fieldset disabled={disabled} className="space-y-5 disabled:opacity-75">
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
                    checked={!!item.official}
                    onChange={(e) =>
                      set(
                        "links",
                        content.links.map((x, i) => (i === index ? { ...x, official: e.target.checked } : x)),
                      )
                    }
                  />
                  <OfficialBadge label="Kênh chính thức" />
                  Kênh chính thức
                </label>
                <Remove
                  label="Gỡ kênh"
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
      {tab === "roster" && (
        <Section
          title="Thành viên và ban huấn luyện"
          icon={Users}
          description="Lịch sử thành viên độc lập với đội hình đăng ký trong từng mùa giải."
        >
          {content.roster.map((item, index) => {
            const update = (key: string, value: string) =>
              set(
                "roster",
                content.roster.map((row, i) => (i === index ? { ...row, [key]: value || null } : row)),
              )
            return (
              <div key={index} className="space-y-3 rounded-lg border p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Tên *" value={item.name} onChange={(e) => update("name", e.target.value)} />
                  <ProfilePicker
                    label="Liên kết hồ sơ thành viên"
                    value={item.pageId}
                    onChange={(value) => update("pageId", value)}
                  />
                  <Field
                    label="Vai trò / vị trí *"
                    value={item.role}
                    onChange={(e) => update("role", e.target.value)}
                  />
                  <Field
                    label="Trạng thái"
                    placeholder="Chính thức, dự bị, đã rời đội…"
                    value={item.status || ""}
                    onChange={(e) => update("status", e.target.value)}
                  />
                  <Field
                    label="Ngày tham gia"
                    type="date"
                    value={item.startsOn || ""}
                    onChange={(e) => update("startsOn", e.target.value)}
                  />
                  <Field
                    label="Ngày kết thúc"
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
                  label="Gỡ thành viên"
                  onClick={() =>
                    set(
                      "roster",
                      content.roster.filter((_, i) => i !== index),
                    )
                  }
                />
              </div>
            )
          })}
          <Add
            label="Thêm thành viên"
            onClick={() => set("roster", [...content.roster, { name: "", role: "", status: "Chính thức" }])}
          />
        </Section>
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
function Remove({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" onClick={onClick}>
      <Trash2 className="size-4" />
      {label}
    </Button>
  )
}
