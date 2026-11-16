import { useEffect, useState } from "react"
import { Link } from "react-router"
import { useWikiContext, wikiText } from "../../context/wiki-context"
import { TraitIcon, UnitPortrait, useGuideIndex, type GuideIndex } from "./auto-chess-guide"
import type { PublicGuide } from "./mode-api"

/*
 * The overview shows how a match of the auto chess mode works as pictures instead of paragraphs. Every figure follows the
 * guide's own rules (8 players with 100 health each, two kinds of rounds, the health formula, ranks 1–4 win); the full
 * rules stay below in text for anything the pictures leave out.
 */

const PLAYERS = 8
const START_HEALTH = 100
const BOARD_SLOTS = 10

/** Whether the reader asked the system for less motion; the pictures then rest in their final state. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReduced(query.matches)
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return reduced
}

/** A counter that steps every `ms` and wraps after `steps`, frozen at `rest` when motion is reduced. */
function useCycle(steps: number, ms: number, rest: number) {
  const reduced = useReducedMotion()
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (reduced) return
    const timer = window.setInterval(() => setStep((current) => (current + 1) % steps), ms)
    return () => window.clearInterval(timer)
  }, [reduced, steps, ms])
  return reduced ? rest : step
}

function SwordsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4l9 9M4 4h4M4 4v4M20 4l-9 9M20 4h-4M20 4v4M7 17l-3 3M17 17l3 3M9.5 14.5l-3 3M14.5 14.5l3 3" />
    </svg>
  )
}

function MonsterIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 10c0-4 3-7 7-7s7 3 7 7v6l-2 2-2-2-2 2-1-1-1 1-2-2-2 2-2-2Z" />
      <path d="M9 10h.01M15 10h.01M5 6 3 3M19 6l2-3" />
    </svg>
  )
}

function ChestIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 10h16v9H4zM4 10a8 5 0 0 1 16 0M11 12h2v3h-2z" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
      <path d="M12 20s-7-4.4-9.2-8.6C1.4 8.6 3 5 6.5 5c2 0 3.5 1.2 5.5 3.2C14 6.2 15.5 5 17.5 5 21 5 22.6 8.6 21.2 11.4 19 15.6 12 20 12 20Z" />
    </svg>
  )
}

/** Eight players, knocked out one by one until one is left: the goal of a match in one picture. */
function GoalCard() {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  // Steps 0–6 knock a player out each; step 7 holds the winner a moment before the match starts again.
  const step = useCycle(PLAYERS + 1, 900, PLAYERS - 1)
  const out = Math.min(step, PLAYERS - 1)
  return (
    <section className="ov-card" aria-label={text("Mục tiêu", "Goal")}>
      <header>
        <span className="ov-kicker">{text("Mục tiêu", "Goal")}</span>
        <h2>{text("Trụ lại cuối cùng", "Be the last one standing")}</h2>
      </header>
      <div className="ov-players" aria-hidden="true">
        {Array.from({ length: PLAYERS }, (_, at) => {
          // Players leave from the last seat backwards, so seat 1 is the one who survives.
          const gone = at >= PLAYERS - out
          const winner = out === PLAYERS - 1 && at === 0
          return (
            <span key={at} className="ov-player" data-out={gone || undefined} data-winner={winner || undefined}>
              <b>{winner ? "★" : at + 1}</b>
              <i style={{ width: gone ? "0%" : "100%" }} />
            </span>
          )
        })}
      </div>
      <p className="ov-text">
        <strong>{text(`${PLAYERS} người chơi`, `${PLAYERS} players`)}</strong>
        {text(", mỗi người ", ", each with ")}
        <strong>{text(`${START_HEALTH} máu`, `${START_HEALTH} HP`)}</strong>
        {text(
          ". Thua một hiệp đối kháng bị trừ máu; hết máu thì bị loại. Người còn lại cuối cùng thắng.",
          ". Losing a PvP round costs HP; a player who runs out of HP is eliminated. The last player left wins.",
        )}
      </p>
      <div
        className="ov-ranks"
        role="img"
        aria-label={text(
          "Hạng 1 đến 4 tính là thắng, 5 đến 8 tính là thua",
          "Ranks 1 to 4 count as a win, 5 to 8 as a loss",
        )}
      >
        {Array.from({ length: PLAYERS }, (_, at) => (
          <span key={at} data-win={at < 4 || undefined}>
            {at + 1}
          </span>
        ))}
      </div>
      <div className="ov-rank-legend">
        <span data-win="true">
          {text(
            "Hạng 1–4 · thắng, hạng càng cao càng nhiều điểm",
            "Ranks 1–4 · win, the higher the rank the more points",
          )}
        </span>
        <span>
          {text(
            "Hạng 5–8 · thua, hạng càng thấp càng bị trừ nhiều điểm",
            "Ranks 5–8 · loss, the lower the rank the more points lost",
          )}
        </span>
      </div>
    </section>
  )
}

/** One round as a loop of three steps, the current one lit, with the guide's own pictures. */
function RoundCard({ index, code }: { index: GuideIndex; code: string }) {
  const { href, locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const step = useCycle(3, 2400, -1)
  const base = `/modes/${encodeURIComponent(code)}`
  const lineup = index.content.lineups[0]
  const carry = lineup?.units.find((unit) => unit.carry) ?? lineup?.units[0]
  const unit = (carry && index.units.get(carry.unitCode)) ?? index.content.units[0]
  const trait = unit ? index.traits.get(unit.traitCodes[0] ?? "") : index.content.traits[0]
  const item = index.content.items.find((entry) => entry.iconAssetId) ?? index.content.items[0]
  const itemSrc = index.image(item?.iconAssetId)
  return (
    <section className="ov-card ov-round" aria-label={text("Một hiệp đấu", "One round")}>
      <header>
        <span className="ov-kicker">{text("Mỗi hiệp", "Each round")}</span>
        <h2>{text("Xếp đội hình → giao tranh → tính máu", "Build a lineup → fight → count HP")}</h2>
      </header>
      <ol className="ov-steps">
        <li className="ov-step" data-active={step === 0 || undefined}>
          <div className="ov-step-art">
            {unit && <UnitPortrait unit={unit} index={index} size="md" />}
            <span className="ov-plus">+</span>
            {trait && <TraitIcon trait={trait} index={index} size={40} />}
            <span className="ov-plus">+</span>
            {itemSrc ? <img className="ov-item" src={itemSrc} alt="" /> : null}
          </div>
          <h3>
            <span className="ov-step-number">1</span>
            {text("Xếp đội hình", "Build a lineup")}
          </h3>
          <p>{text("Kết hợp quân cờ, Phe/Nghề và trang bị.", "Combine units, Factions/Classes and items.")}</p>
          <span className="ov-links">
            <Link to={href(`${base}/quan-co`)}>{text("Quân cờ", "Units")}</Link>
            <Link to={href(`${base}/phe-nghe`)}>{text("Phe & Nghề", "Factions & Classes")}</Link>
            <Link to={href(`${base}/trang-bi`)}>{text("Trang bị", "Equipment")}</Link>
          </span>
        </li>
        <li className="ov-step" data-active={step === 1 || undefined}>
          <div className="ov-fights">
            <div className="ov-fight">
              <SwordsIcon />
              <b>{text("Đối kháng", "PvP round")}</b>
              <small>{text("Ghép cặp với người chơi khác", "Paired with another player")}</small>
            </div>
            <div className="ov-fight" data-kind="monster">
              <MonsterIcon />
              <b>{text("Quái", "Monster round")}</b>
              <small>
                <ChestIcon /> {text("Rơi trang bị, thẻ tăng sao…", "Drops items, star upgrade cards…")}
              </small>
            </div>
          </div>
          <h3>
            <span className="ov-step-number">2</span>
            {text("Giao tranh", "Fight")}
          </h3>
          <p>
            {text(
              "Hai loại vòng đấu: gặp người chơi khác hoặc đánh quái lấy chiến lợi phẩm.",
              "Two kinds of rounds: face another player or fight monsters for loot.",
            )}
          </p>
        </li>
        <li className="ov-step" data-active={step === 2 || undefined}>
          <div className="ov-step-art ov-hit">
            <HeartIcon />
            <span className="ov-hit-bar">
              <i />
            </span>
          </div>
          <h3>
            <span className="ov-step-number">3</span>
            {text("Tính máu", "Count HP")}
          </h3>
          <p>
            {text(
              "Bên thua bị trừ máu. Hết giờ mà chưa phân thắng bại thì cả hai cùng bị trừ.",
              "The losing side loses HP. If time runs out with no winner, both sides lose HP.",
            )}
          </p>
        </li>
      </ol>
    </section>
  )
}

/** The health formula as something to play with: pick how many units the winner kept and the stage damage. */
function DamageCard() {
  const { locale } = useWikiContext()
  const text = (vi: string, en: string) => wikiText(locale, vi, en)
  const [alive, setAlive] = useState(3)
  const [stage, setStage] = useState(2)
  const lost = alive < 5 ? alive * 2 + stage : 9 + (alive - 5) + stage
  const left = Math.max(0, START_HEALTH - lost)
  return (
    <section className="ov-card ov-damage" aria-label={text("Trừ máu khi thua", "HP lost when you lose")}>
      <header>
        <span className="ov-kicker">{text("Khi thua", "When you lose")}</span>
        <h2>{text("Bị trừ bao nhiêu máu?", "How much HP do you lose?")}</h2>
      </header>
      <div className="ov-field">
        <span className="ov-label">{text("Quân còn sống của bên thắng", "Winner's surviving units")}</span>
        <div
          className="ov-alive"
          role="group"
          aria-label={text("Số quân còn sống của bên thắng", "Number of the winner's surviving units")}
        >
          {Array.from({ length: BOARD_SLOTS }, (_, at) => (
            <button
              key={at}
              type="button"
              aria-label={text(`${at + 1} quân`, `${at + 1} ${at === 0 ? "unit" : "units"}`)}
              aria-pressed={at + 1 === alive}
              data-on={at < alive || undefined}
              onClick={() => setAlive(at + 1)}
            />
          ))}
          <b>{alive}</b>
        </div>
      </div>
      <div className="ov-field">
        <span className="ov-label">
          {text(
            "Sát thương người chơi · tăng dần theo giai đoạn trận",
            "Player damage · rises with each stage of the match",
          )}
        </span>
        <div className="ov-stepper">
          <button
            type="button"
            aria-label={text("Giảm", "Decrease")}
            disabled={stage <= 0}
            onClick={() => setStage(stage - 1)}
          >
            −
          </button>
          <b>{stage}</b>
          <button
            type="button"
            aria-label={text("Tăng", "Increase")}
            disabled={stage >= 30}
            onClick={() => setStage(stage + 1)}
          >
            +
          </button>
        </div>
      </div>
      <div className="ov-formula" aria-live="polite">
        {alive < 5 ? (
          <span>
            {alive} × 2 + {stage}
          </span>
        ) : (
          <span>
            9 + ({alive} − 5) + {stage}
          </span>
        )}
        <strong>{text(`= −${lost} máu`, `= −${lost} HP`)}</strong>
      </div>
      <div
        className="ov-health"
        role="img"
        aria-label={text(`Còn ${left} trên ${START_HEALTH} máu`, `${left} of ${START_HEALTH} HP left`)}
      >
        <i style={{ width: `${left}%` }} />
        <i className="ov-health-lost" style={{ left: `${left}%`, width: `${Math.min(lost, START_HEALTH)}%` }} />
        <span>
          {START_HEALTH} → {left}
        </span>
      </div>
      <ul className="ov-notes">
        <li>
          {text(
            "Dưới 5 quân: số quân còn sống × 2 + sát thương người chơi.",
            "Fewer than 5 units: surviving units × 2 + player damage.",
          )}
        </li>
        <li>
          {text(
            "Từ 5 quân: 9 + (số quân − 5) + sát thương người chơi.",
            "5 units or more: 9 + (units − 5) + player damage.",
          )}
        </li>
        <li>
          {text(
            "Thua bản sao (ghép trận khi số người lẻ) thì không chịu sát thương người chơi.",
            "Losing to a copy (the pairing used when the number of players is odd) takes no player damage.",
          )}
        </li>
      </ul>
    </section>
  )
}

/** The overview of an auto chess mode in pictures: the goal, one round, and what a loss costs. */
export function AutoChessOverview({ guide, code }: { guide: PublicGuide; code: string }) {
  const index = useGuideIndex(guide)
  return (
    <div className="ov-grid">
      <GoalCard />
      <RoundCard index={index} code={code} />
      <DamageCard />
    </div>
  )
}
