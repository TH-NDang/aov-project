import { useState } from "react"
import { ChartNoAxesColumn, Crosshair, ListTree } from "lucide-react"
import { Button } from "@aov/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@aov/ui/components/dialog"
import { gameplayIcons, type GameplayIconName } from "@aov/ui/components/gameplay-icons"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import { HeroStatAnalysisPanel } from "./hero-stat-analysis-panel"
import {
  combatAttributeRows,
  formatStat,
  observedAttributes,
  overviewAttackStats,
  type AttributeRow,
  type StatDefault,
} from "./combat-attributes"
import type { Role, Skills, Stats } from "./types"

type AttributeView = "all" | "compare"

const statArtwork: Partial<Record<string, GameplayIconName>> = {
  HP: "heart",
  ATTACK_DAMAGE: "sword",
  ABILITY_POWER: "orb",
  ARMOR: "shield",
  MAGIC_DEFENSE: "runeShield",
  MAX_RESOURCE: "mana",
  MOVEMENT_SPEED: "boot",
  ARMOR_PIERCE: "pierce",
  MAGIC_PIERCE: "pierce",
  BONUS_ATTACK_SPEED: "bolt",
  CRITICAL_CHANCE: "crit",
  CRITICAL_DAMAGE: "critDamage",
  PHYSICAL_LIFESTEAL: "vamp",
  MAGIC_LIFESTEAL: "vamp",
  COOLDOWN_REDUCTION: "cooldown",
}

/** The game's own silhouette for a stat, so a stat looks the same here, in terms and on the Wiki. */
function StatIcon({ statKey }: { statKey: string }) {
  const name = statArtwork[statKey]
  const Icon = name ? gameplayIcons[name] : Crosshair
  return <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
}

function ObservationNote({ observation }: { observation: ReturnType<typeof observedAttributes> }) {
  if (!observation) return null
  return (
    <p className="type-meta break-words">
      Ghi nhận từ ảnh{observation.patchCode && ` · ${observation.patchCode}`} ·{" "}
      {observation.level == null ? "Chưa xác định cấp tướng" : `Cấp ${observation.level}`}
      {observation.image && <span className="block">{observation.image}</span>}
    </p>
  )
}

/** Every attribute by group, with where its value comes from, its growth and the patch default it is checked against. */
function AttributeList({ rows, columns = false }: { rows: AttributeRow[]; columns?: boolean }) {
  return (
    <div className={columns ? "gap-8 sm:columns-2" : "space-y-4"}>
      {(["Cơ bản", "Tấn công", "Khác"] as const).map((group) => {
        const entries = rows.filter((row) => row.group === group)
        return (
          entries.length > 0 && (
            <section key={group} className="mb-4 break-inside-avoid last:mb-0">
              <h4 className="type-label mb-1">{group}</h4>
              <dl className="divide-y">
                {entries.map((row) => (
                  <div
                    key={row.key}
                    className="grid grid-cols-[auto_minmax(0,1fr)_minmax(6rem,auto)] items-start gap-2 py-2"
                  >
                    <span className="pt-0.5">
                      <StatIcon statKey={row.key} />
                    </span>
                    <dt className="type-body break-words">{row.label}</dt>
                    <dd className="min-w-0 text-right">
                      <span className="type-body tabular-nums">{row.value}</span>
                      {(row.kind !== "Ghi nhận từ ảnh" || row.reference) && (
                        <span className="type-meta block">{row.kind}</span>
                      )}
                      {row.growth != null && (
                        <span className="type-meta block">
                          {row.growth > 0 ? "+" : ""}
                          {row.growth} / cấp
                        </span>
                      )}
                      {row.kind === "Giá trị riêng" && row.observed && row.observed !== row.value && (
                        <span className="type-meta block">Ảnh ghi {row.observed}</span>
                      )}
                      {row.reference && (
                        <a
                          className="type-meta block underline underline-offset-2"
                          href={row.reference.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {row.matchesDefault
                            ? "Khớp mặc định"
                            : `Mặc định ${formatStat(row.reference.baseValue, row.reference.unit)}`}{" "}
                          · {row.reference.patchCode}
                        </a>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )
        )
      })}
      {rows.some((r) => r.key === "CRITICAL_DAMAGE") && (
        <p className="type-meta break-inside-avoid border-t pt-2">
          Tỷ lệ chí mạng là xác suất đòn đánh gây chí mạng. Sát thương chí mạng là hệ số khi đòn đánh đó xảy ra (200% =
          ×2, 175% = ×1,75).
        </p>
      )}
    </div>
  )
}

/**
 * The attributes a reader looks for first, as rows like the ratings above them. The whole list and the comparison with
 * other heroes open in a window of their own, wide enough for both, so the narrow column beside the hero stays short.
 */
export function HeroCombatAttributes({
  stats,
  skills,
  roles = [],
  defaults,
  heroId,
  variantId,
  patchCode,
  referenceError,
}: {
  stats: Stats | null
  skills: Skills | null
  roles?: Role[]
  defaults?: StatDefault[]
  heroId?: string
  variantId?: string
  patchCode?: string
  referenceError?: boolean
}) {
  const [view, setView] = useState<AttributeView | null>(null)
  const snapshot = observedAttributes(skills)
  const observation = patchCode && snapshot?.patchCode !== patchCode ? observedAttributes(skills, patchCode) : snapshot
  const rows = combatAttributeRows(stats, observation, defaults ?? [])
  const summary = ["HP", ...overviewAttackStats(roles, skills), "MOVEMENT_SPEED", "ATTACK_RANGE_TYPE"]
    .map((key) => rows.find((r) => r.key === key && r.value !== "—"))
    .filter((r) => !!r)
  const sameSource = summary.every((r) => r.kind === summary[0]?.kind)
  const comparable = !!heroId && rows.length > 0
  return (
    <div className="space-y-3">
      {summary.length > 0 ? (
        <div className="space-y-2">
          <dl className="space-y-2.5" aria-label="Thuộc tính nổi bật theo vai trò">
            {summary.map((r) => (
              <div key={r.key} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                <StatIcon statKey={r.key} />
                <dt className="type-body text-muted-foreground">{r.label}</dt>
                <dd className="type-body text-right tabular-nums">
                  {r.value}
                  {!sameSource && <span className="type-meta block">{r.kind}</span>}
                </dd>
              </div>
            ))}
          </dl>
          {sameSource && (
            <p className="type-meta">
              {summary[0].kind}
              {summary[0].kind === "Ghi nhận từ ảnh" && observation?.level == null && " · Chưa xác định cấp tướng"}
            </p>
          )}
        </div>
      ) : (
        // Without the attributes read first there is nothing to sum up, so the list itself takes the card.
        rows.length > 0 && (
          <div className="space-y-3">
            <ObservationNote observation={observation} />
            <AttributeList rows={rows} />
          </div>
        )
      )}
      {summary.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" data-review-attributes onClick={() => setView("all")}>
            <ListTree className="size-4" />
            Toàn bộ thuộc tính
            <span className="type-meta tabular-nums">{rows.length}</span>
          </Button>
          {comparable && (
            <Button type="button" variant="outline" size="sm" onClick={() => setView("compare")}>
              <ChartNoAxesColumn className="size-4" />
              So sánh
            </Button>
          )}
        </div>
      )}
      {!rows.length && <p className="type-meta">Chưa ghi nhận thuộc tính cho phiên bản này.</p>}
      {snapshot && !observation && (
        <p className="type-meta">Ảnh thuộc patch {snapshot.patchCode ?? "chưa xác định"}.</p>
      )}
      {referenceError && (
        <p role="status" className="type-meta">
          Chưa tải được mặc định của patch.
        </p>
      )}
      <Dialog open={view !== null} onOpenChange={(open) => !open && setView(null)}>
        <DialogContent data-attributes-window className="max-h-[88dvh] gap-4 overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="type-section-title">Thuộc tính chiến đấu</DialogTitle>
            <DialogDescription className="sr-only">
              Toàn bộ thuộc tính của phiên bản và so sánh với các tướng khác cùng patch.
            </DialogDescription>
          </DialogHeader>
          <Tabs value={view ?? "all"} onValueChange={(next) => setView(next as AttributeView)}>
            {comparable && (
              <TabsList>
                <TabsTrigger value="all">Thuộc tính</TabsTrigger>
                <TabsTrigger value="compare">So sánh</TabsTrigger>
              </TabsList>
            )}
            <TabsContent value="all" className="space-y-3">
              <ObservationNote observation={observation} />
              <AttributeList rows={rows} columns />
            </TabsContent>
            {comparable && (
              <TabsContent value="compare">
                {variantId && patchCode ? (
                  <HeroStatAnalysisPanel
                    key={heroId + variantId}
                    rows={rows}
                    heroId={heroId!}
                    variantId={variantId}
                    patchCode={patchCode}
                    roles={roles}
                    level={observation?.level ?? null}
                    defaultsReady={defaults !== undefined}
                    referenceError={referenceError}
                  />
                ) : (
                  <p className="type-meta">Cần xác định patch của phiên bản để đối chiếu thuộc tính.</p>
                )}
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
