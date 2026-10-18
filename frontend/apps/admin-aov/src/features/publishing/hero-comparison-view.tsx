import { useId } from "react"
import { ArrowRight, BookOpenText, ChevronDown, Plus, Minus } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { AdminEntityText } from "../terminology/catalog"
import { ChangeKindBadges } from "./hero-change-badges"
import { ComparisonSkillIcon } from "./comparison-skill-icon"
import { comparisonPathLabels, comparisonValue, plainComparisonText, textDifference } from "./hero-comparison"
import type { HeroComparison } from "./publishing-api"
import type { SkillComparisonGroup } from "./hero-skill-comparison"

export type DescriptionDiffMode = "inline" | "split"

function ContentText({ value }: { value: unknown }) {
  return <AdminEntityText text={comparisonValue(value)} />
}

export function DescriptionComparison({
  before,
  after,
  mode,
}: {
  before: unknown
  after: unknown
  mode: DescriptionDiffMode
}) {
  const previous = comparisonValue(before)
  const current = comparisonValue(after)
  const previousText = plainComparisonText(previous)
  const currentText = plainComparisonText(current)
  const segments = textDifference(previousText, currentText)
  const sideContent = (side: "before" | "after") =>
    previousText === currentText ? (
      <AdminEntityText text={side === "before" ? previous : current} />
    ) : (
      segments.map((segment, index) => {
        if ((side === "before" && segment.type === "added") || (side === "after" && segment.type === "removed"))
          return null
        const content = <AdminEntityText text={segment.text} />
        if (segment.type === "removed")
          return (
            <del
              key={index}
              className="rounded-sm bg-amber-500/15 px-0.5 font-medium text-foreground no-underline dark:bg-amber-400/20"
            >
              {content}
            </del>
          )
        if (segment.type === "added")
          return (
            <ins key={index} className="rounded-sm bg-sky-500/15 px-0.5 font-medium no-underline dark:bg-sky-400/20">
              {content}
            </ins>
          )
        return <span key={index}>{content}</span>
      })
    )
  return mode === "split" ? (
    <div className="grid @min-[620px]:grid-cols-2">
      <div className="min-w-0 border-b bg-muted/15 p-4 @min-[620px]:border-r @min-[620px]:border-b-0">
        <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
          Trước
          {previousText !== currentText && segments.some((segment) => segment.type === "removed") && (
            <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-foreground dark:bg-amber-400/20">
              Phần được thay hoặc bỏ
            </span>
          )}
        </p>
        <div data-description-side="before" className="whitespace-pre-wrap break-words text-sm leading-7">
          {sideContent("before")}
        </div>
      </div>
      <div className="min-w-0 p-4">
        <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
          Sau
          {previousText !== currentText && segments.some((segment) => segment.type === "added") && (
            <span className="rounded-sm bg-sky-500/15 px-1.5 py-0.5 text-foreground dark:bg-sky-400/20">Phần mới</span>
          )}
        </p>
        <div data-description-side="after" className="whitespace-pre-wrap break-words text-sm leading-7">
          {sideContent("after")}
        </div>
      </div>
    </div>
  ) : (
    <div className="whitespace-pre-wrap break-words p-4 text-sm leading-7">
      {previousText === currentText && previous !== current && (
        <p className="mb-2 text-xs text-muted-foreground">
          Chữ giữ nguyên; định dạng hoặc tham chiếu đã thay đổi. Chọn Hai cột để đối chiếu.
        </p>
      )}
      {segments.map((segment, index) =>
        segment.type === "same" ? (
          <span key={index}>
            <AdminEntityText text={segment.text} />
          </span>
        ) : segment.type === "removed" ? (
          <del
            key={index}
            className="mx-0.5 rounded-sm bg-muted px-0.5 text-muted-foreground decoration-muted-foreground"
          >
            <AdminEntityText text={segment.text} />
          </del>
        ) : (
          <ins key={index} className="mx-0.5 rounded-sm bg-primary/10 px-0.5 font-medium no-underline">
            <AdminEntityText text={segment.text} />
          </ins>
        ),
      )}
    </div>
  )
}

function skillCaption(group: SkillComparisonGroup) {
  const skill = group.afterSkill ?? group.beforeSkill
  if (skill?.kind === "PASSIVE") return "Nội tại"
  const slot = group.skillKey.match(/^skill-(\d+)-\d+$/)?.[1]
  return slot ? `Chiêu ${slot}` : "Kỹ năng"
}

export function SkillComparisonCard({
  group,
  mode,
  referenceCodes,
}: {
  group: SkillComparisonGroup
  mode: DescriptionDiffMode
  referenceCodes: readonly string[]
}) {
  const heading = useId()
  const rows = group.rows.filter((row) => row.id !== "iconAssetId")
  const descriptions = (
    <div className="divide-y">
      {group.descriptions.map((description) => (
        <div key={description.locale}>
          {group.descriptions.length > 1 && (
            <p className="px-4 pt-3 text-xs font-medium text-muted-foreground">{description.locale}</p>
          )}
          <DescriptionComparison before={description.before} after={description.after} mode={mode} />
        </div>
      ))}
    </div>
  )
  return (
    <article
      data-skill-key={group.skillKey}
      aria-labelledby={heading}
      className="@container min-w-0 overflow-hidden rounded-xl border bg-card"
    >
      <header className="flex flex-wrap items-center gap-3 bg-muted/15 p-4">
        <ComparisonSkillIcon before={group.beforeSkill} after={group.afterSkill} referenceCodes={referenceCodes} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs text-muted-foreground">{skillCaption(group)}</p>
          <h4 id={heading} className="break-words font-semibold">
            {group.name}
          </h4>
        </div>
        {(group.kind !== "CHANGED" || group.kinds.length > 0) && (
          <div className="flex w-full flex-wrap items-center gap-2 @min-[480px]:w-auto">
            {group.kind !== "CHANGED" && (
              <Badge variant="outline" className="gap-1">
                {group.kind === "ADDED" ? <Plus className="size-3" /> : <Minus className="size-3" />}
                {group.kind === "ADDED" ? "Kỹ năng mới" : "Đã bỏ"}
              </Badge>
            )}
            {group.kinds.length > 0 && <ChangeKindBadges kinds={group.kinds} maxVisible={6} />}
          </div>
        )}
      </header>
      {rows.length > 0 && (
        <table className="w-full table-fixed border-collapse text-left text-xs @min-[620px]:text-sm">
          <caption className="sr-only">Chỉ số trước và sau của {group.name}</caption>
          <colgroup>
            <col className="w-[38%]" />
            <col className="w-[31%]" />
            <col className="w-[31%]" />
          </colgroup>
          <thead>
            <tr className="border-y bg-muted/25 text-muted-foreground">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Chỉ số / cơ chế
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Trước
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Sau
              </th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.id} data-comparison-row={row.id}>
                <th scope="row" className="break-words px-4 py-3 align-top font-medium leading-6">
                  <span className="flex flex-wrap items-center gap-2">
                    {row.label}
                    {row.kinds.length > 0 && <ChangeKindBadges kinds={row.kinds} compact maxVisible={6} />}
                  </span>
                </th>
                <td className="whitespace-pre-wrap break-words bg-muted/10 px-3 py-3 align-top leading-6 text-muted-foreground">
                  <ContentText value={row.before} />
                </td>
                <td className="whitespace-pre-wrap break-words px-3 py-3 align-top font-medium leading-6">
                  <ContentText value={row.after} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {group.descriptions.length > 0 &&
        (rows.length ? (
          <details className="group/description border-t">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/20 focus-visible:outline-2 focus-visible:outline-ring">
              <BookOpenText className="size-4" />
              Đối chiếu mô tả đầy đủ
              <ChevronDown className="ml-auto size-4 transition-transform group-open/description:rotate-180" />
            </summary>
            {descriptions}
          </details>
        ) : (
          descriptions
        ))}
    </article>
  )
}

export function OtherComparisonCard({
  change,
  comparison,
  locale,
  mode,
}: {
  change: HeroComparison["changes"][number]
  comparison: HeroComparison
  locale: string
  mode: DescriptionDiffMode
}) {
  const labels = comparisonPathLabels(change.section, change.path, [comparison.after, comparison.before], locale)
  const numberDelta =
    typeof change.before === "number" && typeof change.after === "number" ? change.after - change.before : null
  return (
    <article className="@container min-w-0 overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/15 px-4 py-3">
        <h4 className="min-w-0 break-words text-sm font-medium">{labels.join(" / ")}</h4>
        <Badge variant="outline">
          {change.kind === "ADDED" ? "Bổ sung" : change.kind === "REMOVED" ? "Đã bỏ" : "Thay đổi"}
        </Badge>
      </header>
      {numberDelta !== null ? (
        <div className="flex flex-wrap items-center gap-3 p-4 tabular-nums">
          <span className="text-muted-foreground">
            <ContentText value={change.before} />
          </span>
          <ArrowRight className="size-4 text-muted-foreground" />
          <strong>
            <ContentText value={change.after} />
          </strong>
          <Badge variant="secondary">
            {numberDelta > 0 ? "+" : ""}
            {Number(numberDelta.toFixed(6))}
          </Badge>
        </div>
      ) : (
        <DescriptionComparison before={change.before} after={change.after} mode={mode} />
      )}
    </article>
  )
}
