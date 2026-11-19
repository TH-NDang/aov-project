import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { backendRequest } from "@/app/auth/session"
import { confirmAction } from "@/components/confirm-dialog"
import { errorMessage } from "@/lib/api/errors"
import { createPublishingApi, publishingKeys } from "@/lib/api/publishing-api"
import type { Cause, Revision } from "@/lib/hero-types"
import type { NewDraft } from "@/features/warehouse/components/sheet/warehouse-sheet"
import { invalidateHeroCatalogs } from "../../api/publishing-cache"
import type { PublicationOverview } from "../../api/publication-overview"
import { publicationPatchLink, publishBlockers, usesObservedStats } from "../../model/publish-rules"
import { headerActionOf } from "../../model/hero-workspace-model"
import type { HeroRevision } from "./use-hero-revision"

const api = createPublishingApi(backendRequest)

/**
 * What acts on the version on screen as a whole: opening another one, publishing, discarding, starting a draft and
 * moving an imported baseline. Every write keeps the page busy and refreshes the lists that show the hero.
 */
export function useHeroRevisionActions({
  heroId,
  hero,
  overview,
  holdsForms,
  canWrite,
  canPublish,
  translating,
  note,
  updateLocation,
  setBusy,
  setError,
  setEditing,
}: {
  heroId: string
  hero: HeroRevision
  overview: { data?: PublicationOverview; isPending: boolean }
  holdsForms: boolean
  canWrite: boolean
  canPublish: boolean
  translating: boolean
  note: string
  updateLocation: (patch: Record<string, string | null | undefined>) => void
  setBusy: (busy: boolean) => void
  setError: (message: string) => void
  setEditing: (editing: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [publishFailure, setPublishFailure] = useState("")
  const [publishing, setPublishing] = useState(false)
  const { preview, revision, revisions, localDraft, setSelectedId } = hero

  const publicationPatch = overview.data?.variants.find(
    (variant) => variant.id === revision?.effectiveFromPatchVariantId,
  )
  const issues = preview
    ? publishBlockers({
        revision: preview.revision,
        content: preview.content,
        patch: publicationPatch,
        patchLoading: overview.isPending,
        observedStats: usesObservedStats(preview.content, publicationPatch),
        holdsForms,
      }).map((blocker) => blocker.message)
    : []
  const patchLink = revision && publicationPatchLink(revision, publicationPatch)
  // One ruleset holds one draft, so a second one can only fail: offer the one that exists instead.
  const openDraft = revisions.data?.find((row) => row.state === "DRAFT" && row.rulesetId === revision?.rulesetId)
  const startDraftLabel = openDraft ? `Mở bản nháp #${openDraft.revisionNo}` : "Tạo bản nháp"
  const canFork = revision?.state === "PUBLISHED" && canWrite && !openDraft
  const headerAction = headerActionOf(revision, canPublish, canWrite)

  async function refreshLists() {
    await invalidateHeroCatalogs(queryClient)
    await queryClient.invalidateQueries({ queryKey: publishingKeys.comparisons(heroId) })
    await revisions.refetch()
  }

  async function run(action: () => Promise<unknown>, success: string, onFailure: (message: string) => void = setError) {
    setBusy(true)
    setError("")
    try {
      await action()
      toast.success(success)
      await refreshLists()
    } catch (failure) {
      onFailure(errorMessage(failure))
    } finally {
      setBusy(false)
    }
  }

  async function openRevision(next: Revision) {
    const data = await api.read(next.heroId, next.id)
    queryClient.setQueryData(publishingKeys.preview(next.heroId, next.id), data)
    setSelectedId(next.id)
    updateLocation({ revision: next.id, compare: null, changes: null })
    setEditing(false)
  }

  function chooseRevision(next: string) {
    setSelectedId(next)
    updateLocation({ revision: next, compare: null, changes: null, translationKey: null, translationField: null })
    setEditing(false)
  }

  function publishRevision() {
    if (!revision) return
    setPublishing(true)
    void run(
      async () => {
        const published = await api.publish(revision, note)
        await localDraft.discard()
        await openRevision(published)
      },
      "Đã xuất bản phiên bản tướng.",
      setPublishFailure,
    ).finally(() => setPublishing(false))
  }

  async function discardDraft() {
    if (!revision) return
    const confirmed = await confirmAction({
      title: "Hủy bản nháp này?",
      description: "Bản đã xuất bản vẫn được giữ lại.",
      confirmLabel: "Hủy bản nháp",
      cancelLabel: "Giữ bản nháp",
    })
    if (!confirmed) return

    void run(async () => {
      const discarded = await api.discard(revision)
      await localDraft.discard()
      await openRevision(discarded)
    }, "Đã hủy bản nháp.")
  }

  function forkDraft(request: NewDraft) {
    if (!revision) return
    void run(async () => {
      await openRevision(await api.fork(revision, request.cause as Cause, request.patchVariantId ?? null))
      updateLocation({ view: request.cause === "TRANSLATION" ? "translations" : "overview" })
    }, "Đã tạo bản nháp từ phiên bản đang xem.")
  }

  function startDraft() {
    if (!openDraft) return forkDraft({ cause: translating ? "TRANSLATION" : "CONTENT_CORRECTION" })
    setSelectedId(openDraft.id)
    updateLocation({ revision: openDraft.id, compare: null, changes: null })
    setEditing(false)
  }

  async function moveBaseline(next: Revision) {
    await openRevision(next)
    await refreshLists()
    toast.success("Đã đổi patch, giữ nguyên nội dung và ảnh.")
  }

  return {
    publicationPatch,
    issues,
    patchLink,
    openDraft,
    startDraftLabel,
    canFork,
    headerAction,
    publishing,
    publishFailure,
    setPublishFailure,
    run,
    openRevision,
    chooseRevision,
    publishRevision,
    discardDraft,
    forkDraft,
    startDraft,
    moveBaseline,
  }
}
