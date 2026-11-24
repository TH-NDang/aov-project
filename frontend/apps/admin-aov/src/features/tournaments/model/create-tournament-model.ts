import type { TournamentContent } from "@aov/community-contracts"
import type { CopyPart } from "@/features/competition/model/copy-setup"
import { registryContent, registryFormIssue } from "./registry-form-model"
import { nextSeasonName, tournamentSlug, yearInName } from "./season-name"
import { statusFromDates } from "./tournament-status"

/** The fields a new tournament is filled in with, in the order the record stores them. */
export const CREATE_KEYS = [
  "code",
  "name",
  "parentTournamentId",
  "region",
  "year",
  "startsOn",
  "endsOn",
  "sourceUrl",
  "logoUrl",
  "logoDarkUrl",
  "tier",
  "competitionType",
  "venueMode",
  "status",
  "note",
] as const
export type CreateKey = (typeof CREATE_KEYS)[number]
export type CreateValues = Record<CreateKey, string>

/** The form: its values and the fields the editor chose by hand, which nothing overwrites any more. */
export type CreateForm = { values: CreateValues; typed: ReadonlySet<CreateKey> }

/** What the form works out from the other fields until the editor writes it by hand. */
function derived(values: CreateValues, typed: ReadonlySet<CreateKey>, now: Date): CreateValues {
  const next = { ...values }
  if (!typed.has("code")) next.code = tournamentSlug(values.name) ?? ""
  if (!typed.has("year"))
    next.year = values.startsOn.slice(0, 4) || yearInName(values.name) || String(now.getFullYear())
  if (!typed.has("status"))
    next.status = statusFromDates({ startsOn: values.startsOn || undefined, endsOn: values.endsOn || undefined }, now)
  return next
}

/**
 * A new tournament's form. `defaults` are the values it starts from, such as a part's main event; a main event given
 * there is the editor's choice, so copying a setup later keeps it.
 */
export function newForm(defaults: Partial<Record<string, string>> = {}, now = new Date()): CreateForm {
  const empty = Object.fromEntries(CREATE_KEYS.map((key) => [key, ""])) as CreateValues
  const given = Object.fromEntries(CREATE_KEYS.flatMap((key) => (defaults[key] ? [[key, defaults[key]]] : [])))
  const values = { ...empty, region: "VN", ...given, code: "" } as CreateValues
  const kept = ["parentTournamentId", "region", "competitionType", "year"] as const
  const typed = new Set<CreateKey>(kept.filter((key) => !!defaults[key]))
  return { values: derived(values, typed, now), typed }
}

export function changeField(form: CreateForm, key: CreateKey, value: string, now = new Date()): CreateForm {
  const typed = new Set(form.typed)
  // A cleared code goes back to following the name.
  if (key === "code" && !value) typed.delete("code")
  else typed.add(key)
  return { values: derived({ ...form.values, [key]: value }, typed, now), typed }
}

/**
 * The form with another tournament as its model: the next season's name and what stays the same from season to season,
 * except where the editor already wrote something. Dates, the main event and the sources belong to the old season.
 */
export function withSource(form: CreateForm, source: TournamentContent, now = new Date()): CreateForm {
  const taken: Partial<CreateValues> = {
    name: nextSeasonName(source.name, source.year),
    region: source.region,
    tier: source.tier ?? "",
    competitionType: source.competitionType ?? "",
    venueMode: source.venueMode ?? "",
    logoUrl: source.logoUrl ?? "",
    logoDarkUrl: source.logoDarkUrl ?? "",
  }
  const values = { ...form.values }
  for (const [key, value] of Object.entries(taken) as [CreateKey, string][])
    if (value && !form.typed.has(key)) values[key] = value
  return { values: derived(values, form.typed, now), typed: form.typed }
}

export const createContent = (values: CreateValues) =>
  registryContent("tournaments", values, [...CREATE_KEYS]) as TournamentContent

/** What keeps a new tournament from being created, in words; a part's name still ends where its own name belongs. */
export const createIssue = (values: CreateValues) =>
  /[-–—:]\s*$/.test(values.name)
    ? "Viết tiếp tên riêng của phần sau dấu gạch nối."
    : registryFormIssue("tournaments", values)

/** Checked to begin with: what rarely changes between two seasons, and the teams the new one is built around. */
export const DEFAULT_PARTS: CopyPart[] = ["info", "entrants", "rosters", "stages"]

/** Rosters and staff are taken over for the teams taken over, so they wait for those. */
const NEEDS_ENTRANTS: readonly CopyPart[] = ["rosters", "staff"]
export const partNeedsEntrants = (part: CopyPart) => NEEDS_ENTRANTS.includes(part)

/** The parts that will run: the checked ones, without rosters and staff when no team comes along. */
export const effectiveParts = (chosen: ReadonlySet<CopyPart>): Set<CopyPart> =>
  new Set([...chosen].filter((part) => chosen.has("entrants") || !partNeedsEntrants(part)))
