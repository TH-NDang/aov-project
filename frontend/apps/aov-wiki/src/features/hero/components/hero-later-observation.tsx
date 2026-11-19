import { WikiIcon } from "../../../components/wiki-icon"
import { useWikiContext, useWikiText } from "../../../context/wiki-context"
import type { HeroLaterObservation } from "../../../lib/hero-api"
import { PatchName } from "../../../components/hero-patch-name"

/**
 * Says that the selected patch has no observation of this hero yet, so the page shows what a later patch recorded;
 * the selected patch's own changes still come from its notes (ADR-016). It reads as a line under the version picker.
 */
export function HeroLaterObservationNote({ later }: { later: HeroLaterObservation }) {
  const scope = useWikiContext()
  const { options, patchVariantId, setScope } = scope
  const text = useWikiText()
  const selected = options?.patches.find((patch) => patch.id === patchVariantId)
  const target = options?.patches.find((patch) => patch.id === later.patchVariantId)
  const recorded = target ? <PatchName patch={target} /> : later.patchCode
  const open = () =>
    setScope(
      !target || target.isCurrent
        ? { seasonId: "", patchVariantId: "", includeUnscoped: false }
        : { seasonId: target.seasonId, patchVariantId: target.id, includeUnscoped: false },
    )

  return (
    <p className="wiki-hero-scope-note" role="note">
      <WikiIcon name="clock" size={16} />
      <span>
        {text("Kỹ năng bên dưới được ghi nhận ở bản ", "The abilities below were recorded in ")}
        {recorded}
        {selected
          ? text("; bản đang xem chưa có bản ghi riêng.", "; the version being read has no record of its own yet.")
          : "."}
      </span>
      <button type="button" onClick={open}>
        <span>
          {text("Xem bản ", "Open ")}
          {recorded}
        </span>
      </button>
    </p>
  )
}
