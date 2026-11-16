import { useEffect, useRef, useState } from "react"
import { catalogIcons } from "@aov/ui/components/catalog-icons"
import { gameplayIcons } from "@aov/ui/components/gameplay-icons"
import { navArtIcons } from "@aov/ui/components/nav-art-icons"
import { PublicDrawer, PublicDrawerContent } from "@aov/ui/components/public-overlay"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { WikiIcon } from "../../components/wiki-icon"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { activeSection } from "./hero-section-position"
import "./hero-section-nav.css"

/** Every section a hero page can have, in the wide layout's order. Those missing from a given hero are left out. */
const SECTIONS = [
  { id: "wiki-hero-overview", Icon: navArtIcons.characterBook, vi: "Tổng quan", en: "Overview" },
  { id: "wiki-hero-stats", Icon: gameplayIcons.table, vi: "Chỉ số", en: "Stats" },
  { id: "wiki-hero-lore", Icon: navArtIcons.glossary, vi: "Cốt truyện", en: "Lore" },
  { id: "wiki-version-changes", Icon: navArtIcons.releases, vi: "Thay đổi ở bản này", en: "This version's changes" },
  { id: "wiki-kit-title", Icon: gameplayIcons.bolt, vi: "Bộ kỹ năng", en: "Abilities" },
  { id: "wiki-hero-evaluation", Icon: gameplayIcons.crit, vi: "Đánh giá", en: "Assessment" },
  { id: "wiki-hero-builds", Icon: catalogIcons.items, vi: "Build đề cử", en: "Recommended builds" },
  { id: "wiki-hero-skins", Icon: catalogIcons.skins, vi: "Trang phục", en: "Skins" },
  { id: "hero-videos", Icon: navArtIcons.videos, vi: "Video", en: "Videos" },
  { id: "wiki-hero-history-title", Icon: gameplayIcons.cooldown, vi: "Các lần thay đổi khác", en: "Other changes" },
]

/** Far enough below the sticky header that a section counts as being read once its heading settles under it. */
const READING_LINE = 120

const pageTop = (id: string) => document.getElementById(id)?.getBoundingClientRect().top ?? 0

function goToSection(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  if (target instanceof HTMLDetailsElement) target.open = true
  // Instant on purpose: an animated scroll stops partway when images load in the sections it passes.
  target.scrollIntoView({ block: "start" })
  target.focus({ preventScroll: true })
}

function SectionLinks({
  sections,
  active,
  onPick,
}: {
  sections: typeof SECTIONS
  active?: string
  onPick: (id: string) => void
}) {
  const { locale } = useWikiContext()
  return (
    <ul className="wiki-hero-nav-list">
      {sections.map(({ id, Icon, vi, en }) => (
        <li key={id}>
          <a
            href={`#${id}`}
            aria-current={id === active ? "location" : undefined}
            onClick={(event) => {
              event.preventDefault()
              onPick(id)
            }}
          >
            <Icon size={18} />
            {wikiText(locale, vi, en)}
          </a>
        </li>
      ))}
    </ul>
  )
}

/** The hero page's contents: a side column on wide screens, a floating button and bottom drawer below that. */
export function HeroSectionNav() {
  const { locale } = useWikiContext()
  const layout = usePageLayout()
  const title = wikiText(locale, "Trên trang này", "On this page")
  const rail = useRef<HTMLElement>(null)
  const pendingJump = useRef<string | null>(null)
  const [present, setPresent] = useState<string[]>([])
  const [active, setActive] = useState<string>()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    const page = rail.current?.parentElement
    if (!page) return
    // Several sections load on their own schedule or hide when empty, so the list follows what is really there.
    const read = () =>
      setPresent((current) => {
        const found = SECTIONS.filter((section) => document.getElementById(section.id)).map((section) => section.id)
        // The single column has its own order, and the list follows what the reader sees.
        const next = layout === "compact" ? found.sort((a, b) => pageTop(a) - pageTop(b)) : found
        return next.join() === current.join() ? current : next
      })
    read()
    const observer = new MutationObserver(read)
    observer.observe(page, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [layout])

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const positions = present.flatMap((id) => {
        const box = document.getElementById(id)?.getBoundingClientRect()
        return box ? [{ id, top: box.top }] : []
      })
      const page = document.documentElement
      const atEnd =
        page.scrollHeight > window.innerHeight && window.scrollY + window.innerHeight >= page.scrollHeight - 2
      setActive(activeSection(positions, READING_LINE, atEnd))
    }
    const schedule = () => {
      frame ||= requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [present])

  const sections = present.flatMap((id) => SECTIONS.filter((section) => section.id === id))
  const worthShowing = sections.length > 1

  return (
    <>
      <nav ref={rail} className="wiki-hero-nav" aria-label={title} hidden={!worthShowing}>
        <h2>{title}</h2>
        <SectionLinks sections={sections} active={active} onPick={goToSection} />
      </nav>
      {worthShowing && (
        <>
          <button
            type="button"
            className="wiki-hero-nav-fab"
            aria-label={title}
            title={title}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <WikiIcon name="contents" size={22} />
          </button>
          <PublicDrawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <PublicDrawerContent
              title={title}
              aria-describedby={undefined}
              // The drawer holds the page still while it is open, so the jump waits until it has gone.
              onCloseAutoFocus={(event) => {
                if (!pendingJump.current) return
                event.preventDefault()
                goToSection(pendingJump.current)
                pendingJump.current = null
              }}
            >
              <nav aria-label={title} className="wiki-hero-nav-sheet">
                <SectionLinks
                  sections={sections}
                  active={active}
                  onPick={(id) => {
                    pendingJump.current = id
                    setDrawerOpen(false)
                  }}
                />
              </nav>
            </PublicDrawerContent>
          </PublicDrawer>
        </>
      )}
    </>
  )
}
