// Lint rules about Stream's source itself. They read files, so they run as `pnpm lint`, not as tests.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import ts from "typescript"

const app = join(import.meta.dirname, "..")
const source = join(app, "src")

type Rule = { name: string; hint: string; files: string[]; offenders: (text: string, path: string) => string[] }

function files(folder: string, pattern: RegExp): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name)
    if (statSync(path).isDirectory()) return files(path, pattern)
    return pattern.test(name) ? [path] : []
  })
}

const VIETNAMESE = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i

/**
 * Vietnamese written straight into JSX text or a JSX attribute has no English beside it, so an English reader would see
 * it. Words go through `text(vietnamese, english)` instead.
 */
function vietnameseInMarkup(text: string, path: string) {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  const report = (node: ts.Node, words: string) => {
    const line = file.getLineAndCharacterOfPosition(node.getStart()).line + 1
    found.push(`:${line} ${words.trim().replace(/\s+/g, " ").slice(0, 70)}`)
  }
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node) && VIETNAMESE.test(node.text)) report(node, node.text)
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer))
      if (VIETNAMESE.test(node.initializer.text)) report(node, `${node.name.getText()}="${node.initializer.text}"`)
    // A string or template written straight between braces is markup too: {"…"} or {`…`}.
    if (ts.isJsxExpression(node) && node.expression) {
      const words = node.expression
      // Only the template's own words count; a text(…) call inside it already has its English.
      const literal = ts.isStringLiteralLike(words)
        ? words.text
        : ts.isTemplateExpression(words)
          ? [words.head.text, ...words.templateSpans.map((span) => span.literal.text)].join(" ")
          : ""
      if (VIETNAMESE.test(literal)) report(node, literal)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

const rules: Rule[] = [
  {
    name: "interface text in markup has an English counterpart",
    hint: 'Write the words as text("…", "…") from useStreamLocale, with the English beside the Vietnamese.',
    files: files(source, /\.tsx$/),
    offenders: vietnameseInMarkup,
  },
]

let failed = false
for (const rule of rules) {
  const found = rule.files.flatMap((path) =>
    rule.offenders(readFileSync(path, "utf8"), path).map((detail) => `  ${relative(app, path)}${detail}`),
  )
  if (found.length === 0) continue
  failed = true
  console.error(`✗ ${rule.name}\n${found.join("\n")}\n  ${rule.hint}`)
}
if (failed) process.exit(1)
console.log(`✓ ${rules.length} source rules pass`)
