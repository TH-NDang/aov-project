import { NavLink, Outlet } from "react-router"
import { cn } from "@aov/ui/lib/utils"
import { MEDIA_NAV } from "@/app/nav"

export function MediaWorkspace() {
  return (
    <>
      <div className="shrink-0 space-y-3 border-b px-4 py-4 md:px-6">
        <p className="text-sm font-medium">Không gian ảnh</p>
        <nav aria-label="Loại ảnh" className="flex flex-wrap gap-2">
          {MEDIA_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-muted-foreground",
                )
              }
            >
              <item.icon className="size-4" />
              {item.title}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </>
  )
}
