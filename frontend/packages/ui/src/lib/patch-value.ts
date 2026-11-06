const variables: Record<string, string> = {
  physicalAttack: "Công vật lý",
  bonusPhysicalAttack: "Công vật lý cộng thêm",
  magicAttack: "Công phép",
  maxHealth: "Máu tối đa",
  rank: "cấp chiêu",
  heroLevel: "cấp tướng",
}

const operators: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷", "~": "–" }

/** Format complete known formulas for reading without evaluating or changing stored patch values. */
export function formatPatchValue(value: string): string {
  const tokens = value.match(/\d+(?:\.\d+)?|[A-Za-z_]\w*|[()+\-*/~]/g)
  if (!tokens || tokens.join("") !== value.replace(/\s/g, "")) return value
  if (!tokens.some((token) => Object.hasOwn(variables, token))) return value

  let depth = 0
  let expectsOperand = true
  const formatted: string[] = []
  for (const token of tokens) {
    if (token === "(") {
      if (!expectsOperand) return value
      depth++
      formatted.push("(")
    } else if (token === ")") {
      if (expectsOperand || !depth) return value
      depth--
      formatted.push(")")
    } else if (Object.hasOwn(operators, token)) {
      if (expectsOperand) {
        if (token !== "+" && token !== "-") return value
        formatted.push(operators[token])
      } else {
        formatted.push(` ${operators[token]} `)
        expectsOperand = true
      }
    } else {
      if (!expectsOperand || (!/^\d/.test(token) && !Object.hasOwn(variables, token))) return value
      formatted.push(variables[token] ?? token)
      expectsOperand = false
    }
  }
  return depth || expectsOperand ? value : formatted.join("")
}
