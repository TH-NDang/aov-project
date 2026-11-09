import { useEffect, useState } from "react"
import { Link } from "react-router"
import { useWikiContext } from "../../context/wiki-context"
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
  // Steps 0–6 knock a player out each; step 7 holds the winner a moment before the match starts again.
  const step = useCycle(PLAYERS + 1, 900, PLAYERS - 1)
  const out = Math.min(step, PLAYERS - 1)
  return (
    <section className="ov-card" aria-label="Mục tiêu">
      <header>
        <span className="ov-kicker">Mục tiêu</span>
        <h2>Trụ lại cuối cùng</h2>
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
        <strong>{PLAYERS} người chơi</strong>, mỗi người <strong>{START_HEALTH} máu</strong>. Thua một hiệp đối kháng bị
        trừ máu; hết máu thì bị loại. Người còn lại cuối cùng thắng.
      </p>
      <div className="ov-ranks" role="img" aria-label="Hạng 1 đến 4 tính là thắng, 5 đến 8 tính là thua">
        {Array.from({ length: PLAYERS }, (_, at) => (
          <span key={at} data-win={at < 4 || undefined}>
            {at + 1}
          </span>
        ))}
      </div>
      <div className="ov-rank-legend">
        <span data-win="true">Hạng 1–4 · thắng, hạng càng cao càng nhiều điểm</span>
        <span>Hạng 5–8 · thua, hạng càng thấp càng bị trừ nhiều điểm</span>
      </div>
    </section>
  )
}

/** One round as a loop of three steps, the current one lit, with the guide's own pictures. */
function RoundCard({ index, code }: { index: GuideIndex; code: string }) {
  const { href } = useWikiContext()
  const step = useCycle(3, 2400, -1)
  const base = `/modes/${encodeURIComponent(code)}`
  const lineup = index.content.lineups[0]
  const carry = lineup?.units.find((unit) => unit.carry) ?? lineup?.units[0]
  const unit = (carry && index.units.get(carry.unitCode)) ?? index.content.units[0]
  const trait = unit ? index.traits.get(unit.traitCodes[0] ?? "") : index.content.traits[0]
  const item = index.content.items.find((entry) => entry.iconAssetId) ?? index.content.items[0]
  const itemSrc = index.image(item?.iconAssetId)
  return (
    <section className="ov-card ov-round" aria-label="Một hiệp đấu">
      <header>
        <span className="ov-kicker">Mỗi hiệp</span>
        <h2>Xếp đội hình → giao tranh → tính máu</h2>
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
            Xếp đội hình
          </h3>
          <p>Kết hợp quân cờ, Phe/Nghề và trang bị.</p>
          <span className="ov-links">
            <Link to={href(`${base}/quan-co`)}>Quân cờ</Link>
            <Link to={href(`${base}/phe-nghe`)}>Phe & Nghề</Link>
            <Link to={href(`${base}/trang-bi`)}>Trang bị</Link>
          </span>
        </li>
        <li className="ov-step" data-active={step === 1 || undefined}>
          <div className="ov-fights">
            <div className="ov-fight">
              <SwordsIcon />
              <b>Đối kháng</b>
              <small>Ghép cặp với người chơi khác</small>
            </div>
            <div className="ov-fight" data-kind="monster">
              <MonsterIcon />
              <b>Quái</b>
              <small>
                <ChestIcon /> Rơi trang bị, thẻ tăng sao…
              </small>
            </div>
          </div>
          <h3>
            <span className="ov-step-number">2</span>
            Giao tranh
          </h3>
          <p>Hai loại vòng đấu: gặp người chơi khác hoặc đánh quái lấy chiến lợi phẩm.</p>
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
            Tính máu
          </h3>
          <p>Bên thua bị trừ máu. Hết giờ mà chưa phân thắng bại thì cả hai cùng bị trừ.</p>
        </li>
      </ol>
    </section>
  )
}

/** The health formula as something to play with: pick how many units the winner kept and the stage damage. */
function DamageCard() {
  const [alive, setAlive] = useState(3)
  const [stage, setStage] = useState(2)
  const lost = alive < 5 ? alive * 2 + stage : 9 + (alive - 5) + stage
  const left = Math.max(0, START_HEALTH - lost)
  return (
    <section className="ov-card ov-damage" aria-label="Trừ máu khi thua">
      <header>
        <span className="ov-kicker">Khi thua</span>
        <h2>Bị trừ bao nhiêu máu?</h2>
      </header>
      <div className="ov-field">
        <span className="ov-label">Quân còn sống của bên thắng</span>
        <div className="ov-alive" role="group" aria-label="Số quân còn sống của bên thắng">
          {Array.from({ length: BOARD_SLOTS }, (_, at) => (
            <button
              key={at}
              type="button"
              aria-label={`${at + 1} quân`}
              aria-pressed={at + 1 === alive}
              data-on={at < alive || undefined}
              onClick={() => setAlive(at + 1)}
            />
          ))}
          <b>{alive}</b>
        </div>
      </div>
      <div className="ov-field">
        <span className="ov-label">Sát thương người chơi · tăng dần theo giai đoạn trận</span>
        <div className="ov-stepper">
          <button type="button" aria-label="Giảm" disabled={stage <= 0} onClick={() => setStage(stage - 1)}>
            −
          </button>
          <b>{stage}</b>
          <button type="button" aria-label="Tăng" disabled={stage >= 30} onClick={() => setStage(stage + 1)}>
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
        <strong>= −{lost} máu</strong>
      </div>
      <div className="ov-health" role="img" aria-label={`Còn ${left} trên ${START_HEALTH} máu`}>
        <i style={{ width: `${left}%` }} />
        <i className="ov-health-lost" style={{ left: `${left}%`, width: `${Math.min(lost, START_HEALTH)}%` }} />
        <span>
          {START_HEALTH} → {left}
        </span>
      </div>
      <ul className="ov-notes">
        <li>Dưới 5 quân: số quân còn sống × 2 + sát thương người chơi.</li>
        <li>Từ 5 quân: 9 + (số quân − 5) + sát thương người chơi.</li>
        <li>Thua bản sao (ghép trận khi số người lẻ) thì không chịu sát thương người chơi.</li>
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
