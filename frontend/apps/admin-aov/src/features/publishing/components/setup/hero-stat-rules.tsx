import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Pencil } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { heroStatTerm } from "@aov/ui/lib/hero-stat-terms"
import { referenceTranslation } from "@aov/ui/lib/entity-rich-text"
import { useSession } from "@/app/auth/auth-gate"
import { backendRequest } from "@/app/auth/session"
import { errorMessage } from "@/lib/api/errors"
import { publishingKeys } from "@/lib/api/publishing-api"
import { referenceSettingsQuery } from "../../../terminology/settings-api"
import { Field } from "../editing/fields"
import { STAT_LABELS, statLabel } from "../../model/patch-changes/patch-change-model"
import {
  combatAttributeKeys,
  sharedStatText,
  statCapText,
  statUnit,
  type StatRule,
} from "../../model/assessment/combat-attributes"
import { formatStatNumber, hasStatPercent } from "../../model/assessment/stat-reading"

/** What every hero shares for each stat, whatever the patch (V086). */
export function useHeroStatRules() {
  return useQuery({
    queryKey: publishingKeys.heroStatRules,
    queryFn: ({ signal }) => backendRequest<StatRule[]>("/admin/hero-stat-rules", { signal }),
    staleTime: 60000,
  })
}

/** The glossary's plain explanation of a stat, without its links, for a hint beside the stat. */
export function useStatExplanations() {
  const settings = useQuery(referenceSettingsQuery)
  const entities = settings.data?.settings.entities ?? []
  return (statKey: string) => {
    const id = heroStatTerm(statKey)
    const term = id ? entities.find((entity) => entity.kind === "term" && entity.id === id) : undefined
    const text = term && referenceTranslation(term, "vi-VN", settings.data?.settings.fallbackLocale ?? "vi-VN")
    return text?.description.replace(/<\/?[a-z]+(?:=[^>]*)?>/gi, "").trim() || undefined
  }
}

/** Every stat a shared value can be set for: the attribute screen's order, then the other known stats. */
const ruleKeys = (rules: StatRule[]) =>
  Array.from(
    new Set([
      ...combatAttributeKeys.filter((key) => key !== "ATTACK_RANGE_TYPE"),
      ...Object.keys(STAT_LABELS),
      ...rules.map((rule) => rule.statKey),
    ]),
  )

type Draft = {
  key: string
  base: string
  percent: string
  growth: string
  cap: string
  source: string
  unit: StatRule["unit"]
  version: number
}

const text = (value: number | null | undefined) => (value == null ? "" : String(value))
const number = (value: string) => (value.trim() === "" ? null : Number(value))

function draftOf(key: string, rule?: StatRule): Draft {
  return {
    key,
    base: text(rule?.baseValue),
    percent: text(rule?.percentValue),
    growth: text(rule?.growthPerLevel),
    cap: text(rule?.capValue),
    source: rule?.sourceUrl ?? "",
    unit: rule?.unit ?? statUnit(key),
    version: rule?.version ?? 0,
  }
}

/** The shared values of one stat on a line: the level 1 value, the rise per level and the cap. */
export function sharedRuleSummary(rule: StatRule) {
  return [
    sharedStatText(rule),
    rule.growthPerLevel != null && `+${formatStatNumber(rule.growthPerLevel)}/cấp`,
    statCapText(rule),
  ]
    .filter(Boolean)
    .join(" · ")
}

/**
 * The values every hero shares, whatever the patch: the level 1 value, the rise per level and the most the stat reaches
 * in a match. A hero records its own value only where it differs.
 */
export function HeroStatRulesEditor() {
  const query = useHeroStatRules()
  const explain = useStatExplanations()
  const cache = useQueryClient()
  const canWrite = useSession().actor?.capabilities.includes("hero:write") ?? false
  const [draft, setDraft] = useState<Draft | null>(null)
  const rules = query.data ?? []
  const refresh = () => cache.invalidateQueries({ queryKey: publishingKeys.heroStatRules })
  const save = useMutation({
    mutationFn: (input: Draft) =>
      backendRequest<StatRule>(`/admin/hero-stat-rules/${input.key}`, {
        method: "PUT",
        body: JSON.stringify({
          unit: input.unit,
          baseValue: number(input.base),
          percentValue: hasStatPercent(input.key) ? number(input.percent) : null,
          growthPerLevel: number(input.growth),
          capValue: number(input.cap),
          sourceUrl: input.source.trim() || null,
          expectedVersion: input.version,
        }),
      }),
    onSuccess: async () => {
      setDraft(null)
      await refresh()
    },
    onError: () => void query.refetch(),
    meta: { silent: true },
  })
  const remove = useMutation({
    mutationFn: (input: Draft) =>
      backendRequest<void>(`/admin/hero-stat-rules/${input.key}?expectedVersion=${input.version}`, {
        method: "DELETE",
      }),
    onSuccess: async () => {
      setDraft(null)
      await refresh()
    },
    onError: () => void query.refetch(),
    meta: { silent: true },
  })
  const busy = save.isPending || remove.isPending
  const empty = draft && !draft.base.trim() && !draft.growth.trim() && !draft.cap.trim()
  if (query.isPending) return <p className="type-meta">Đang tải mặc định chung…</p>
  if (query.error) return <p role="alert">{errorMessage(query.error)}</p>
  return (
    <div className="space-y-3">
      <p className="type-meta">
        Giá trị mọi tướng giống nhau, không theo patch. Tướng nào khác thì nhập giá trị riêng trong tướng đó.
      </p>
      <ul className="divide-y" aria-label="Mặc định chung của chỉ số">
        {ruleKeys(rules).map((key) => {
          const rule = rules.find((entry) => entry.statKey === key)
          const editing = draft?.key === key
          const hint = explain(key)
          return (
            <li key={key} className="space-y-2 py-2.5" data-stat-rule={key}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="type-label">{statLabel(key)}</p>
                  <p className="type-meta tabular-nums">{rule ? sharedRuleSummary(rule) : "Mỗi tướng một giá trị"}</p>
                  {hint && !editing && <p className="type-meta line-clamp-2 text-muted-foreground">{hint}</p>}
                  {rule?.sourceUrl && !editing && (
                    <a className="type-meta underline" href={rule.sourceUrl} target="_blank" rel="noreferrer">
                      Nguồn
                    </a>
                  )}
                </div>
                {canWrite && !editing && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    aria-label={`Sửa mặc định ${statLabel(key)}`}
                    onClick={() => {
                      save.reset()
                      remove.reset()
                      setDraft(draftOf(key, rule))
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                )}
              </div>
              {editing && draft && (
                <form
                  className="grid grid-cols-2 gap-3 rounded-lg border p-3"
                  onSubmit={(event) => {
                    event.preventDefault()
                    // The sheet still sits inside the hero's section form in React's event tree.
                    event.stopPropagation()
                    save.mutate(draft)
                  }}
                >
                  <Field
                    label={draft.unit === "PERCENT" ? "Cấp 1 (%)" : "Cấp 1"}
                    type="number"
                    step="any"
                    min={0}
                    value={draft.base}
                    onChange={(base) => setDraft({ ...draft, base })}
                  />
                  {hasStatPercent(key) ? (
                    <Field
                      label="Phần trăm sau dấu |"
                      type="number"
                      step="any"
                      min={0}
                      max={100}
                      value={draft.percent}
                      onChange={(percent) => setDraft({ ...draft, percent })}
                    />
                  ) : (
                    <Field
                      label="Tăng mỗi cấp"
                      type="number"
                      step="any"
                      min={0}
                      value={draft.growth}
                      onChange={(growth) => setDraft({ ...draft, growth })}
                    />
                  )}
                  {hasStatPercent(key) && (
                    <Field
                      label="Tăng mỗi cấp"
                      type="number"
                      step="any"
                      min={0}
                      value={draft.growth}
                      onChange={(growth) => setDraft({ ...draft, growth })}
                    />
                  )}
                  <Field
                    label={draft.unit === "PERCENT" ? "Tối đa (%)" : "Tối đa"}
                    type="number"
                    step="any"
                    min={0}
                    value={draft.cap}
                    onChange={(cap) => setDraft({ ...draft, cap })}
                  />
                  <div className="col-span-2">
                    <Field
                      type="url"
                      label="Nguồn (không bắt buộc)"
                      value={draft.source}
                      onChange={(source) => setDraft({ ...draft, source })}
                    />
                  </div>
                  {empty && <p className="type-meta col-span-2">Nhập ít nhất cấp 1, tăng mỗi cấp hoặc tối đa.</p>}
                  <div className="col-span-2 flex flex-wrap gap-2">
                    <Button type="submit" size="sm" disabled={busy || !!empty}>
                      Lưu
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setDraft(null)}>
                      Hủy
                    </Button>
                    {draft.version > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-destructive"
                        disabled={busy}
                        onClick={() => remove.mutate(draft)}
                      >
                        Bỏ mặc định
                      </Button>
                    )}
                  </div>
                  {(save.error || remove.error) && (
                    <p role="alert" className="type-meta col-span-2 text-destructive">
                      {errorMessage(save.error ?? remove.error)}
                    </p>
                  )}
                </form>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
