import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { relaySilentLogin } from "@aov/ui/lib/public-auth"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { connectStoredAnswers } from "@aov/ui/lib/stored-answers"
import { BrowserRouter } from "react-router"
import { SheetPhoneSideProvider } from "@aov/ui/components/sheet"
import { sizeReferenceIcons } from "@aov/ui/components/entity-rich-text"
import "./wiki.css"
import App from "./App"
import { WikiContextProvider } from "./context/wiki-context"
import { capturePrerenderedPage } from "./lib/prerendered-page"
import { resizedImageUrl } from "./lib/sized-image"

const queryClient = new QueryClient()
// Catalog queries that opt in through their meta keep their last answer in the browser for the next visit.
connectStoredAnswers(queryClient)
// Before the app replaces the static page, which names the hero a hero page is about.
capturePrerenderedPage()
// Reference icons in rich text are drawn at most 44 pixels wide; one shared copy covers them on sharp screens too.
sizeReferenceIcons((url) => resizedImageUrl(url, 96))

if (!relaySilentLogin()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <WikiContextProvider>
            {/* On a phone the side sheets rise from the bottom: a grabber, a pull down or a tap above closes them. */}
            <SheetPhoneSideProvider side="bottom">
              <App />
            </SheetPhoneSideProvider>
          </WikiContextProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  )
}
