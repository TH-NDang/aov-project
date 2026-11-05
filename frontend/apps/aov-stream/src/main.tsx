import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { relaySilentLogin } from "@aov/ui/lib/public-auth"
import { BrowserRouter } from "react-router"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import "./stream.css"
import App from "./App"

const queryClient = new QueryClient()
if (!relaySilentLogin()) {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
