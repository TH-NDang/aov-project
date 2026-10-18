import { createBrowserRouter, createMemoryRouter, Navigate, type RouteObject } from "react-router"
import { AppShell } from "./layout/app-shell"
import type { RouteHandle } from "./layout/site-header"
import { AppLoading, RouteError } from "./route-error"
import { MediaWorkspace } from "@/features/media/media-workspace"

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
        path: "terminology",
        handle: title("Thuật ngữ & tham chiếu"),
        lazy: async () => ({ Component: (await import("@/features/terminology/terminology-page")).TerminologyPage }),
      },
      {
        path: "profile",
        handle: title("Hồ sơ của tôi"),
        lazy: async () => ({ Component: (await import("@/features/users/users-page")).ProfilePage }),
      },
      {
        path: "users",
        handle: title("Người dùng"),
        lazy: async () => ({ Component: (await import("@/features/users/users-page")).UsersPage }),
      },
      {
        path: "users/:userId",
        handle: title("Chi tiết người dùng"),
        lazy: async () => ({ Component: (await import("@/features/users/user-detail-page")).UserDetailPage }),
      },
      {
        errorElement: <RouteError />,
        children: [
          {
            index: true,
            handle: title("Bảng điều khiển"),
            lazy: async () => ({ Component: (await import("@/features/dashboard/dashboard-page")).DashboardPage }),
          },
          {
            path: "game-configuration",
            handle: title("Phiên bản và thị trường"),
            lazy: async () => ({
              Component: (await import("@/features/publishing/game-configuration-page")).GameConfigurationPage,
            }),
          },
          {
            path: "publishing-media",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <Navigate to="/image-management" replace />,
          },
          {
            path: "image-management",
            handle: title("Quản lý ảnh"),
            lazy: async () => ({
              Component: (await import("@/features/media/image-management-page")).ImageManagementPage,
            }),
          },
          {
            path: "publishing",
            handle: title("Tướng"),
            lazy: async () => ({ Component: (await import("@/features/publishing/publishing-page")).PublishingPage }),
          },
          {
            path: "publishing/import",
            handle: title("Import tướng"),
            element: null,
          },
          {
            path: "publishing/new",
            handle: title("Tạo tướng"),
            lazy: async () => ({ Component: (await import("@/features/publishing/create-hero-page")).CreateHeroPage }),
          },
          {
            path: "publishing/:heroId/translations",
            handle: title("Biên dịch tướng"),
            lazy: async () => {
              const { PublishingPage } = await import("@/features/publishing/publishing-page")
              return { Component: () => <PublishingPage translationMode /> }
            },
          },
          {
            path: "publishing/:heroId",
            handle: title("Phiên bản tướng"),
            lazy: async () => ({ Component: (await import("@/features/publishing/publishing-page")).PublishingPage }),
          },
          {
            path: "heroes/*",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <Navigate to="/publishing" replace />,
          },
          {
            path: "reference/skins/*",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <Navigate to="/publishing" replace />,
          },
          {
            path: "skins/*",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <Navigate to="/publishing" replace />,
          },
          {
            path: "storage",
            handle: title("Lưu trữ"),
            lazy: async () => ({ Component: (await import("@/features/storage/storage-page")).StoragePage }),
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
            path: "spells",
            handle: title("Phụ trợ"),
            lazy: async () => ({ Component: (await import("@/features/placeholders/spells-page")).SpellsPage }),
          },
          {
            element: <MediaWorkspace />,
            children: [
              {
                path: "portraits",
                handle: title("Không gian ảnh · Portrait"),
                lazy: async () => ({ Component: (await import("@/features/portraits/portraits-page")).PortraitsPage }),
              },
              {
                path: "media/head",
                handle: title("Không gian ảnh · Head"),
                lazy: async () => ({ Component: (await import("@/features/media/head-cover-page")).HeadPage }),
              },
              {
                path: "media/cover",
                handle: title("Không gian ảnh · Cover"),
                lazy: async () => ({ Component: (await import("@/features/media/head-cover-page")).CoverPage }),
              },
              {
                path: "media/head-cover",
                handle: title("Không gian ảnh · Head & cover"),
                lazy: async () => ({ Component: (await import("@/features/media/head-cover-page")).HeadCoverPage }),
              },
              {
                path: "media/badges",
                handle: title("Không gian ảnh · Bậc trang phục"),
                lazy: async () => ({ Component: (await import("@/features/media/badges-page")).BadgesPage }),
              },
            ],
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
