import { useState } from "react"
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@aov/ui/components/carousel"
import { HOME_BANNERS } from "./home-banners"
import { HomeIcon } from "./home-icon"
import { useBannerRotation } from "./use-banner-rotation"
import { useWikiContext, wikiText } from "../../context/wiki-context"

const ENGLISH_BANNER_COPY = {
  athanor: {
    eyebrow: "THE WORLD OF ATHANOR",
    title: ["Stories from", "across Athanor"],
    description: "Discover the world beyond every battle.",
  },
  heroes: {
    eyebrow: "LEGENDS OF ATHANOR",
    title: ["One hero.", "Endless possibilities."],
    description: "Explore their strengths. Find your own playstyle.",
  },
  discovery: {
    eyebrow: "TOGETHER WITH AOV WiKi",
    title: ["Small discoveries.", "Lasting impressions."],
    description: "Unearth the stories still waiting to be found.",
  },
} satisfies Record<(typeof HOME_BANNERS)[number]["id"], { eyebrow: string; title: string[]; description: string }>

export function HomeCarousel() {
  const { locale } = useWikiContext()
  const [api, setApi] = useState<CarouselApi>()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const { selected, paused, setPaused, reducedMotion, cycle, running, duration } = useBannerRotation(
    api,
    hovered || focused,
  )

  return (
    <Carousel
      className="wiki-home-carousel"
      opts={{ loop: true, duration: reducedMotion ? 0 : 30 }}
      setApi={setApi}
      aria-label={wikiText(locale, "Khám phá AOV WiKi", "Explore AOV WiKi")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
    >
      <CarouselContent className="ml-0">
        {HOME_BANNERS.map((banner, index) => {
          const copy = locale.startsWith("en") ? ENGLISH_BANNER_COPY[banner.id] : banner
          return (
            <CarouselItem
              className="wiki-home-slide pl-0"
              key={banner.id}
              aria-label={`${index + 1} / ${HOME_BANNERS.length}`}
              aria-hidden={selected !== index}
            >
              <article className="wiki-home-banner" data-align={banner.align} data-tone={banner.tone}>
                <img
                  src={banner.image}
                  alt={wikiText(locale, `Ảnh tướng ${banner.character}`, `${banner.character} artwork`)}
                  width="1280"
                  height="786"
                  style={{ objectPosition: banner.position }}
                  fetchPriority={index === 0 ? "high" : "low"}
                  loading={index === 0 ? "eager" : "lazy"}
                  draggable={false}
                />
                <div className="wiki-home-banner-copy">
                  <span className="wiki-home-eyebrow">{copy.eyebrow}</span>
                  <h2>
                    {copy.title[0]}
                    <span>{copy.title[1]}</span>
                  </h2>
                  <p>{copy.description}</p>
                </div>
              </article>
            </CarouselItem>
          )
        })}
      </CarouselContent>

      <div className="wiki-home-slide-controls">
        <div className="wiki-home-slide-dots" aria-label={wikiText(locale, "Chọn banner", "Choose a banner")}>
          {HOME_BANNERS.map((banner, index) => (
            <button
              key={banner.id}
              className="wiki-home-slide-dot"
              aria-label={`Banner ${index + 1}: ${banner.character}`}
              aria-current={selected === index ? "true" : undefined}
              onClick={() => api?.scrollTo(index)}
            >
              <span />
            </button>
          ))}
        </div>
        {!reducedMotion && (
          <button
            className="wiki-home-icon-button wiki-home-slide-pause"
            aria-label={
              paused
                ? wikiText(locale, "Tiếp tục tự chuyển banner", "Resume the slideshow")
                : wikiText(locale, "Tạm dừng tự chuyển banner", "Pause the slideshow")
            }
            aria-pressed={paused}
            onClick={() => setPaused(!paused)}
          >
            <HomeIcon name={paused ? "play" : "pause"} />
          </button>
        )}
      </div>
      <button
        className="wiki-home-icon-button wiki-home-slide-prev"
        aria-label={wikiText(locale, "Banner trước", "Previous banner")}
        onClick={() => api?.scrollPrev()}
      >
        <HomeIcon name="left" />
      </button>
      <button
        className="wiki-home-icon-button wiki-home-slide-next"
        aria-label={wikiText(locale, "Banner tiếp theo", "Next banner")}
        onClick={() => api?.scrollNext()}
      >
        <HomeIcon name="right" />
      </button>
      <div className="wiki-home-slide-progress" aria-hidden="true">
        <span
          key={cycle}
          style={{ animationDuration: `${duration}ms`, animationPlayState: running ? "running" : "paused" }}
        />
      </div>
    </Carousel>
  )
}
