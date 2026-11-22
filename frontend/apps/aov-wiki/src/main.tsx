import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { relaySilentLogin } from "@aov/ui/lib/public-auth"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { connectStoredAnswers } from "@aov/ui/lib/stored-answers"
import { BrowserRouter } from "react-router"
import { SheetPhoneSideProvider } from "@aov/ui/components/sheet"
import "./wiki.css"
import App from "./App"
import { WikiContextProvider } from "./context/wiki-context"

const queryClient = new QueryClient()
// Catalog queries that opt in through their meta keep their last answer in the browser for the next visit.
connectStoredAnswers(queryClient)

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
