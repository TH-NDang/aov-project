import { Link } from "react-router"
import { WikiIcon } from "../../components/wiki-icon"
import { useState } from "react"
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@aov/ui/components/carousel"
import { HOME_BANNERS } from "./home-banners"
import { HomeIcon } from "./home-icon"
import { useBannerRotation } from "./use-banner-rotation"
import { useWikiContext, wikiText } from "../../context/wiki-context"

export function HomeCarousel() {
  const { locale, href } = useWikiContext()
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
          return (
            <CarouselItem
              className="wiki-home-slide pl-0"
              key={banner.id}
              aria-label={`${index + 1} / ${HOME_BANNERS.length}`}
              aria-hidden={selected !== index}
            >
              <div className="wiki-home-banner">
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
              </div>
            </CarouselItem>
          )
        })}
      </CarouselContent>

      <div className="wiki-home-cover-copy">
        <h1>{wikiText(locale, "Thư viện Liên Quân", "Arena of Valor Library")}</h1>
        <p>
          {wikiText(
            locale,
            "Kỹ năng tướng, công thức trang bị và cập nhật theo mùa.",
            "Hero abilities, item recipes and seasonal updates.",
          )}
        </p>
        <Link className="wiki-cover-cta" to={href("/hero")}>
          {wikiText(locale, "Khám phá tướng", "Explore heroes")} <WikiIcon name="arrow" size={17} />
        </Link>
      </div>
      <div className="wiki-cover-caption" aria-hidden="true">
        {HOME_BANNERS[selected]?.character}
      </div>
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
