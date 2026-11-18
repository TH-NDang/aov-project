import type { ReactNode } from "react"
import { create } from "zustand"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@aov/ui/components/alert-dialog"

export interface ConfirmOptions {
  title: string
  description: string
  /** A list or summary the answer depends on, such as what is replaced by what; it sits between the text and buttons. */
  details?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** The details say the action cannot run yet, such as a record still in use: only Cancel answers. */
  confirmDisabled?: boolean
}

interface ConfirmRequest extends ConfirmOptions {
  returnFocus: Element | null
  resolve: (confirmed: boolean) => void
}

// The request outlives `open` so its text stays on screen while the dialog fades out.
const useConfirmStore = create<{ open: boolean; request: ConfirmRequest | null }>(() => ({
  open: false,
  request: null,
}))

function answer(confirmed: boolean) {
  const { open, request } = useConfirmStore.getState()
  if (!open) return

  useConfirmStore.setState({ open: false })
  request?.resolve(confirmed)
}

function focusToRestore() {
  const active = document.activeElement
  // A menu item disappears with its menu, so focus returns to the button that opened the menu.
  const menu = active?.closest('[role="menu"]')
  const trigger = menu && document.getElementById(menu.getAttribute("aria-labelledby") ?? "")
  return trigger ?? active
}

/**
 * Asks in the app's own dialog and resolves with the answer. A newer question cancels one still open, so an answer can
 * never apply to the wrong action. Every question guards something that cannot be undone: the action is red and focus
 * opens on Cancel, so a stray Enter keeps the user's work.
 */
export function confirmAction(options: ConfirmOptions) {
  const { open, request } = useConfirmStore.getState()
  const returnFocus = open && request ? request.returnFocus : focusToRestore()
  answer(false)

  return new Promise<boolean>((resolve) => {
    useConfirmStore.setState({ open: true, request: { ...options, returnFocus, resolve } })
  })
}

/** Answers the open question with Cancel, for a link in its details that leads elsewhere in the app. */
export function cancelConfirm() {
  answer(false)
}

/** The usual question before throwing away unsaved edits. */
export function confirmDiscard({
  confirmLabel = "Bỏ thay đổi",
  ...options
}: Omit<ConfirmOptions, "confirmLabel" | "cancelLabel"> & { confirmLabel?: string }) {
  return confirmAction({ ...options, confirmLabel, cancelLabel: "Ở lại chỉnh sửa" })
}

/** Mounted once beside the app so any handler can ask without owning dialog state. */
export function ConfirmDialogHost() {
  const { open, request } = useConfirmStore()

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) answer(false)
      }}
    >
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          // Radix only returns focus to a trigger, and this dialog is opened from code.
          event.preventDefault()
          const target = request?.returnFocus
          if (target instanceof HTMLElement && target.isConnected) target.focus()
        }}
      >
        <AlertDialogHeader>
          {/* Forced because the shared title brings its own size and weight, which would otherwise win. */}
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          <AlertDialogDescription>{request?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {request?.details && <div className="type-body min-w-0 break-words">{request.details}</div>}
        <AlertDialogFooter>
          <AlertDialogCancel>{request?.cancelLabel ?? "Hủy"}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={request?.confirmDisabled} onClick={() => answer(true)}>
            {request?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
