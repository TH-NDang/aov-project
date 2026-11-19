import { registerHooks } from "node:module"

/**
 * Loads the app's modules the way Vite would for the DOM tests. Stylesheets load as nothing and images as their path:
 * Vite and browser checks own how they render. The sign-in session and the portal frame read Vite's `import.meta.env`
 * while they load and talk to the identity provider, so the app's imports of them get the doubles in this folder.
 */
const doubles = new Map([
  ["stream-auth", new URL("./stream-auth.ts", import.meta.url).href],
  ["stream-shell", new URL("./stream-shell.tsx", import.meta.url).href],
])

registerHooks({
  resolve(specifier, context, nextResolve) {
    const name = specifier.match(/(?:^|\/)([\w-]+?)(?:\.tsx?)?$/)?.[1]
    const fromApp = context.parentURL?.includes("/aov-stream/src/") && name && doubles.has(name)
    return nextResolve(fromApp ? doubles.get(name) : specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", source: "export default {}", shortCircuit: true }
    if (/\.(svg|png|jpe?g|webp)$/.test(url))
      return { format: "module", source: `export default ${JSON.stringify(new URL(url).pathname)}`, shortCircuit: true }
    return nextLoad(url, context)
  },
})
