import { useState } from "react"
import { Link } from "react-router"
import { useQuery } from "@tanstack/react-query"
import { WikiImageCredit } from "../../../components/wiki-image-credit"
import { useWikiContext, useWikiText } from "../../../context/wiki-context"
import { heroCatalogQuery } from "../../../lib/hero-api"
import { ruleBlocks, type ModeImage } from "../auto-chess-model"
import { ObjectIcon } from "./map-board"
import { LaneMark } from "./map-glyph"
import {
  CATEGORY_NAMES,
  familyOf,
  objectsIn,
  refOf,
  SIDE_NAMES,
  timingText,
  type MapArea,
  type MapContent,
  type MapLane,
  type MapObject,
  type MapSpot,
  type Resolved,
} from "./map-model"
import "./map-details.css"

/** What the panel or the sheet shows about the chosen place. */
export function MapDetails({
  content,
  images,
  chosen,
  onPick,
  named = true,
}: {
  content: MapContent
  images: Record<string, ModeImage>
  chosen: Resolved
  onPick: (ref: string) => void
  /** False where a sheet's own title already names the place. */
  named?: boolean
}) {
  if (chosen.kind === "area")
    return <AreaDetails content={content} images={images} area={chosen.area} onPick={onPick} named={named} />
  if (chosen.kind === "lane") return <LaneDetails lane={chosen.lane} />
  return (
    <ObjectDetails
      key={chosen.object.code}
      content={content}
      images={images}
      object={chosen.object}
      spot={chosen.spot}
      onPick={onPick}
      named={named}
    />
  )
}

/** The name of the place; a sheet already titled with it keeps it for screen readers only. */
function Name({ named, children }: { named: boolean; children: string }) {
  return (
    <h2 id="wiki-map-details-name" className={named ? undefined : "sr-only"}>
      {children}
    </h2>
  )
}

function Blocks({ body }: { body: string | null | undefined }) {
  return ruleBlocks(body).map((block, index) =>
    block.kind === "text" ? (
      <p key={index}>{block.text}</p>
    ) : (
      <ul key={index}>
        {block.items.map((item, itemIndex) => (
          <li key={itemIndex}>{item}</li>
        ))}
      </ul>
    ),
  )
}

function ObjectDetails({
  content,
  images,
  object,
  spot,
  onPick,
  named,
}: {
  content: MapContent
  images: Record<string, ModeImage>
  object: MapObject
  spot: MapSpot | null
  onPick: (ref: string) => void
  named: boolean
}) {
  const text = useWikiText()
  const [showChange, setShowChange] = useState(false)
  const family = familyOf(content, object)
  const picture = object.pictureAssetId ? images[object.pictureAssetId] : undefined
  const first = timingText(object.firstSpawn)
  const again = timingText(object.respawn)
  const place = [spot?.side ? text(...SIDE_NAMES[spot.side]) : null, spot?.label].filter(Boolean).join(" · ")
  const sections = showChange && object.change ? [object.change] : object.sections

  return (
    <article className="wiki-map-details" aria-labelledby="wiki-map-details-name">
      {picture && (
        <figure className="wiki-map-details-picture">
          <img src={picture.url} alt="" width={picture.width} height={picture.height} loading="lazy" />
          <WikiImageCredit sources={picture.credits} className="wiki-map-details-credit" />
        </figure>
      )}
      <header className="wiki-map-details-head">
        <span className="wiki-frame-socket wiki-map-details-socket" data-side={spot?.side ?? undefined}>
          <ObjectIcon object={object} images={images} size={26} />
        </span>
        <div>
          <Name named={named}>{object.name}</Name>
          <p className="wiki-map-details-kind">{place || text(...CATEGORY_NAMES[object.category])}</p>
        </div>
      </header>

      {object.tags.length > 0 && (
        <ul className="wiki-map-tags" aria-label={text("Nhãn", "Tags")}>
          {object.tags.map((tag) => (
            <li key={tag}>{tag}</li>
          ))}
        </ul>
      )}

      {family.length > 1 && (
        <div className="wiki-map-forms" role="group" aria-label={text("Các dạng", "Forms")}>
          {family.map((member) => (
            <button
              type="button"
              key={member.code}
              aria-pressed={member.code === object.code}
              onClick={() => onPick(member.family ? member.code : refOf(member.code, spot?.key))}
            >
              {member.name}
            </button>
          ))}
        </div>
      )}

      {(first || again) && (
        <dl className="wiki-map-times">
          {first && (
            <div>
              <dt>{text("Xuất hiện", "Spawns")}</dt>
              <dd>{first}</dd>
            </div>
          )}
          {again && (
            <div>
              <dt>{text("Làm mới", "Respawns")}</dt>
              <dd>{again}</dd>
            </div>
          )}
        </dl>
      )}

      {object.summary && <p className="wiki-map-summary">{object.summary}</p>}

      {object.change && (
        <div className="wiki-map-switch" role="group" aria-label={text("Nội dung", "Content")}>
          <button type="button" aria-pressed={!showChange} onClick={() => setShowChange(false)}>
            {text("Giới thiệu", "About")}
          </button>
          <button type="button" aria-pressed={showChange} onClick={() => setShowChange(true)}>
            {text("Thay đổi", "Changes")}
          </button>
        </div>
      )}

      {sections.map((section, index) => (
        <section key={index} className="wiki-map-section">
          <h3>{section.title}</h3>
          <Blocks body={section.body} />
        </section>
      ))}

      <ShareLink reference={refOf(object.code, spot?.key)} />
    </article>
  )
}

function AreaDetails({
  content,
  images,
  area,
  onPick,
  named,
}: {
  content: MapContent
  images: Record<string, ModeImage>
  area: MapArea
  onPick: (ref: string) => void
  named: boolean
}) {
  const text = useWikiText()
  const found = objectsIn(content, area)
  return (
    <article className="wiki-map-details" aria-labelledby="wiki-map-details-name">
      <header className="wiki-map-details-head">
        <span className="wiki-frame-socket wiki-map-details-socket" data-side={area.side ?? undefined}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 7 9 4l6 3 5-3v13l-5 3-6-3-5 3Z" />
          </svg>
        </span>
        <div>
          <Name named={named}>{area.name}</Name>
          <p className="wiki-map-details-kind">
            {area.side ? text(...SIDE_NAMES[area.side]) : text("Khu vực chung", "Shared area")}
          </p>
        </div>
      </header>
      {area.summary && <p className="wiki-map-summary">{area.summary}</p>}
      {found.length > 0 && (
        <section className="wiki-map-section">
          <h3>{text("Ở đây có", "Found here")}</h3>
          <ul className="wiki-map-found">
            {found.map((object) => (
              <li key={object.code}>
                <button type="button" onClick={() => onPick(object.code)}>
                  <ObjectIcon object={object} images={images} size={18} />
                  {object.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ShareLink reference={area.code} />
    </article>
  )
}

function LaneDetails({ lane }: { lane: MapLane }) {
  const text = useWikiText()
  const scope = useWikiContext()
  const heroes = useQuery({ ...heroCatalogQuery(scope), enabled: lane.heroCodes.length > 0 })
  const byCode = new Map((heroes.data?.items ?? []).map((hero) => [hero.code, hero]))
  return (
    <article className="wiki-map-details" aria-labelledby="wiki-map-details-name">
      <header className="wiki-map-details-head">
        <span className="wiki-frame-socket wiki-map-details-socket">
          <LaneMark glyph={lane.glyph} size={24} />
        </span>
        <div>
          <h2 id="wiki-map-details-name">{lane.name}</h2>
        </div>
      </header>
      <div className="wiki-map-section">
        <Blocks body={lane.body} />
      </div>
      {lane.heroCodes.length > 0 && (
        <section className="wiki-map-section">
          <h3>{text("Tướng gợi ý", "Suggested heroes")}</h3>
          <ul className="wiki-map-found">
            {lane.heroCodes.map((code) => {
              const hero = byCode.get(code)
              const face = hero?.head?.currentVersion?.url
              return (
                <li key={code}>
                  <Link to={scope.href(`/hero/${encodeURIComponent(code)}`)}>
                    {face && <img src={face} alt="" width={18} height={18} loading="lazy" />}
                    {hero?.name ?? code}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <ShareLink reference={lane.code} />
    </article>
  )
}

/** The address of this place, for notes and messages that point at it. */
function ShareLink({ reference }: { reference: string }) {
  const text = useWikiText()
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set("at", reference)
    try {
      await navigator.clipboard.writeText(url.toString())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }
  return (
    <footer className="wiki-map-share">
      <code title={text("Mã tham chiếu", "Reference")}>{reference}</code>
      <button type="button" onClick={() => void copy()}>
        {copied ? text("Đã chép", "Copied") : text("Chép liên kết", "Copy link")}
      </button>
    </footer>
  )
}
