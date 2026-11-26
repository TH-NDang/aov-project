import { config } from "zod"

// Imported first by main.tsx, before any schema exists. Zod would otherwise probe for eval, which the content security
// policy refuses; its interpreter is fast enough here.
config({ jitless: true })
