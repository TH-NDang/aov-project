import { useRef, type ReactNode } from "react"
import { usePageLayout } from "@aov/ui/hooks/use-page-layout"
import { PlaceBar, PlaceTrail, type Place } from "./place-trail"
import { Stage, type StageLight } from "./stage"
import { useStreamLocale } from "./stream-locale"
import "./page-head.css"

/** A number a page is known by and what it counts; a `title` is gold. */
export type HeadFigure = { value: string; label: string; title?: boolean }

/**
 * Who a page is, across the window and in its own colours: where it stands, the cover when it has one, the mark, the
 * name, the page's buttons, then its figures and channels. On a wide layout the tabs close it and stay in reach.
 */
export function PageHead({
  tint,
  lights,
  places,
  coverUrl,
  mark,
  smallMark,
  title,
  live = false,
  kicker,
  name,
  lines,
  figures = [],
  actions,
  aside,
  channels,
  tabs,
}: {
  /** The name the stage takes a hue from when no logo lights it. */
  tint: string
  lights: StageLight[]
  /** The pages above this one. */
  places: Place[]
  coverUrl?: string | null
  mark: ReactNode
  /** The mark beside the name once the head is scrolled away. */
  smallMark?: ReactNode
  /** The page's name as plain text. */
  title: string
  live?: boolean
  /** What the page is and where it is from. */
  kicker: ReactNode
  name: ReactNode
  /** Rows under the name, such as a player's team. */
  lines?: ReactNode
  /** Already without the ones the page does not have. */
  figures?: HeadFigure[]
  actions?: ReactNode
  /** What the page is known for, at the other end of the stage. */
  aside?: ReactNode
  channels?: ReactNode
  tabs?: ReactNode
}) {
  const { text } = useStreamLocale()
  const wide = usePageLayout() === "wide"
  const head = useRef<HTMLElement>(null)
  return (
    <>
      <header ref={head} className="ph" data-place-head="" data-cover={coverUrl ? "" : undefined}>
        <Stage tint={tint} lights={lights} bleeds className="ph-stage">
          <div className="ph-inner">
            <PlaceTrail places={places} />
            {coverUrl && <img className="ph-cover" src={coverUrl} alt="" />}
            <div className="ph-identity">
              <span className="ph-mark" data-place-mark="" data-live={live || undefined}>
                {mark}
              </span>
              <div className="ph-title">
                <p className="ph-kicker">
                  <span>{kicker}</span>
                  {live && <span className="tn-live">{text("Trực tiếp", "Live")}</span>}
                </p>
                <h1>{name}</h1>
                {lines}
              </div>
              {aside}
              {actions && <div className="ph-actions">{actions}</div>}
            </div>
            {(figures.length > 0 || channels) && (
              <div className="ph-foot">
                {figures.length > 0 && (
                  <dl className="ph-figures">
                    {figures.map(({ value, label, title }) => (
                      <div key={label} data-title={title || undefined}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {channels}
              </div>
            )}
          </div>
        </Stage>
      </header>
      {wide && <PlaceBar head={head} places={places} name={title} mark={smallMark} tabs={tabs} />}
    </>
  )
}
