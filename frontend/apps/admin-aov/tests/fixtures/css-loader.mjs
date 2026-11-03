import { registerHooks } from "node:module"

// DOM tests assert behavior; Vite and browser checks own stylesheet rendering.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export default {}", shortCircuit: true }
    return nextLoad(url, context)
  },
})
