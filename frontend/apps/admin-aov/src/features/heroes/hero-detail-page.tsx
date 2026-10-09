import { Link, useParams } from "react-router"
import { ExternalLink, ImageIcon, SearchX } from "lucide-react"
import { Badge } from "@aov/ui/components/badge"
import { Button } from "@aov/ui/components/button"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@aov/ui/components/empty"
import { Skeleton } from "@aov/ui/components/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@aov/ui/components/tabs"
import { CopyButton } from "@/components/copy-button"
import { MediaImage } from "@/components/media-image"
import { Page } from "@/components/page-header"
import { useSearchParam } from "@/hooks/use-search-param"
import { isApiError } from "@/lib/api/errors"
import { useHero } from "@/lib/queries"
import { HeroMediaTab } from "./hero-media-tab"
import { HeroProfileForm } from "./hero-profile-form"
import { HeroSkillsForm } from "./hero-skills-form"
import { HeroSkinsTab } from "./hero-skins-tab"

const TABS = ["profile", "skills", "skins", "media"] as const

export function HeroDetailPage() {
  const { heroId = "" } = useParams()
  const hero = useHero(heroId)
  const [tab, setTab] = useSearchParam("tab", "profile")

  if (hero.isLoading) {
    return (
      <Page>
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-96 w-full" />
      </Page>
    )
  }

  if (!hero.data) {
    return (
      <Empty className="m-6 border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>
            {isApiError(hero.error, "NOT_FOUND") ? "Không tìm thấy tướng" : "Không tải được tướng"}
          </EmptyTitle>
          <EmptyDescription>Mã “{heroId}” không có trong dữ liệu.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link to="/heroes">Về danh sách tướng</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const data = hero.data
  const skins = data.skins.filter((skin) => !skin.isDefault)

  return (
    <Page>
      <div className="relative overflow-hidden rounded-xl border">
        <MediaImage
          path={data.cover}
          className="absolute inset-0 size-full object-cover opacity-15"
          fallbackClassName="hidden"
        />
        <div className="relative flex flex-wrap items-center gap-4 p-4 md:p-6">
          <MediaImage
            path={data.head}
            alt={data.name}
            className="size-16 shrink-0 rounded-xl border object-cover shadow-sm md:size-20"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
              <Badge variant="outline" className="font-mono">
                v{data.version}
              </Badge>
            </div>
            <div className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
              {data.id}
              <CopyButton value={data.id} label="Sao chép mã tướng" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{skins.length} trang phục</Badge>
              <Badge variant="secondary">{data.skills.length} kỹ năng</Badge>
              {data.forms.length > 0 && <Badge variant="secondary">{data.forms.length} dạng</Badge>}
              {skins.some((skin) => !skin.portrait) && (
                <Badge variant="destructive">{skins.filter((skin) => !skin.portrait).length} thiếu portrait</Badge>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to={`/portraits?hero=${data.id}`}>
                <ImageIcon /> Portrait của tướng
              </Link>
            </Button>
            {data.sources.portraits && (
              <Button variant="outline" size="sm" asChild>
                <a href={data.sources.portraits} target="_blank" rel="noreferrer">
                  Garena <ExternalLink />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs
        value={TABS.includes(tab as (typeof TABS)[number]) ? tab : "profile"}
        onValueChange={setTab}
        className="gap-4"
      >
        <TabsList className="w-full justify-start overflow-x-auto sm:w-fit">
          <TabsTrigger value="profile">Thông tin</TabsTrigger>
          <TabsTrigger value="skills">Kỹ năng</TabsTrigger>
          <TabsTrigger value="skins">
            Trang phục{" "}
            <Badge variant="secondary" className="ml-1 h-5 px-1.5">
              {skins.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="media">Ảnh</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <HeroProfileForm hero={data} />
        </TabsContent>
        <TabsContent value="skills">
          <HeroSkillsForm hero={data} />
        </TabsContent>
        <TabsContent value="skins">
          <HeroSkinsTab hero={data} />
        </TabsContent>
        <TabsContent value="media">
          <HeroMediaTab hero={data} />
        </TabsContent>
      </Tabs>
    </Page>
  )
}
