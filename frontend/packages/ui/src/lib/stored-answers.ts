/**
 * Keeps the last answer of chosen queries in the browser (IndexedDB), so a returning reader sees it at once while the
 * query reads it again behind it.
 *
 * A query opts in by naming its kind in its meta: `meta: { storedAnswer: "wiki-heroes@1" }`. The version after the @
 * is bumped when the shape of the answer changes. One copy is kept per kind: a new scope (market, locale, version)
 * replaces the copy of the previous one, and the copies together stay under a size limit, the oldest going first.
 * Nothing else is kept: answers about a signed-in reader, live scores or anything a query does not opt in for never
 * reach the store. Where storage is missing or refused (a private window, an old browser), nothing is kept and
 * nothing fails.
 */

/** A kept answer: whose it is (`hash` is the query's hash), when it was read and roughly how large it is. */
export interface StoredAnswer {
  kind: string
  hash: string
  savedAt: number
  bytes: number
  data: unknown
}

/** Where the answers are kept: IndexedDB in the browser, a map in tests. */
export interface StoredAnswerStore {
  get(kind: string): Promise<StoredAnswer | undefined>
  put(answer: StoredAnswer): Promise<void>
  /** Every kept answer's kind, time and size, without its data. */
  sizes(): Promise<{ kind: string; savedAt: number; bytes: number }[]>
  delete(kind: string): Promise<void>
}

/** The few parts of a TanStack Query client this needs, so the package does not depend on it. */
export interface StoredAnswerClient {
  getQueryCache(): {
    subscribe(
      listener: (event: {
        type: string
        query: {
          queryKey: readonly unknown[]
          queryHash: string
          meta?: Record<string, unknown>
          state: { data: unknown; dataUpdatedAt: number }
        }
        action?: { type: string; manual?: boolean }
      }) => void,
    ): () => void
  }
  setQueryData(key: readonly unknown[], data: unknown, options: { updatedAt: number }): unknown
}

/** About 25 MB of answers at most, far under what browsers give a site, so the store is never the one evicted. */
export const STORED_ANSWERS_LIMIT = 25 * 1024 * 1024

/** A rough size of an answer, in UTF-16 bytes of its JSON; maps and sets count by their entries. */
export function answerBytes(data: unknown) {
  try {
    const json = JSON.stringify(data, (_, value) =>
      value instanceof Map ? [...value] : value instanceof Set ? [...value] : value,
    )
    return (json?.length ?? 0) * 2
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

/**
 * Seeds each opted-in query with its kept answer when the query first appears without data, and keeps every answer
 * such a query reads. Returns the function that stops it.
 */
export function connectStoredAnswers(
  client: StoredAnswerClient,
  store: StoredAnswerStore | undefined = indexedDbAnswers(),
  limit = STORED_ANSWERS_LIMIT,
) {
  if (!store) return () => {}

  return client.getQueryCache().subscribe((event) => {
    const kind = event.query.meta?.storedAnswer
    if (typeof kind !== "string") return
    const query = event.query

    if (event.type === "added" && query.state.data === undefined) {
      void store
        .get(kind)
        .then((kept) => {
          // A kept answer belongs to one query: another market or locale reads its own. One the network already
          // answered is left alone.
          if (kept && kept.hash === query.queryHash && query.state.dataUpdatedAt === 0) {
            client.setQueryData(query.queryKey, kept.data, { updatedAt: kept.savedAt })
          }
        })
        .catch(() => {})
      return
    }

    // A read from the network, not the seeding above (which sets data by hand).
    if (event.type === "updated" && event.action?.type === "success" && !event.action.manual) {
      void keep(store, { kind, hash: query.queryHash, data: query.state.data }, limit).catch(() => {})
    }
  })
}

async function keep(store: StoredAnswerStore, answer: { kind: string; hash: string; data: unknown }, limit: number) {
  const bytes = answerBytes(answer.data)
  if (bytes > limit) return

  await store.put({ ...answer, savedAt: Date.now(), bytes })

  // The oldest answers of other kinds go first until the rest fit.
  const kept = (await store.sizes()).sort((a, b) => a.savedAt - b.savedAt)
  let total = kept.reduce((sum, entry) => sum + entry.bytes, 0)
  for (const entry of kept) {
    if (total <= limit) break
    if (entry.kind === answer.kind) continue
    await store.delete(entry.kind)
    total -= entry.bytes
  }
}

const DATABASE = "aov-stored-answers"
const ANSWERS = "answers"
const SIZES = "sizes"

/** The answers in IndexedDB, or undefined where the browser has none or refuses it. */
export function indexedDbAnswers(): StoredAnswerStore | undefined {
  if (typeof indexedDB === "undefined") return undefined
  let opened: Promise<IDBDatabase> | undefined
  const database = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1)
      request.onupgradeneeded = () => {
        // Data and sizes apart, so sizing the store for eviction never loads every answer.
        request.result.createObjectStore(ANSWERS, { keyPath: "kind" })
        request.result.createObjectStore(SIZES, { keyPath: "kind" })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error("The stored answers database is blocked."))
    }))
  const done = <T>(request: IDBRequest<T>) =>
    new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  const finished = (transaction: IDBTransaction) =>
    new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })

  return {
    async get(kind) {
      const db = await database()
      return done<StoredAnswer | undefined>(db.transaction(ANSWERS).objectStore(ANSWERS).get(kind))
    },
    async put(answer) {
      const db = await database()
      const transaction = db.transaction([ANSWERS, SIZES], "readwrite")
      transaction.objectStore(ANSWERS).put(answer)
      transaction.objectStore(SIZES).put({ kind: answer.kind, savedAt: answer.savedAt, bytes: answer.bytes })
      await finished(transaction)
    },
    async sizes() {
      const db = await database()
      return done<{ kind: string; savedAt: number; bytes: number }[]>(db.transaction(SIZES).objectStore(SIZES).getAll())
    },
    async delete(kind) {
      const db = await database()
      const transaction = db.transaction([ANSWERS, SIZES], "readwrite")
      transaction.objectStore(ANSWERS).delete(kind)
      transaction.objectStore(SIZES).delete(kind)
      await finished(transaction)
    },
  }
}
