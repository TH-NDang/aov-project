import { WikiHeader } from "./components/wiki-header"

export default function App() {
  return (
    <>
      <a
        className="fixed -top-25 left-4 z-100 rounded-[4px] bg-primary px-4 py-2.5 text-primary-foreground focus:top-2.5"
        href="#main"
      >
        Đến nội dung chính
      </a>
      <WikiHeader />
      <main
        id="main"
        tabIndex={-1}
        className="flex-1 bg-[radial-gradient(ellipse_at_50%_0%,#272b3333,transparent_65%)]"
        aria-label="Nội dung wiki"
      />
    </>
  )
}
