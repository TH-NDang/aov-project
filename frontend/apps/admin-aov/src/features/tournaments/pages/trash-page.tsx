import { PageHeader } from "@/components/page-header"
import { AccessGate, EsportsPage } from "@/features/esports/pages/esports-shell"
import { RecordTrash } from "../components/record-trash"
import "../model/tournament-styles"

/** Tournament records moved to the trash, of every kind, where they are restored; reached from the tournament hub. */
export function TournamentTrashPage() {
  return (
    <AccessGate>
      {(access) => (
        <EsportsPage>
          <PageHeader title="Thùng rác giải đấu" />
          <RecordTrash initialKind="tournaments" actorKey={access.actorKey} canWrite={access.canWrite} />
        </EsportsPage>
      )}
    </AccessGate>
  )
}
