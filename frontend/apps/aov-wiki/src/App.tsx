import { PageBackdrop } from "./components/page-backdrop"
import { WikiHeader } from "./components/wiki-header"
import { WikiHome } from "./features/home/wiki-home"

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
      <main id="main" tabIndex={-1} className="flex-1 outline-none" aria-label="Nội dung wiki">
        <WikiHome />
      </main>
    </>
  )
}
