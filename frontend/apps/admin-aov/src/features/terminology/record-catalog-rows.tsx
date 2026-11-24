import { InfiniteScroll } from "@aov/ui/components/infinite-scroll"
import { ErrorState } from "@/components/query-state"
import { RecordCatalogRow } from "./record-catalog-row"
import type { RecordKind } from "./record-catalog-api"
import { useRecordCatalog } from "./use-record-catalog"

/** The records of `kinds` as rows of a table, one kind after the other, each read as the reader scrolls to it. */
export function RecordCatalogRows({ kinds, search }: { kinds: readonly RecordKind[]; search: string }) {
  const [kind, ...rest] = kinds
  return kind && <KindRows key={kind} kind={kind} rest={rest} search={search} />
}

function KindRows({ kind, rest, search }: { kind: RecordKind; rest: readonly RecordKind[]; search: string }) {
  const query = useRecordCatalog(kind, search)
  // A record that moved while the list was read stands on two pages.
  const records = new Map(query.data?.pages.flatMap((page) => page.items).map((record) => [record.entity.id, record]))
  // A kind that cannot be read ends the list: when the service is away, one message says it for all of them.
  const whole = query.isSuccess && !query.hasNextPage
  return (
    <>
      {[...records].map(([id, record]) => (
        <RecordCatalogRow key={id} record={record} />
      ))}
      {!whole && !query.isLoadingError && (
        <tr className="block @xl/catalog:table-row">
          <td colSpan={4} className="block @xl/catalog:table-cell">
            {query.isPending ? (
              <p role="status" className="p-4 type-meta">
                Đang tải danh mục…
              </p>
            ) : (
              <InfiniteScroll query={query} label="Đang tải thêm danh mục" />
            )}
          </td>
        </tr>
      )}
      {query.isLoadingError && (
        <tr className="block @xl/catalog:table-row">
          <td colSpan={4} className="block p-3 @xl/catalog:table-cell">
            <ErrorState error={query.error} onRetry={() => void query.refetch()} />
          </td>
        </tr>
      )}
      {whole && <RecordCatalogRows kinds={rest} search={search} />}
    </>
  )
}
