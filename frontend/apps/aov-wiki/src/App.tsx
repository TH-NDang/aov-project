import { HeroWiki } from "./features/heroes/hero-wiki"
import { PageBackdrop } from "./components/page-backdrop"
import { PageContainer } from "./components/page-container"
import { WikiHeader } from "./components/wiki-header"

const HOME_BACKGROUND = {
  image: "/images/airi-thu-nguyen-ve-than-1-cover.jpg",
  color: "#27283f",
}

export default function App() {
  return (
    <>
      <a
        className="fixed -top-25 left-4 z-100 rounded-[4px] bg-primary px-4 py-2.5 text-primary-foreground focus:top-2.5"
        href="#main"
      >
        Đến nội dung chính
      </a>
      <PageBackdrop {...HOME_BACKGROUND} />
      <WikiHeader />
      <main id="main" tabIndex={-1} className="flex-1 pb-25 outline-none" aria-label="Nội dung wiki">
        <PageContainer className="pt-[71px] pb-[49px] max-[640px]:py-[15px]">
          <h1 className="font-heading text-[40px]/[49px] font-bold text-gold [text-shadow:0_2px_0_#0006] max-[640px]:sr-only">
            Chào mừng đến với AOV Wiki
          </h1>
          <p className="mt-1 py-2 text-base/5 text-white max-[640px]:mt-0 max-[640px]:w-fit max-[640px]:py-0 max-[640px]:text-[13.5px]/[17px] max-[640px]:text-gold max-[640px]:after:mt-2 max-[640px]:after:block max-[640px]:after:h-px max-[640px]:after:bg-linear-to-r max-[640px]:after:from-gold/70 max-[640px]:after:to-transparent max-[640px]:after:content-['']">
            Tra cứu tướng, trang bị, phù hiệu Liên Quân Mobile.
          </p>
        </PageContainer>
        <PageContainer>
          <HeroWiki />
        </PageContainer>
      </main>
    </>
  )
}
