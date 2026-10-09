import { createBrowserRouter, createMemoryRouter, type RouteObject } from "react-router"
import { AppShell } from "./layout/app-shell"
import type { RouteHandle } from "./layout/site-header"
import { AppLoading, RouteError } from "./route-error"
import { HeroCrumb } from "@/features/heroes/hero-crumb"

const handle = (crumb: RouteHandle["crumb"]): RouteHandle => ({ crumb })
const title = (text: string) => handle(() => text)

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <AppLoading />,
    handle: title("AOV Admin"),
    children: [
      {
        errorElement: <RouteError />,
        children: [
          {
            index: true,
            handle: title("Bảng điều khiển"),
            lazy: async () => ({ Component: (await import("@/features/dashboard/dashboard-page")).DashboardPage }),
          },
          {
            path: "heroes",
            handle: title("Tướng"),
            children: [
              {
                index: true,
                lazy: async () => ({ Component: (await import("@/features/heroes/heroes-page")).HeroesPage }),
              },
              {
                path: ":heroId",
                handle: handle((match) => <HeroCrumb heroId={match.params.heroId!} />),
                lazy: async () => ({ Component: (await import("@/features/heroes/hero-detail-page")).HeroDetailPage }),
              },
            ],
          },
          {
            path: "skins",
            handle: title("Trang phục"),
            lazy: async () => ({ Component: (await import("@/features/skins/skins-page")).SkinsPage }),
          },
          {
            path: "items",
            handle: title("Trang bị"),
            lazy: async () => ({ Component: (await import("@/features/items/items-page")).ItemsPage }),
          },
          {
            path: "enchantments",
            handle: title("Phù hiệu"),
            lazy: async () => ({
              Component: (await import("@/features/enchantments/enchantments-page")).EnchantmentsPage,
            }),
          },
          {
            path: "arcana",
            handle: title("Bảng ngọc"),
            lazy: async () => ({ Component: (await import("@/features/placeholders/arcana-page")).ArcanaPage }),
          },
          {
            path: "portraits",
            handle: title("Portrait"),
            lazy: async () => ({ Component: (await import("@/features/portraits/portraits-page")).PortraitsPage }),
          },
          {
            path: "media/head-cover",
            handle: title("Head & cover"),
            lazy: async () => ({ Component: (await import("@/features/media/head-cover-page")).HeadCoverPage }),
          },
          {
            path: "media/badges",
            handle: title("Bậc trang phục"),
            lazy: async () => ({ Component: (await import("@/features/media/badges-page")).BadgesPage }),
          },
          {
            path: "tournaments",
            handle: title("Giải đấu"),
            lazy: async () => ({
              Component: (await import("@/features/placeholders/tournaments-page")).TournamentsPage,
            }),
          },
          {
            path: "streams",
            handle: title("Livestream"),
            lazy: async () => ({ Component: (await import("@/features/placeholders/streams-page")).StreamsPage }),
          },
          {
            path: "*",
            handle: title("Không tìm thấy"),
            lazy: async () => ({ Component: (await import("@/features/placeholders/not-found-page")).NotFoundPage }),
          },
        ],
      },
    ],
  },
]

export const router =
  import.meta.env.VITE_ROUTER === "memory"
    ? createMemoryRouter(routes)
    : createBrowserRouter(routes, { basename: import.meta.env.BASE_URL.replace(/\/$/, "") || "/" })
