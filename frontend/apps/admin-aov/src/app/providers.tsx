import type { ReactNode } from "react"
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { toast } from "sonner"
import { Toaster } from "@aov/ui/components/sonner"
import { TooltipProvider } from "@aov/ui/components/tooltip"
import { errorMessage, isApiError } from "@/lib/api/errors"
import { ThemeProvider, useTheme } from "./theme"
import { HotkeysProvider } from "./hotkeys"
import { DraftPersistenceGuard } from "./drafts/draft-persistence-guard"

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: { silent?: boolean }
  }
}

export const queryClient: QueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      gcTime: Infinity,
      refetchOnWindowFocus: false,
      refetchOnMount: (query) => query.state.isInvalidated,
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (mutation.meta?.silent) return
      if (isApiError(error, "VERSION_CONFLICT")) {
        toast.error(errorMessage(error), {
          action: { label: "Tải lại", onClick: () => void queryClient.invalidateQueries() },
        })
        return
      }
      toast.error(errorMessage(error))
    },
  }),
})

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <HotkeysProvider>
          <TooltipProvider delayDuration={200}>
            <DraftPersistenceGuard />
            {children}
            <ThemedToaster />
          </TooltipProvider>
        </HotkeysProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}

/** The shared Toaster reads next-themes; pass the app theme explicitly instead. */
function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster position="bottom-left" theme={resolvedTheme} />
}
