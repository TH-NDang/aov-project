import { createBrowserRouter, createMemoryRouter, Navigate, type RouteObject } from "react-router"
import { LegacyHeroRedirect } from "./legacy-hero-redirect"
import { AppShell } from "./layout/app-shell"
import type { RouteHandle } from "./layout/site-header"
import { AppLoading, RouteError } from "./route-error"
import { LegacyMediaRedirect, MediaWorkspace } from "@/features/media/media-workspace"
import { HeroCrumb, TournamentCrumb } from "./layout/entity-crumbs"

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
        path: "videos",
        handle: title("Video"),
        lazy: async () => ({ Component: (await import("@/features/videos/videos-page")).VideosPage }),
      },
      {
        path: "profile",
        handle: title("Hồ sơ của tôi"),
        lazy: async () => ({ Component: (await import("@/features/users/users-page")).ProfilePage }),
      },
      {
        path: "settings",
        handle: title("Cài đặt"),
        lazy: async () => ({ Component: (await import("@/features/users/settings-page")).SettingsPage }),
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
            path: "media-contact-requests",
            handle: title("Liên hệ về hình ảnh"),
            lazy: async () => ({ Component: (await import("@/features/media/media-contact-page")).MediaContactPage }),
          },
          {
            path: "image-management",
            handle: title("Quản lý ảnh"),
            lazy: async () => ({
              Component: (await import("@/features/media/image-management-page")).ImageManagementPage,
            }),
          },
          {
            path: "publishing/*",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <LegacyHeroRedirect />,
          },
          {
            path: "hero",
            handle: title("Tướng"),
            lazy: async () => ({ Component: (await import("@/features/publishing/publishing-page")).PublishingPage }),
          },
          {
            path: "builds",
            handle: title("Build đề cử"),
            lazy: async () => ({ Component: (await import("@/features/builds/builds-page")).BuildsPage }),
          },
          {
            path: "hero/publish-readiness",
            handle: title("Sẵn sàng xuất bản"),
            lazy: async () => ({
              Component: (await import("@/features/publishing/publish-readiness-page")).PublishReadinessPage,
            }),
          },
          {
            path: "hero/import",
            handle: title("Import tướng"),
            element: null,
          },
          {
            path: "hero/new",
            handle: title("Tạo tướng"),
            lazy: async () => ({ Component: (await import("@/features/publishing/create-hero-page")).CreateHeroPage }),
          },
          {
            path: "hero/:heroId/translations",
            handle: title("Biên dịch tướng"),
            lazy: async () => {
              const { PublishingPage } = await import("@/features/publishing/publishing-page")
              return { Component: () => <PublishingPage translationMode /> }
            },
          },
          {
            path: "hero/:heroId",
            handle: handle((match) => <HeroCrumb heroId={match.params.heroId} fallback="Tướng" />),
            lazy: async () => ({ Component: (await import("@/features/publishing/publishing-page")).PublishingPage }),
          },
          {
            path: "heroes/*",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <Navigate to="/hero" replace />,
          },
          {
            path: "reference/skins/*",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <Navigate to="/hero" replace />,
          },
          {
            path: "skins/*",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <Navigate to="/hero" replace />,
          },
          {
            path: "storage",
            handle: title("Lưu trữ"),
            lazy: async () => ({ Component: (await import("@/features/storage/storage-page")).StoragePage }),
          },
          {
            path: "items",
            handle: title("Trang bị"),
            lazy: async () => ({
              Component: (await import("@/features/warehouse/backend-items-page")).BackendItemsPage,
            }),
          },
          {
            path: "enchantments",
            handle: title("Phù hiệu"),
            lazy: async () => ({
              Component: (await import("@/features/warehouse/secondary-pages")).BackendEnchantmentsPage,
            }),
          },
          {
            path: "arcana",
            handle: title("Bảng ngọc"),
            lazy: async () => ({ Component: (await import("@/features/warehouse/secondary-pages")).BackendArcanaPage }),
          },
          {
            path: "game-modes",
            handle: title("Chế độ chơi"),
            lazy: async () => ({ Component: (await import("@/features/game-modes/game-modes-page")).GameModesPage }),
          },
          {
            path: "game-modes/:modeId",
            handle: title("Chế độ chơi"),
            lazy: async () => ({
              Component: (await import("@/features/game-modes/game-mode-editor")).GameModeEditorPage,
            }),
          },
          {
            path: "game-modes/:modeId/auto-chess",
            handle: title("Cẩm nang Cờ Liên quân"),
            lazy: async () => ({
              Component: (await import("@/features/game-modes/auto-chess-editor")).AutoChessEditorPage,
            }),
          },
          {
            path: "spells",
            handle: title("Phụ trợ"),
            lazy: async () => ({ Component: (await import("@/features/warehouse/secondary-pages")).BackendSpellsPage }),
          },
          { path: "hero/media", handle: title("Không gian ảnh"), element: <MediaWorkspace /> },
          { path: "portraits", handle: { pageTab: false } satisfies RouteHandle, element: <LegacyMediaRedirect /> },
          {
            path: "media/head",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <LegacyMediaRedirect tab="head" />,
          },
          {
            path: "media/cover",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <LegacyMediaRedirect tab="cover" />,
          },
          {
            path: "media/head-cover",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <LegacyMediaRedirect tab="head" />,
          },
          {
            path: "media/badges",
            handle: { pageTab: false } satisfies RouteHandle,
            element: <LegacyMediaRedirect tab="badges" />,
          },
          {
            path: "tournaments",
            handle: title("Giải đấu"),
            lazy: async () => ({
              Component: (await import("@/features/esports/pages/tournament-hub-page")).TournamentHubPage,
            }),
          },
          {
            path: "tournaments/registry",
            handle: { pageTab: false } satisfies RouteHandle,
            lazy: async () => ({
              Component: (await import("@/features/tournaments/registry-page")).LegacyRegistryRedirect,
            }),
          },
          {
            path: "teams",
            handle: title("Đội tuyển"),
            lazy: async () => {
              const { PageDirectory } = await import("@/features/community/page-directory")
              return { Component: () => <PageDirectory kind="TEAM" /> }
            },
          },
          {
            path: "players",
            handle: title("Tuyển thủ"),
            lazy: async () => {
              const { PageDirectory } = await import("@/features/community/page-directory")
              return { Component: () => <PageDirectory kind="PLAYER" /> }
            },
          },
          {
            path: "organizations",
            handle: title("Tổ chức"),
            lazy: async () => {
              const { PageDirectory } = await import("@/features/community/page-directory")
              return { Component: () => <PageDirectory kind="ORGANIZATION" /> }
            },
          },
          {
            path: "circuits",
            handle: title("Hệ thống giải"),
            lazy: async () => {
              const { PageDirectory } = await import("@/features/community/page-directory")
              return { Component: () => <PageDirectory kind="CIRCUIT" /> }
            },
          },
          {
            path: "coaches",
            handle: title("Ban huấn luyện"),
            lazy: async () => {
              const { PageDirectory } = await import("@/features/community/page-directory")
              return { Component: () => <PageDirectory kind="PERSON" group="COACHING" /> }
            },
          },
          {
            path: "broadcast",
            handle: title("Broadcast"),
            lazy: async () => {
              const { PageDirectory } = await import("@/features/community/page-directory")
              return { Component: () => <PageDirectory kind="PERSON" group="BROADCAST" /> }
            },
          },
          {
            path: "pages/:pageId",
            handle: title("Hồ sơ công khai"),
            lazy: async () => ({ Component: (await import("@/features/community/page-editor")).PageEditor }),
          },
          {
            path: "page-requests",
            handle: title("Yêu cầu & kiểm duyệt"),
            lazy: async () => ({ Component: (await import("@/features/community/page-review")).PageReview }),
          },
          {
            path: "tournaments/:tournamentId",
            handle: handle((match) => (
              <TournamentCrumb tournamentId={match.params.tournamentId} fallback="Chi tiết giải" />
            )),
            lazy: async () => ({
              Component: (await import("@/features/competition/competition-workspace")).CompetitionWorkspace,
            }),
          },
          {
            path: "tournaments/:tournamentId/matches/:seriesId",
            handle: title("Trận đấu"),
            lazy: async () => ({ Component: (await import("@/features/esports/pages/match-page")).MatchPage }),
          },
          {
            path: "tournaments/:tournamentId/matches/:seriesId/games/:gameId",
            handle: title("Diễn biến ván"),
            lazy: async () => ({ Component: (await import("@/features/esports/pages/game-page")).GamePage }),
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
