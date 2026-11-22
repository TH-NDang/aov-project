import { StrictMode, type ReactNode } from "react"
import { createRoot } from "react-dom/client"
import { relaySilentLogin } from "@aov/ui/lib/public-auth"
import { BrowserRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { connectStoredAnswers } from "@aov/ui/lib/stored-answers"
import { LocaleProvider } from "@aov/ui/hooks/use-locale-text"
import { useStreamLocale } from "./components/stream-locale"
import "./stream.css"
import App from "./App"

const queryClient = new QueryClient()
// A query opts in through `meta: { storedAnswer: "stream-…@1" }` to keep its last answer for the next visit. Only
// answers that no longer change belong there, such as a finished tournament; never live scores or a reader's own data.
connectStoredAnswers(queryClient)

/** Gives the shared components Stream's language, and follows the reader when they switch. */
function StreamLocale({ children }: { children: ReactNode }) {
  return <LocaleProvider locale={useStreamLocale().languageTag}>{children}</LocaleProvider>
}
if (!relaySilentLogin(import.meta.env.BASE_URL)) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
        <QueryClientProvider client={queryClient}>
          <StreamLocale>
            <App />
          </StreamLocale>
        </QueryClientProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
