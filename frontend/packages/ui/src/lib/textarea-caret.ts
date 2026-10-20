// Mirror the textarea's wrapping and typography without affecting document layout.
export function textareaCaretRect(input: HTMLTextAreaElement, position: number): DOMRect {
  const document = input.ownerDocument
  const view = document.defaultView!
  const style = view.getComputedStyle(input)
  const mirror = document.createElement("div")
  const marker = document.createElement("span")
  for (const property of [
    "box-sizing",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "font-variant",
    "line-height",
    "letter-spacing",
    "word-spacing",
    "text-transform",
    "text-indent",
    "text-align",
    "direction",
    "tab-size",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
  ])
    mirror.style.setProperty(property, style.getPropertyValue(property))
  Object.assign(mirror.style, {
    position: "fixed",
    left: "0",
    top: "0",
    visibility: "hidden",
    pointerEvents: "none",
    boxSizing: "border-box",
    width: `${input.clientWidth}px`,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  })
  mirror.textContent = input.value.slice(0, position)
  marker.textContent = input.value.slice(position) || "."
  mirror.append(marker)
  document.body.append(mirror)
  try {
    const origin = input.getBoundingClientRect()
    const point = marker.getClientRects()[0] ?? marker.getBoundingClientRect()
    const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.2
    const x = origin.left + input.clientLeft + point.left - input.scrollLeft
    const y = origin.top + input.clientTop + point.top - input.scrollTop
    return new view.DOMRect(
      Math.max(origin.left + input.clientLeft, Math.min(x, origin.right - input.clientLeft)),
      Math.max(origin.top + input.clientTop, Math.min(y, origin.bottom - input.clientTop - lineHeight)),
      0,
      lineHeight,
    )
  } finally {
    mirror.remove()
  }
}
