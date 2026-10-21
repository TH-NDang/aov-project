import {
  getReferenceInputSelection,
  serializeReferenceInput,
  setReferenceInputSelection,
} from "@aov/ui/lib/reference-input-dom"
import type { TextSelection } from "@aov/ui/lib/entity-rich-text-editor"

export function referenceInput(container: ParentNode): HTMLDivElement {
  const input = container.querySelector<HTMLDivElement>('[data-slot="entity-reference-input"]')
  if (!input) throw new Error("Expected a reference input")
  return input
}

export function selectReferenceInput(input: HTMLDivElement, start: number, end = start) {
  input.focus()
  setReferenceInputSelection(input, start, end)
  input.ownerDocument.dispatchEvent(new input.ownerDocument.defaultView!.Event("selectionchange"))
}

export function fillReferenceInput(input: HTMLDivElement, text: string, selection?: TextSelection) {
  input.replaceChildren(input.ownerDocument.createTextNode(text))
  selectReferenceInput(input, selection?.start ?? text.length, selection?.end ?? text.length)
  input.dispatchEvent(new input.ownerDocument.defaultView!.Event("input", { bubbles: true }))
}

export const referenceInputValue = serializeReferenceInput
export const referenceInputSelection = getReferenceInputSelection
