import type { CSSProperties } from "react"
import type { Catalog } from "@aov/community-contracts"
import { useStreamLocale } from "../../../components/stream-locale"
import { pathChart, type BuildView, type PathChart, type PathStep } from "../../../lib/build-view"
import { pathNotes } from "../../../lib/build-words"
import { clock, referenceName, UNKNOWN_REFERENCE } from "../../../lib/tournament-model"
import { BuildItem } from "./build-item"
import "./build-path.css"

/** A bar that ends past this share of the game says where it went inside itself. */
const LABEL_INSIDE = 0.8

type Say = (vi: string, en: string) => string

/** The slots a player ended with, the build itself first and what was bought for protection behind a line. */
export function EndSlots({ catalog, build }: { catalog: Catalog; build: BuildView }) {
  const apart = build.end.findIndex((built) => built.protective)
  return (
    <span className="tn-end-slots">
      {build.end.map((built, index) => (
        <span key={index} className="tn-end-slot" data-apart={(index > 0 && index === apart) || undefined}>
          <BuildItem catalog={catalog} built={built} />
        </span>
      ))}
    </span>
  )
}

/** What a line says under the name of its item, the change it marks in its colour. */
function Notes({ catalog, step, text }: { catalog: Catalog; step: PathStep; text: Say }) {
  const { tier, fate, lineage } = pathNotes(step, catalog, text)
  if (!tier && !fate && !lineage) return null
  return (
    <small>
      {tier && <span>{tier}</span>}
      {fate && <span data-tone={step.fate.toLowerCase()}>{fate}</span>}
      {lineage && <span>{lineage}</span>}
    </small>
  )
}

const nameOf = (catalog: Catalog, step: PathStep, text: Say) =>
  referenceName(catalog, "items", step.item, text(...UNKNOWN_REFERENCE))

/** The path as lines down a rail: when each item was bought and what became of it. */
function PathList({ catalog, path }: { catalog: Catalog; path: PathStep[] }) {
  const { text } = useStreamLocale()
  const timed = path.some((step) => step.atSeconds != null)
  return (
    <ol className="tn-path" data-timeless={!timed || undefined}>
      {path.map((step, at) => (
        <li key={at} data-fate={step.fate.toLowerCase()} data-protective={step.protective || undefined}>
          {timed && <time>{step.atSeconds != null && clock(step.atSeconds)}</time>}
          <i aria-hidden="true" />
          <BuildItem catalog={catalog} built={step} fate={step.fate} />
          <span>
            <b>
              {nameOf(catalog, step, text)}
              {step.protective && <em>{text("Bảo hộ", "Protective")}</em>}
            </b>
            <Notes catalog={catalog} step={step} text={text} />
          </span>
        </li>
      ))}
    </ol>
  )
}

/** The kinds of bars a chart shows, each named once under it. */
function Legend({ path }: { path: PathStep[] }) {
  const { text } = useStreamLocale()
  const kinds = [
    path.some((step) => step.fate === "HELD" && !step.protective) && (["core", text("Chính", "Core")] as const),
    path.some((step) => step.fate === "HELD" && step.protective) &&
      (["protective", text("Bảo hộ", "Protective")] as const),
    path.some((step) => step.fate === "UPGRADED") &&
      (["upgraded", text("Đã lên món khác", "Built into another")] as const),
    path.some((step) => step.fate === "SOLD") && (["sold", text("Đã bán", "Sold")] as const),
  ].filter((kind) => !!kind)
  return (
    <ul className="tn-path-legend" aria-hidden="true">
      {kinds.map(([kind, label]) => (
        <li key={kind} data-kind={kind}>
          {label}
        </li>
      ))}
    </ul>
  )
}

/** The kind of bar a step is drawn as. */
const barKind = (step: PathStep) =>
  step.fate === "HELD" ? (step.protective ? "protective" : "core") : step.fate.toLowerCase()

/** The path as bars over the minutes of the game, the number of the item each went into at its end. */
function PathBars({
  catalog,
  path,
  chart,
  duration,
}: {
  catalog: Catalog
  path: PathStep[]
  chart: PathChart
  duration: number
}) {
  const { text } = useStreamLocale()
  return (
    <div className="tn-path-chart">
      <div className="tn-path-axis" aria-hidden="true">
        <span>
          {chart.ticks.map((second) => (
            <small key={second} style={{ "--at": second / duration } as CSSProperties}>
              {second / 60}&prime;
            </small>
          ))}
          <small data-end style={{ "--at": 1 } as CSSProperties}>
            {clock(duration)}
          </small>
        </span>
      </div>
      <ol>
        {path.map((step, at) => {
          const bar = chart.bars[at]!
          const name = nameOf(catalog, step, text)
          const then =
            step.next &&
            (step.fate === "SOLD"
              ? text(`bán → ${step.next.at + 1}`, `sold → ${step.next.at + 1}`)
              : `→ ${step.next.at + 1}`)
          const { tier, fate, lineage } = pathNotes(step, catalog, text)
          return (
            <li key={at} data-kind={barKind(step)}>
              <span className="tn-path-num">{at + 1}</span>
              <BuildItem catalog={catalog} built={step} fate={step.fate} />
              <b title={name}>{name}</b>
              <span className="sr-only">
                {[clock(step.atSeconds ?? 0), step.protective && text("bảo hộ", "protective"), tier, fate, lineage]
                  .filter(Boolean)
                  .join(", ")}
              </span>
              <span className="tn-path-track" aria-hidden="true">
                <span
                  className="tn-path-bar"
                  data-open={bar.open || undefined}
                  style={{ "--from": bar.from, "--to": bar.to } as CSSProperties}
                >
                  {then && <small data-inside={bar.to > LABEL_INSIDE || undefined}>{then}</small>}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      <Legend path={path} />
    </div>
  )
}

/**
 * The items in the order they were bought. On a wide screen a game whose length and times are known draws them as bars
 * over its minutes; otherwise, and on a phone, they are lines down a rail.
 */
export function BuildPath({
  catalog,
  path,
  duration,
  wide,
}: {
  catalog: Catalog
  path: PathStep[]
  duration: number | null | undefined
  wide: boolean
}) {
  const chart = wide ? pathChart(path, duration) : null
  return chart && duration ? (
    <PathBars catalog={catalog} path={path} chart={chart} duration={duration} />
  ) : (
    <PathList catalog={catalog} path={path} />
  )
}
