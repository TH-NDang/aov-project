import { useState } from "react"
import type { Preview, Section, Skill } from "@/lib/hero-types"
import { usePatchCaptureWorkspace } from "../../api/use-patch-captures"
import { captureFocus, type CaptureTarget } from "../../model/captures/patch-capture-model"
import type { HeroContentTab, readHeroLocation } from "../../model/hero-location"

const noSkills: Skill[] = []

/**
 * The source screenshots of the hero beside its page. The panel follows what the page shows, and the page follows the
 * panel: picking a group or a part of a screenshot opens what it is the source of.
 */
export function useHeroCaptures({
  heroId,
  heroName,
  preview,
  patchCode,
  ready,
  location,
  editing,
  skillKey,
  updateLocation,
}: {
  heroId: string
  heroName: string
  preview: Preview | null
  patchCode: string | undefined
  ready: boolean
  location: ReturnType<typeof readHeroLocation>
  editing: boolean
  skillKey: string
  updateLocation: (patch: Record<string, string | null | undefined>) => void
}) {
  // What the capture panel last led the page to, while the page stays on that tab.
  const [capturePin, setCapturePin] = useState<{ tab: HeroContentTab; group: string } | null>(null)
  const [contentReveal, setContentReveal] = useState<{ section: Section; at: number } | null>(null)
  const { view, tab, section } = location

  const followCapture = (target: CaptureTarget) => {
    if (editing || view !== "overview") return
    setCapturePin(target.tab === "overview" ? { tab: target.tab, group: target.group } : null)
    updateLocation({
      tab: target.tab === "overview" ? null : target.tab,
      ...(target.skill ? { skill: target.skill } : {}),
      ...(target.skin ? { skin: target.skin } : {}),
    })
    setContentReveal(target.section ? { section: target.section, at: Date.now() } : null)
  }
  const captures = usePatchCaptureWorkspace({
    heroId,
    heroName: preview?.content.PROFILE ? heroName : "",
    patchCode,
    skills: preview?.content.SKILLS?.skills ?? noSkills,
    locale: location.readLocale,
    ready,
    focus: captureFocus({
      view,
      tab,
      editing,
      section,
      skillKey,
      skills: preview?.content.SKILLS?.skills ?? noSkills,
      pinned: capturePin?.tab === tab ? capturePin.group : undefined,
    }),
    onNavigate: followCapture,
  })

  return { captures, contentReveal }
}
