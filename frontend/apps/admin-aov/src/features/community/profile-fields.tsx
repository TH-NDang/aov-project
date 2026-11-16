import { BookOpenText, History, Info, Plus, Trophy } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Textarea } from "@aov/ui/components/textarea"
import { isIndividualProfile, type ProfileContent, type ProfileKind } from "@aov/community-contracts"
import { ProfilePicker, TournamentPicker } from "./profile-pickers"
import { ProfileCountryPicker } from "./profile-country-picker"
import { ProfilePersonRoles } from "./profile-person-roles"

import { Field, Section, CompactEntry } from "./profile-form-primitives"
import { ProfileRoster } from "./profile-roster"
import { ProfileTeams } from "./profile-teams"
export { Field, Section } from "./profile-form-primitives"

export function ProfileFields({
  content,
  pageId,
  entityId,
  onChange,
  tab,
  disabled,
  kind,
}: {
  content: ProfileContent
  pageId: string
  /** The team or player this page stands for: their own tournaments come first when linking one. */
  entityId?: string | null
  onChange: (value: ProfileContent) => void
  tab: string
  disabled?: boolean
  kind: ProfileKind
}) {
  const set = <K extends keyof ProfileContent>(key: K, value: ProfileContent[K]) =>
    onChange({ ...content, [key]: value })
  const tournamentContext =
    entityId && kind === "TEAM"
      ? { teamId: entityId }
      : entityId && kind === "PLAYER"
        ? { playerId: entityId }
        : undefined
  const input = (key: "name" | "shortName", label: string, type = "text") => (
    <Field label={label} type={type} value={content[key] || ""} onChange={(event) => set(key, event.target.value)} />
  )
  return (
    <fieldset disabled={disabled} className="@container/profile-fields min-w-0 space-y-5 disabled:opacity-75">
      {tab === "overview" && (
        <Section
          title="Thông tin chung"
          icon={Info}
          description="Tên và thông tin giới thiệu hiển thị trên trang công khai."
        >
          <div className="grid gap-4">
            {input("name", "Tên hiển thị *")}
            <div className="grid gap-4 @lg/profile-fields:grid-cols-2">
              {input("shortName", "Tên ngắn")}
              <ProfileCountryPicker
                value={content.country}
                disabled={disabled}
                onChange={(value) => set("country", value)}
              />
            </div>
          </div>
          {isIndividualProfile(kind) && (
            <ProfilePersonRoles
              value={content.personRoles}
              onChange={(roles) => set("personRoles", roles)}
              disabled={disabled}
              required={kind === "PERSON"}
            />
          )}
          <label className="grid gap-2">
            <span className="type-label">Giới thiệu</span>
            <Textarea
              rows={5}
              maxLength={10000}
              value={content.biography || ""}
              onChange={(event) => set("biography", event.target.value)}
            />
          </label>
        </Section>
      )}
      {tab === "roster" && kind === "TEAM" && (
        <ProfileRoster
          value={content.roster}
          pageId={pageId}
          disabled={disabled}
          onChange={(value) => set("roster", value)}
        />
      )}
      {tab === "history" && isIndividualProfile(kind) && <ProfileTeams pageId={pageId} />}
      {tab === "history" && (
        <Section
          title={
            kind === "ORGANIZATION" || kind === "CIRCUIT"
              ? "Lịch sử hoạt động"
              : isIndividualProfile(kind)
                ? "Sự nghiệp & hoạt động"
                : "Lịch sử đội tuyển"
          }
          icon={History}
          description={
            kind === "ORGANIZATION" || kind === "CIRCUIT"
              ? "Ghi lại các cột mốc thành lập, đổi tên và hoạt động nổi bật, kèm thời điểm và nguồn kiểm chứng."
              : kind === "PERSON"
                ? "Ghi lại giải đấu, hoạt động hoặc đội tuyển đã tham gia, kèm vai trò và nguồn đối chiếu."
                : kind === "PLAYER"
                  ? "Ghi rõ thời điểm, vai trò và nguồn cho mỗi lần gia nhập, rời đội hoặc đổi vị trí."
                  : "Ghi lại các cột mốc thành lập, đổi tên và thay đổi của đội tuyển, kèm nguồn kiểm chứng."
          }
        >
          {content.history.map((item, index) => {
            const update = (key: string, value: string) =>
              set(
                "history",
                content.history.map((row, i) => (i === index ? { ...row, [key]: value || null } : row)),
              )
            return (
              <CompactEntry
                key={index}
                title={item.title}
                meta={[item.role, item.startsOn, item.endsOn].filter(Boolean).join(" · ")}
                icon={History}
                onRemove={() =>
                  set(
                    "history",
                    content.history.filter((_, i) => i !== index),
                  )
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label={isIndividualProfile(kind) ? "Sự kiện / đội tuyển *" : "Cột mốc / sự kiện *"}
                    value={item.title}
                    onChange={(e) => update("title", e.target.value)}
                  />
                  <Field
                    label={isIndividualProfile(kind) ? "Vai trò" : "Mô tả ngắn"}
                    value={item.role || ""}
                    onChange={(e) => update("role", e.target.value)}
                  />
                  <ProfilePicker
                    label={isIndividualProfile(kind) ? "Liên kết đội / tổ chức" : "Hồ sơ liên quan"}
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
              </CompactEntry>
            )
          })}
          <Add label="Thêm mốc lịch sử" onClick={() => set("history", [...content.history, { title: "" }])} />
        </Section>
      )}
      {tab === "achievements" && (kind === "TEAM" || kind === "PLAYER") && (
        <Section title="Thành tích và giải thưởng" icon={Trophy}>
          {content.achievements.map((item, index) => {
            const update = (key: string, value: string) =>
              set(
                "achievements",
                content.achievements.map((row, i) => (i === index ? { ...row, [key]: value || null } : row)),
              )
            return (
              <CompactEntry
                key={index}
                title={item.title}
                meta={[item.placement, item.date].filter(Boolean).join(" · ")}
                icon={Trophy}
                onRemove={() =>
                  set(
                    "achievements",
                    content.achievements.filter((_, i) => i !== index),
                  )
                }
              >
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
                  <TournamentPicker
                    value={item.tournamentId}
                    context={tournamentContext}
                    onChange={(value) => update("tournamentId", value)}
                  />
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
              </CompactEntry>
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
          description="Cần ít nhất một nguồn trước khi xuất bản hồ sơ."
        >
          {content.sources.map((item, index) => {
            const update = (key: string, value: string) =>
              set(
                "sources",
                content.sources.map((row, i) => (i === index ? { ...row, [key]: value || null } : row)),
              )
            return (
              <CompactEntry
                key={index}
                title={item.label}
                meta={[item.url, item.checkedOn].filter(Boolean).join(" · ")}
                icon={BookOpenText}
                onRemove={() =>
                  set(
                    "sources",
                    content.sources.filter((_, i) => i !== index),
                  )
                }
              >
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
              </CompactEntry>
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
