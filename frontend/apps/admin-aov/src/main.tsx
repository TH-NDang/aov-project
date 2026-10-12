import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"
import "@aov/ui/styles.css"
import { AppProviders } from "./app/providers"
import { initializeSession } from "./app/auth/session"
import { AuthGate } from "./app/auth/auth-gate"

const root = createRoot(document.getElementById("root")!)
async function bootstrap() {
  root.render(
    <AppProviders>
      <AuthGate>{null}</AuthGate>
    </AppProviders>,
  )
  await initializeSession()
  const { router } = await import("./app/router")
  root.render(
    <StrictMode>
      <AppProviders>
        <AuthGate>
          <RouterProvider router={router} />
        </AuthGate>
      </AppProviders>
    </StrictMode>,
  )
}
void bootstrap()
