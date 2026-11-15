import { useEffect, useState } from "react"
import { Link } from "react-router"
import { useWikiContext } from "../../context/wiki-context"
import { TraitIcon, UnitPortrait, useGuideIndex, type GuideIndex } from "./guide-ui"
import type { PublicGuide } from "./mode-api"
import { ModeHeading } from "./mode-ui"

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
      <path d="m4 4 12 12m-2.5 2.5 5-5M16 16l3.5 3.5" />
      <path d="M20 4 8 16m2.5 2.5-5-5M8 16l-3.5 3.5" />
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
      <g transform="translate(0 1.5)">
        <path d="M5 10c0-4 3-7 7-7s7 3 7 7v6l-2 2-2-2-2 2-1-1-1 1-2-2-2 2-2-2Z" />
        <path d="M9 10h.01M15 10h.01M5 6 3 3M19 6l2-3" />
      </g>
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
function GoalSection() {
  // Steps 0–6 knock a player out each; step 7 holds the winner a moment before the match starts again.
  const step = useCycle(PLAYERS + 1, 900, PLAYERS - 1)
  const out = Math.min(step, PLAYERS - 1)
  return (
    <section className="mode-section" aria-labelledby="ov-goal">
      <ModeHeading id="ov-goal" title="Mục tiêu" note="Trụ lại cuối cùng" />
      <div className="ov-split">
        <div className="ov-figure">
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
          <div className="ov-ranks" role="img" aria-label="Hạng 1 đến 4 tính là thắng, 5 đến 8 tính là thua">
            {Array.from({ length: PLAYERS }, (_, at) => (
              <span key={at} data-win={at < 4 || undefined}>
                {at + 1}
              </span>
            ))}
          </div>
        </div>
        <div className="ov-copy">
          <p className="ov-text">
            <strong>{PLAYERS} người chơi</strong>, mỗi người <strong>{START_HEALTH} máu</strong>. Thua một hiệp đối
            kháng bị trừ máu; hết máu thì bị loại. Người còn lại cuối cùng thắng.
          </p>
          <ul className="ov-rank-legend">
            <li data-win="true">Hạng 1–4 tính là thắng, hạng càng cao càng nhiều điểm.</li>
            <li>Hạng 5–8 tính là thua, hạng càng thấp càng bị trừ nhiều điểm.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

/** One round as a loop of three steps, the current one lit, with the guide's own pictures. */
function RoundSection({ index, code }: { index: GuideIndex; code: string }) {
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
    <section className="mode-section" aria-labelledby="ov-round">
      <ModeHeading id="ov-round" title="Mỗi hiệp" note="Xếp đội hình → giao tranh → tính máu" />
      <ol className="ov-steps">
        <li className="ov-step" data-active={step === 0 || undefined}>
          <h3>
            <span className="ov-step-number">1</span>
            Xếp đội hình
          </h3>
          <div className="ov-step-art" aria-hidden="true">
            {unit && <UnitPortrait unit={unit} index={index} size="md" />}
            <span className="ov-plus">+</span>
            {trait && <TraitIcon trait={trait} index={index} size={40} />}
            <span className="ov-plus">+</span>
            {itemSrc ? <img className="ov-item" src={itemSrc} alt="" /> : null}
          </div>
          <p>
            Kết hợp <Link to={href(`${base}/quan-co`)}>quân cờ</Link>,{" "}
            <Link to={href(`${base}/phe-nghe`)}>Phe/Nghề</Link> và <Link to={href(`${base}/trang-bi`)}>trang bị</Link>.
          </p>
        </li>
        <li className="ov-step" data-active={step === 1 || undefined}>
          <h3>
            <span className="ov-step-number">2</span>
            Giao tranh
          </h3>
          <div className="ov-step-art ov-fights">
            <div className="ov-fight">
              <SwordsIcon />
              <b>Đối kháng</b>
              <small>Ghép cặp với người chơi khác</small>
            </div>
            <div className="ov-fight">
              <MonsterIcon />
              <b>Quái</b>
              <small>Rơi trang bị, thẻ tăng sao…</small>
            </div>
          </div>
          <p>Hai loại vòng đấu: gặp người chơi khác hoặc đánh quái lấy chiến lợi phẩm.</p>
        </li>
        <li className="ov-step" data-active={step === 2 || undefined}>
          <h3>
            <span className="ov-step-number">3</span>
            Tính máu
          </h3>
          <div className="ov-step-art ov-hit" aria-hidden="true">
            <HeartIcon />
            <span className="ov-hit-bar">
              <i />
            </span>
          </div>
          <p>Bên thua bị trừ máu. Hết giờ mà chưa phân thắng bại thì cả hai cùng bị trừ.</p>
        </li>
      </ol>
    </section>
  )
}

/** The health formula as something to play with: pick how many units the winner kept and the stage damage. */
function DamageSection() {
  const [alive, setAlive] = useState(3)
  const [stage, setStage] = useState(2)
  const lost = alive < 5 ? alive * 2 + stage : 9 + (alive - 5) + stage
  const left = Math.max(0, START_HEALTH - lost)
  return (
    <section className="mode-section" aria-labelledby="ov-damage">
      <ModeHeading id="ov-damage" title="Khi thua" note="Bị trừ bao nhiêu máu?" />
      <div className="ov-split">
        <div className="ov-figure">
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
        </div>
        <ul className="ov-notes">
          <li>Dưới 5 quân: số quân còn sống × 2 + sát thương người chơi.</li>
          <li>Từ 5 quân: 9 + (số quân − 5) + sát thương người chơi.</li>
          <li>Thua bản sao (ghép trận khi số người lẻ) thì không chịu sát thương người chơi.</li>
        </ul>
      </div>
    </section>
  )
}

/** The overview of an auto chess mode in pictures: the goal, one round, and what a loss costs. */
export function AutoChessOverview({ guide, code }: { guide: PublicGuide; code: string }) {
  const index = useGuideIndex(guide)
  return (
    <>
      <GoalSection />
      <RoundSection index={index} code={code} />
      <DamageSection />
    </>
  )
}
