import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { test } from "node:test"

// The admin reads on a 12/14/16/24 scale; see the type-* styles in packages/ui/src/styles/typography.css.
const minimumPx = 12
const source = join(import.meta.dirname, "..", "src")

function files(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) return files(path)
    return /\.(tsx?|css)$/.test(name) ? [path] : []
  })
}

function pixels(value: number, unit: string) {
  return unit === "px" ? value : value * 16
}

test("admin text is never smaller than 12px", () => {
  const tooSmall: string[] = []
  for (const path of files(source)) {
    const lines = readFileSync(path, "utf8").split("\n")
    lines.forEach((line, index) => {
      const sizes = [
        // Tailwind arbitrary sizes such as text-[11px] or text-[0.65rem].
        ...line.matchAll(/text-\[(\d*\.?\d+)(px|rem|em)\]/g),
        // Inline styles such as fontSize: 10, fontSize: "10px" or font-size: 0.6rem.
        ...line.matchAll(/font-?[sS]ize:\s*["']?(\d*\.?\d+)(px|rem|em)?/g),
      ]
      for (const [match, value, unit = "px"] of sizes)
        if (pixels(Number(value), unit) < minimumPx)
          tooSmall.push(`${relative(source, path)}:${index + 1} ${match.trim()}`)
    })
  }
  assert.deepEqual(tooSmall, [], `Use text-xs (12px) or a type-* style instead of:\n${tooSmall.join("\n")}`)
})
