#!/usr/bin/env node
// Adds the drafted skill summaries to heroes through the admin API, one draft per hero.
//
// A published hero is immutable, so each summary reaches readers through a new draft that corrects the content of
// the version on screen (cause CONTENT_CORRECTION, same patch). The run is a dry run unless --apply is given, and
// nothing is published unless --publish is given as well. See README.md beside this file.
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { parseArgs } from "node:util"
import { descriptionFingerprint } from "./description-fingerprint.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const { values: options } = parseArgs({
  options: {
    api: { type: "string", default: "http://localhost:8080/api/wiki/v1" },
    file: { type: "string", default: join(here, "skill-summaries.vi-VN.json") },
    region: { type: "string", default: "VN" },
    token: { type: "string", default: process.env.WIKI_ADMIN_TOKEN ?? "" },
    hero: { type: "string", multiple: true, default: [] },
    apply: { type: "boolean", default: false },
    publish: { type: "boolean", default: false },
    "publish-flagged": { type: "boolean", default: false },
    "into-open-drafts": { type: "boolean", default: false },
    overwrite: { type: "boolean", default: false },
    "ignore-description-changes": { type: "boolean", default: false },
    report: { type: "string", default: "" },
    help: { type: "boolean", default: false },
  },
})

if (options.help) {
  console.log(`Usage: node apply-skill-summaries.mjs [options]

  --api <url>                    wiki-service API root (default http://localhost:8080/api/wiki/v1)
  --file <path>                  drafted summaries (default skill-summaries.vi-VN.json beside this script)
  --region <code>                market whose current version receives the summaries (default VN)
  --token <jwt>                  admin access token, or set WIKI_ADMIN_TOKEN (needs catalog:read and hero:write)
  --hero <code>                  only this hero; repeat for several
  --apply                        write drafts; without it the run only reports what it would do
  --publish                      also publish each draft it wrote (needs hero:publish); heroes with a summary
                                 marked for review stay drafts unless --publish-flagged is given
  --into-open-drafts             add to a draft the hero already has instead of skipping the hero
  --overwrite                    replace summaries that already exist
  --ignore-description-changes   apply a summary even when the description changed since it was written
  --report <path>                write the result of every hero as JSON`)
  process.exit(0)
}
if (options.publish && !options.apply) fail("--publish needs --apply.")
if (!options.token) fail("An admin access token is required: pass --token or set WIKI_ADMIN_TOKEN.")

function fail(message) {
  console.error(message)
  process.exit(2)
}

async function call(path, { method = "GET", body, admin = true } = {}) {
  const response = await fetch(options.api + path, {
    method,
    headers: {
      ...(admin ? { authorization: `Bearer ${options.token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    const error = new Error(`${method} ${path} -> ${response.status} ${payload?.code ?? ""} ${payload?.detail ?? ""}`)
    error.status = response.status
    error.code = payload?.code
    throw error
  }
  return payload
}

async function publishedHeroes(locale) {
  const query = `region=${options.region}&locale=${locale}&playable=true&size=100`
  const first = await call(`/heroes?${query}&page=0`, { admin: false })
  const items = [...first.items]
  for (let page = 1; page < first.totalPages; page++)
    items.push(...(await call(`/heroes?${query}&page=${page}`, { admin: false })).items)
  return new Map(items.map((hero) => [hero.code, hero]))
}

/** Works out the skills with their summaries added and what was left alone, without calling the server. */
function plan(skills, entries, locale) {
  const byKey = new Map(entries.map((entry) => [entry.skillKey, entry]))
  const result = { added: [], kept: [], changedDescription: [], withoutDraft: [], unknown: [], flagged: [] }
  const next = skills.map((skill) => {
    const entry = byKey.get(skill.skillKey)
    const text = skill.translations.find((translation) => translation.locale === locale)
    if (!entry || !text) {
      if (text) result.withoutDraft.push(skill.skillKey)
      return skill
    }
    if (text.summary && !options.overwrite) {
      result.kept.push(skill.skillKey)
      return skill
    }
    if (
      !options["ignore-description-changes"] &&
      entry.descriptionFingerprint !== descriptionFingerprint(text.description)
    ) {
      result.changedDescription.push(skill.skillKey)
      return skill
    }
    if (text.summary === entry.summary) {
      result.kept.push(skill.skillKey)
      return skill
    }
    result.added.push(skill.skillKey)
    if (entry.review) result.flagged.push(skill.skillKey)
    return {
      ...skill,
      translations: skill.translations.map((translation) =>
        translation === text ? { ...translation, summary: entry.summary } : translation,
      ),
    }
  })
  const present = new Set(skills.map((skill) => skill.skillKey))
  result.unknown = entries.filter((entry) => !present.has(entry.skillKey)).map((entry) => entry.skillKey)
  return { skills: next, result }
}

async function applyToHero(entry, hero, locale) {
  const outcome = { hero: entry.code, status: "", detail: "", draftId: null }
  if (!hero) return { ...outcome, status: "SKIPPED", detail: "no published version in this market" }

  const revisions = await call(`/admin/heroes/${hero.id}/revisions`)
  const shown = revisions.find((revision) => revision.id === hero.revisionId)
  if (!shown) return { ...outcome, status: "SKIPPED", detail: "the published version is not among the hero's revisions" }
  const openDraft = revisions.find((revision) => revision.state === "DRAFT" && revision.rulesetId === shown.rulesetId)
  if (openDraft && !options["into-open-drafts"])
    return { ...outcome, status: "SKIPPED", detail: `has an open draft (${openDraft.id}); use --into-open-drafts` }

  const base = openDraft ?? shown
  const preview = await call(`/admin/heroes/${hero.id}/revisions/${base.id}`)
  const section = preview.content.skills
  if (!section?.skills?.length) return { ...outcome, status: "SKIPPED", detail: "the version has no skills" }

  const { skills, result } = plan(section.skills, entry.skills, locale)
  Object.assign(outcome, result)
  if (!result.added.length) return { ...outcome, status: "UNCHANGED", detail: "nothing to add" }
  if (!options.apply) return { ...outcome, status: "WOULD_ADD", detail: `${result.added.length} summaries` }

  let draft =
    openDraft ??
    (await call(`/admin/heroes/${hero.id}/drafts`, {
      method: "POST",
      body: { rulesetId: shown.rulesetId, sourceRevisionId: shown.id, cause: "CONTENT_CORRECTION" },
    }))
  draft = await call(`/admin/heroes/${hero.id}/drafts/${draft.id}/skills`, {
    method: "PUT",
    body: {
      expectedDraftVersion: draft.version,
      skills,
      sources: section.sources ?? [],
      changeNote: "Add skill summaries",
    },
  })
  outcome.draftId = draft.id
  if (!options.publish) return { ...outcome, status: "DRAFTED", detail: `${result.added.length} summaries` }
  if (result.flagged.length && !options["publish-flagged"])
    return { ...outcome, status: "DRAFTED", detail: "left as a draft: holds summaries marked for review" }

  await call(`/admin/heroes/${hero.id}/drafts/${draft.id}/publish`, {
    method: "POST",
    body: { expectedVersion: draft.version, changeNote: "Add skill summaries" },
  })
  return { ...outcome, status: "PUBLISHED", detail: `${result.added.length} summaries` }
}

const data = JSON.parse(readFileSync(options.file, "utf8"))
const wanted = new Set(options.hero)
const entries = data.heroes.filter((entry) => !wanted.size || wanted.has(entry.code))
if (!entries.length) fail("No hero in the file matches the selection.")

const heroes = await publishedHeroes(data.locale)
const outcomes = []
for (const entry of entries) {
  let outcome
  try {
    outcome = await applyToHero(entry, heroes.get(entry.code), data.locale)
  } catch (error) {
    outcome = { hero: entry.code, status: "FAILED", detail: error.message }
  }
  outcomes.push(outcome)
  const notes = [
    outcome.changedDescription?.length ? `description changed: ${outcome.changedDescription.join(", ")}` : "",
    outcome.unknown?.length ? `no such skill: ${outcome.unknown.join(", ")}` : "",
    outcome.withoutDraft?.length ? `no summary drafted: ${outcome.withoutDraft.join(", ")}` : "",
  ].filter(Boolean)
  console.log(`${outcome.status.padEnd(10)} ${entry.code.padEnd(16)} ${outcome.detail}${notes.length ? ` [${notes.join("; ")}]` : ""}`)
}

const count = (status) => outcomes.filter((outcome) => outcome.status === status).length
const total = (field) => outcomes.reduce((sum, outcome) => sum + (outcome[field]?.length ?? 0), 0)
console.log(
  `\n${options.apply ? "Applied" : "Dry run"}: ${entries.length} heroes | would add ${count("WOULD_ADD")} | drafted ${count("DRAFTED")} | ` +
    `published ${count("PUBLISHED")} | unchanged ${count("UNCHANGED")} | skipped ${count("SKIPPED")} | failed ${count("FAILED")}`,
)
console.log(
  `Summaries: ${total("added")} to add or added | ${total("kept")} already there | ` +
    `${total("changedDescription")} with a changed description | ${total("unknown")} for skills that no longer exist`,
)
if (options.report) writeFileSync(options.report, JSON.stringify({ options: { ...options, token: undefined }, outcomes }, null, 2))
if (count("FAILED")) process.exit(1)
