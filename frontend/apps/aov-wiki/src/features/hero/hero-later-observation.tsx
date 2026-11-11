import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import type { HeroLaterObservation } from "./hero-api"
import "./hero-later-observation.css"

/**
 * Says that the selected patch has no observation of this hero yet, so the page shows what a later patch recorded;
 * the selected patch's own changes still come from its notes (ADR-016).
 */
export function HeroLaterObservationNote({ later }: { later: HeroLaterObservation }) {
  const scope = useWikiContext()
  const { locale, options, patchVariantId, setScope } = scope
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const selected = options?.patches.find((patch) => patch.id === patchVariantId)
  const target = options?.patches.find((patch) => patch.id === later.patchVariantId)
  const open = () =>
    setScope(
      !target || target.isCurrent
        ? { seasonId: "", patchVariantId: "", includeUnscoped: false }
        : { seasonId: target.seasonId, patchVariantId: target.id, includeUnscoped: false },
    )

  return (
    <p className="wiki-hero-later" role="note">
      <WikiIcon name="clock" size={16} />
      <span>
        {selected
          ? text(
              `Kỹ năng bên dưới được ghi nhận ở bản ${later.patchCode}; bản ${selected.code} chưa có bản ghi riêng.`,
              `The abilities below were recorded in ${later.patchCode}; ${selected.code} has no record of its own yet.`,
            )
          : text(
              `Kỹ năng bên dưới được ghi nhận ở bản ${later.patchCode}.`,
              `The abilities below were recorded in ${later.patchCode}.`,
            )}
      </span>
      <button type="button" onClick={open}>
        {text(`Xem bản ${later.patchCode}`, `Open ${later.patchCode}`)}
      </button>
    </p>
  )
}
