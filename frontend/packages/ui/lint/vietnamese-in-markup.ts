// Finds Vietnamese written straight into markup, where an English reader would see it. The public apps run it from
// their own lint rules; words go through their `text(vietnamese, english)` helper instead.
import ts from "typescript"

const VIETNAMESE = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i

/**
 * The words an expression between braces writes itself. A choice (`a ? "…" : text(…)`, `a && "…"`, `a ?? "…"`) writes
 * the words of each branch; a call such as `text(…)` already has its English and writes none.
 */
function ownWords(expression: ts.Expression): string[] {
  if (ts.isStringLiteralLike(expression)) return [expression.text]
  if (ts.isTemplateExpression(expression))
    return [[expression.head.text, ...expression.templateSpans.map((span) => span.literal.text)].join(" ")]
  if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression))
    return ownWords(expression.expression)
  if (ts.isConditionalExpression(expression))
    return [...ownWords(expression.whenTrue), ...ownWords(expression.whenFalse)]
  if (ts.isBinaryExpression(expression)) {
    const operator = expression.operatorToken.kind
    if (operator === ts.SyntaxKind.AmpersandAmpersandToken) return ownWords(expression.right)
    if (operator === ts.SyntaxKind.BarBarToken || operator === ts.SyntaxKind.QuestionQuestionToken)
      return [...ownWords(expression.left), ...ownWords(expression.right)]
  }
  return []
}

/** Each place in a TSX file where Vietnamese is written into JSX text, an attribute or an expression between braces. */
export function vietnameseInMarkup(text: string, path: string) {
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
    // An expression between braces is markup too, in a child ({"…"}) or an attribute (label={a ? "…" : b}).
    if (ts.isJsxExpression(node) && node.expression)
      for (const words of ownWords(node.expression)) if (VIETNAMESE.test(words)) report(node, words)
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}
