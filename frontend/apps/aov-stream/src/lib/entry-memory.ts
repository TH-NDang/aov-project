/** What a reader chose on a page without changing its address, such as a list unfolded or the order of one. */
export type Choice = string | number | boolean | null

/** Entries whose choices are kept; the oldest give way. */
const KEPT = 40

const isChoice = (value: unknown): value is Choice =>
  value === null || ["string", "number", "boolean"].includes(typeof value)

/** What was chosen on each entry of the history, the entry written last at the end. */
export function entryMemory(saved?: string | null) {
  const entries = new Map<string, Map<string, Choice>>()
  try {
    const read: unknown = JSON.parse(saved || "{}")
    for (const [entry, choices] of Object.entries(read ?? {}))
      entries.set(
        entry,
        new Map(Object.entries(choices ?? {}).filter((choice): choice is [string, Choice] => isChoice(choice[1]))),
      )
  } catch {
    // What another version of the app saved is not worth keeping.
  }
  return {
    recall: (entry: string, name: string): Choice | undefined => entries.get(entry)?.get(name),
    remember: (entry: string, name: string, choice: Choice) => {
      const choices = entries.get(entry) ?? new Map<string, Choice>()
      choices.set(name, choice)
      entries.delete(entry)
      entries.set(entry, choices)
      for (const oldest of entries.keys()) {
        if (entries.size <= KEPT) break
        entries.delete(oldest)
      }
    },
    save: () =>
      JSON.stringify(Object.fromEntries([...entries].map(([entry, all]) => [entry, Object.fromEntries(all)]))),
  }
}
