import { useState, type ComponentProps, type ReactNode } from "react"
import { X } from "lucide-react"
import { DrawerClose, DrawerContent, DrawerHandle, DrawerTitle, DrawerDescription, DrawerTrigger } from "./drawer"
import { PublicDrawer as Drawer } from "./public-overlay"
import { localeText } from "@aov/ui/lib/locale-text"
import "./public-account-menu.css"
import "./public-preferences-drawer.css"

export function PublicPreferencesDrawer({
  product,
  locale,
  trigger,
  children,
  onCloseAutoFocus,
}: {
  product: "wiki" | "stream"
  locale: string
  trigger: ReactNode
  children: ReactNode
  onCloseAutoFocus?: ComponentProps<typeof DrawerContent>["onCloseAutoFocus"]
}) {
  const [open, setOpen] = useState(false)
  const text = localeText(locale)
  return (
    <Drawer open={open} onOpenChange={setOpen} handleOnly shouldScaleBackground={false}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent
        className="public-account-panel public-preferences-drawer"
        data-product={product}
        overlayClassName="public-preferences-overlay"
        handle={<DrawerHandle className="public-preferences-handle" preventCycle />}
        onCloseAutoFocus={onCloseAutoFocus}
        onClick={(event) => {
          if ((event.target as Element).closest("a")) setOpen(false)
        }}
      >
        <div className="public-preferences-header">
          <DrawerTitle>{text("Tùy chọn", "Preferences")}</DrawerTitle>
          <DrawerDescription className="sr-only">
            {text("Tài khoản, ứng dụng và cài đặt", "Account, applications and settings")}
          </DrawerDescription>
          <DrawerClose aria-label={text("Đóng", "Close")}>
            <X size={18} aria-hidden="true" />
          </DrawerClose>
        </div>
        <div className="public-preferences-body">{children}</div>
      </DrawerContent>
    </Drawer>
  )
}
