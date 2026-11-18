/**
 * One run of the job that publishes the Stream and Admin builds of the web image into the folder the proxy serves, in
 * the one-machine stack (ADR-021, addendum of 18/11/2026). The Wiki goes out through prerender-job.mts. It lives with
 * the Wiki's scripts because both jobs share publishSite and run from the same image.
 */
import path from "node:path"
import { fileURLToPath } from "node:url"
import { publishSite } from "./publish-site.mts"

const APPS = ["stream", "admin"] as const

async function main() {
  const siteDir = process.env.WEB_APPS_DIR
  if (!siteDir) throw new Error("Set WEB_APPS_DIR.")

  const builds = fileURLToPath(new URL("../apps", import.meta.url))
  for (const app of APPS) {
    await publishSite(path.join(builds, app), path.join(siteDir, app))
    console.log(`Published the ${app} build.`)
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  console.error("The apps keep the build they had.")
  process.exitCode = 1
})
