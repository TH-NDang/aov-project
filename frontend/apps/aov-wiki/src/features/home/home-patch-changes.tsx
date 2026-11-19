import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"
import { LocalTime } from "@aov/ui/components/local-time"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { ChangeKindLabel } from "../../components/patch-changes-row"
import { WikiIcon } from "../../components/wiki-icon"
import { WikiImage } from "../../components/wiki-image"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { usePublishedChanges } from "../../lib/wiki-patch-changes"
import { heroCatalogQuery, type HeroListForm, type HeroListItem } from "../../lib/hero-api"
import { HERO_ROLES, localizedHeroOptions } from "../../lib/hero-classifications"
import { heroFormPath } from "../../lib/hero-forms"
import { seasonUpdatesQuery } from "./home-api"
import { patchDayLabel } from "../../lib/patch-day-label"

/** The order readers look for: who is new, who was remade, who got stronger, who got weaker, then the rest. */
const KIND_ORDER = ["RELEASE", "ADDED", "REWORK", "BUFF", "NERF", "ADJUSTMENT", "BALANCE", "FIX", "UPDATED", "REMOVED"]
const TONES: Record<string, string> = {
  RELEASE: "new",
  ADDED: "new",
  REWORK: "rework",
  BUFF: "up",
  NERF: "down",
}

/** A changed hero as the list shows it; `to` is missing while the hero has no published profile yet. */
type ChangedHero = { id: string; name: string; shown?: HeroListItem | HeroListForm; to?: string }

/** What the version in force changed, hero by hero, grouped by the kind of change. */
export function HomePatchChanges() {
  const scope = useWikiContext()
  const { locale, href, region, regions } = scope
  const layout = usePageLayout()
  const catalog = useQuery(heroCatalogQuery(scope))
  const updates = useQuery(seasonUpdatesQuery(scope))
  const { subjects, pending, failed, retry } = usePublishedChanges("HERO")
  const current = updates.data?.patches.find((patch) => patch.isCurrent)
  const date = current?.effectiveOn ?? current?.effectiveAt ?? ""
  const published = catalog.data?.items ?? []
  const heroes = new Map(published.map((hero) => [hero.id, hero]))
  // Changes are recorded per form, so a form's change opens that form on its hero's page (ADR-024).
  const forms = new Map(
    published.flatMap((hero) => (hero.forms ?? []).map((form) => [form.id, { hero, form }] as const)),
  )
  const roleLabels = new Map(localizedHeroOptions(HERO_ROLES, locale).map((role) => [role.value, role.label]))

  const groups = new Map<string, ChangedHero[]>()
  for (const subject of subjects.values()) {
    const owner = forms.get(subject.id)
    const hero = heroes.get(subject.id) ?? owner?.hero
    const shown = owner?.form ?? hero
    const entry: ChangedHero = {
      id: subject.id,
      name: shown?.name ?? subject.name ?? "",
      shown,
      to: hero && href(owner ? heroFormPath(hero.code, owner.form.formKey, hero.forms) : `/hero/${hero.code}`),
    }
    if (!entry.name) continue
    groups.set(subject.kind, [...(groups.get(subject.kind) ?? []), entry])
  }
  const ordered = [...groups].sort(
    ([a], [b]) => (KIND_ORDER.indexOf(a) + 1 || 99) - (KIND_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b),
  )
  // Names and pictures come from the hero list, so the rows wait for it instead of showing raw codes first.
  const loading = (pending && !ordered.length) || catalog.isPending
  const more = current && (
    <Link
      className="wiki-home-more"
      data-place={layout === "compact" ? "foot" : undefined}
      to={href(`/updates/${current.code}`)}
    >
      {wikiText(locale, "Xem ghi chú đầy đủ", "Read the full notes")}
      <WikiIcon name="arrow" size={16} />
    </Link>
  )

  return (
    <section className="wiki-home-changes" aria-labelledby="wiki-home-changes-title">
      <header className="wiki-home-heading">
        <div>
          <h2 id="wiki-home-changes-title">
            {current ? (
              <span>
                {wikiText(locale, "Thay đổi ở bản ", "Changed in version ")}
                <LocalTime
                  value={date}
                  sourceTimeZone={regions.find((market) => market.code === region)?.timeZone}
                  label={(zone) => patchDayLabel(date, zone)}
                  fallback={current.code}
                />
              </span>
            ) : (
              wikiText(locale, "Thay đổi ở bản hiện tại", "Changed in the current version")
            )}
          </h2>
          {current?.title && <p>{current.title}</p>}
        </div>
        {layout === "wide" && more}
      </header>

      {loading ? (
        <div className="wiki-home-changes-loading" role="status">
          <span className="sr-only">{wikiText(locale, "Đang tải thay đổi", "Loading changes")}</span>
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : ordered.length ? (
        <div className="wiki-home-change-groups">
          {ordered.map(([kind, entries]) => (
            <section key={kind} className="wiki-home-change-group" data-tone={TONES[kind] ?? "adjust"}>
              <h3>
                <ChangeKindLabel kind={kind} size={20} />
                <span>{entries.length}</span>
              </h3>
              <ul>
                {entries
                  .sort((a, b) => a.name.localeCompare(b.name, locale))
                  .map(({ id, name, shown, to }) => {
                    const image = shown?.head?.currentVersion?.url ?? shown?.portrait?.currentVersion?.url
                    const body = (
                      <>
                        <span className="wiki-home-change-art">{image && <WikiImage src={image} alt="" />}</span>
                        <span className="wiki-home-change-copy">
                          <strong>{name}</strong>
                          {shown && (
                            <small>{shown.roles.map((role) => roleLabels.get(role) ?? role).join(" · ")}</small>
                          )}
                        </span>
                      </>
                    )
                    return <li key={id}>{to ? <Link to={to}>{body}</Link> : <span>{body}</span>}</li>
                  })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        !failed && (
          <p className="wiki-home-changes-empty">
            {wikiText(
              locale,
              "Bản này chưa ghi nhận thay đổi nào về tướng.",
              "No hero changes are recorded for this version.",
            )}
          </p>
        )
      )}
      {layout === "compact" && more}
      {failed && (
        <p className="wiki-home-changes-empty" role="status">
          {wikiText(locale, "Chưa tải được hết ghi nhận thay đổi.", "Some changes could not be loaded.")}{" "}
          <button type="button" onClick={retry}>
            {wikiText(locale, "Thử lại", "Retry")}
          </button>
        </p>
      )}
    </section>
  )
}
