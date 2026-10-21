package com.wikiaov.patch.internal.application.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.patch.internal.application.PatchCommands.Release;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.persistence.PatchReleaseStore;
import com.wikiaov.patch.internal.persistence.PatchReleaseStore.ReleaseTarget;
import com.wikiaov.patch.internal.persistence.PatchReleaseStore.VariantSnapshot;
import com.wikiaov.patch.internal.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.persistence.entity.Region;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

class PatchReleaseWorkflowTests {
    private static final Instant NOW = Instant.parse("2026-10-20T18:00:00Z");
    private static final LocalDate LOCAL_TODAY = LocalDate.of(2026, 10, 21);
    private final UUID regionId = UUID.randomUUID();
    private final UUID rulesetId = UUID.randomUUID();
    private final UUID variantId = UUID.randomUUID();
    private final UUID seasonId = UUID.randomUUID();
    private final UUID releaseId = UUID.randomUUID();
    private final PatchReleaseStore releases = mock(PatchReleaseStore.class);
    private final RankedSeasons seasons = mock(RankedSeasons.class);
    private final CurrentActor actors = mock(CurrentActor.class);
    private final AuditLog audit = mock(AuditLog.class);
    private final PatchReleaseWorkflow workflow = new PatchReleaseWorkflow(releases, seasons,
            Clock.fixed(NOW, ZoneOffset.UTC), actors, audit);
    private final VariantSnapshot published = new VariantSnapshot(rulesetId, 3, "PUBLISHED");
    private final Actor actor = new Actor("issuer", "editor", ActorType.HUMAN, null, Set.of());

    @BeforeEach
    void authenticate() {
        when(actors.require()).thenReturn(actor);
    }

    @Test
    void schedulesExactReleaseAfterRegionAndRulesetLocksAndPreservesAuditAndFields() {
        prepareScheduling(seasonId);
        when(releases.regionUsesRulesetAt(regionId, rulesetId, NOW)).thenReturn(true);
        Instant announcedAt = NOW.minusSeconds(300);
        var input = new Release(regionId, NOW, announcedAt, "https://example.com/patch", null, null);

        UUID createdId = workflow.schedule(variantId, input);

        var saved = ArgumentCaptor.forClass(PatchRelease.class);
        var order = inOrder(releases, seasons, audit);
        order.verify(releases).lockActiveRegion(regionId);
        order.verify(releases).lockVariantWithinRuleset(variantId);
        order.verify(seasons).requireRelease(seasonId, regionId, NOW);
        order.verify(releases).lockAndReadVariant(variantId);
        order.verify(releases).regionUsesRulesetAt(regionId, rulesetId, NOW);
        order.verify(releases).contradictsTimeline(regionId, published, NOW);
        order.verify(releases).insert(saved.capture());
        order.verify(audit).record(AuditEntry.of(actor, "PATCH_RELEASE_SCHEDULED", "PATCH", createdId));
        var release = saved.getValue();
        assertThat(release.getId()).isEqualTo(createdId);
        assertThat(release.getPatchVariantId()).isEqualTo(variantId);
        assertThat(release.getRegionId()).isEqualTo(regionId);
        assertThat(release.getSeasonId()).isEqualTo(seasonId);
        assertThat(release.getEffectiveAt()).isEqualTo(NOW);
        assertThat(release.getAnnouncedAt()).isEqualTo(announcedAt);
        assertThat(release.getCreatedAt()).isEqualTo(NOW);
        assertThat(release.getSourceUrl()).isEqualTo(input.sourceUrl());
        assertThat(release.getStatus()).isEqualTo("SCHEDULED");
        assertThat(release.getEffectiveOn()).isNull();
        assertThat(release.getConfirmedAt()).isNull();
    }

    @Test
    void createsDateOnlyDraftWithRequestedSeasonWithoutCheckingAnExactTimeline() {
        prepareScheduling(null);
        var input = new Release(regionId, null, null, null, seasonId, LOCAL_TODAY);

        workflow.schedule(variantId, input);

        verify(seasons).requireReleaseDate(seasonId, regionId, LOCAL_TODAY);
        verify(releases, never()).regionUsesRulesetAt(any(), any(), any());
        verify(releases, never()).contradictsTimeline(any(), any(), any());
        var saved = ArgumentCaptor.forClass(PatchRelease.class);
        verify(releases).insert(saved.capture());
        assertThat(saved.getValue().getSeasonId()).isEqualTo(seasonId);
        assertThat(saved.getValue().getEffectiveOn()).isEqualTo(LOCAL_TODAY);
        assertThat(saved.getValue().getEffectiveAt()).isNull();
        assertThat(saved.getValue().getStatus()).isEqualTo("DRAFT");
    }

    @Test
    void reportsSeasonMismatchBeforeTimingOrSourceErrors() {
        prepareScheduling(seasonId);
        var input = new Release(regionId, null, null, "ftp://invalid", UUID.randomUUID(), null);

        assertInvalid(() -> workflow.schedule(variantId, input), "The release season must match its patch season.");

        verifyNoInteractions(seasons, audit);
        verify(releases, never()).lockAndReadVariant(any());
    }

    @Test
    void rejectsNeitherDateNorTimestampBeforeSeasonValidation() {
        prepareScheduling(null);
        var input = new Release(regionId, null, null, null, null, null);

        assertInvalid(() -> workflow.schedule(variantId, input),
                "Provide either an exact timestamp or a calendar date.");

        verifyNoInteractions(seasons, audit);
    }

    @Test
    void rejectsBothDateAndTimestampBeforeSeasonValidation() {
        prepareScheduling(null);
        var input = new Release(regionId, NOW, null, null, null, LOCAL_TODAY);

        assertInvalid(() -> workflow.schedule(variantId, input),
                "Provide either an exact timestamp or a calendar date.");

        verifyNoInteractions(seasons, audit);
    }

    @Test
    void reportsSeasonScheduleFailureBeforeInvalidSourceOrPublication() {
        prepareScheduling(seasonId);
        doThrow(new ApiException(PatchErrorCode.PATCH_INVALID, "Outside season."))
                .when(seasons).requireRelease(seasonId, regionId, NOW);
        var input = new Release(regionId, NOW, null, "ftp://invalid", null, null);

        assertInvalid(() -> workflow.schedule(variantId, input), "Outside season.");

        verify(releases, never()).lockAndReadVariant(any());
        verifyNoInteractions(audit);
    }

    @Test
    void reportsInvalidSourceBeforePublication() {
        prepareScheduling(seasonId);
        var input = new Release(regionId, NOW, null, "ftp://invalid", null, null);

        assertInvalid(() -> workflow.schedule(variantId, input), "Source URL must use HTTP or HTTPS.");

        verify(releases, never()).lockAndReadVariant(any());
        verifyNoInteractions(audit);
    }

    @Test
    void requiresPublicationBeforeRulesetAssignment() {
        prepareScheduling(seasonId);
        when(releases.lockAndReadVariant(variantId)).thenReturn(new VariantSnapshot(rulesetId, 3, "DRAFT"));

        assertInvalid(() -> workflow.schedule(variantId, exactRelease()),
                "Publish the variant before scheduling a release.");

        verify(releases, never()).regionUsesRulesetAt(any(), any(), any());
        verify(releases, never()).insert(any());
    }

    @Test
    void requiresRulesetAssignmentBeforeCheckingTimelineConflicts() {
        prepareScheduling(seasonId);

        assertInvalid(() -> workflow.schedule(variantId, exactRelease()),
                "The region does not use this ruleset at the release time.");

        verify(releases, never()).contradictsTimeline(any(), any(), any());
        verify(releases, never()).insert(any());
        verifyNoInteractions(audit);
    }

    @Test
    void refusesContradictoryTimelineWithoutSavingOrAuditing() {
        prepareScheduling(seasonId);
        when(releases.regionUsesRulesetAt(regionId, rulesetId, NOW)).thenReturn(true);
        when(releases.contradictsTimeline(regionId, published, NOW)).thenReturn(true);

        assertInvalid(() -> workflow.schedule(variantId, exactRelease()),
                "The release would contradict the region patch timeline.");

        verify(releases, never()).insert(any());
        verifyNoInteractions(audit);
    }

    @Test
    void confirmsUsingTheRegionsCalendarDateAndMarksTheActualApplyInstant() {
        var release = prepareConfirmation(LOCAL_TODAY);
        when(releases.regionUsesRulesetAt(regionId, rulesetId, NOW)).thenReturn(true);

        workflow.confirm(releaseId);

        var order = inOrder(releases, seasons, audit);
        order.verify(releases).releaseTarget(releaseId);
        order.verify(releases).lockRegion(regionId);
        order.verify(releases).readVariantAfterLockingRuleset(variantId);
        order.verify(releases).lockRelease(releaseId);
        order.verify(seasons).requireRelease(seasonId, regionId, NOW);
        order.verify(releases).regionUsesRulesetAt(regionId, rulesetId, NOW);
        order.verify(releases).contradictsTimeline(regionId, published, NOW);
        order.verify(audit).record(AuditEntry.of(actor, "PATCH_RELEASE_CONFIRMED", "PATCH", releaseId));
        assertThat(release.getEffectiveAt()).isEqualTo(NOW);
        assertThat(release.getConfirmedAt()).isEqualTo(NOW);
        assertThat(release.getEffectiveOn()).isEqualTo(LOCAL_TODAY);
        assertThat(release.getStatus()).isEqualTo("SCHEDULED");
        verify(releases, never()).insert(any());
    }

    @Test
    void confirmedReleaseIsIdempotentAfterAcquiringItsLocks() {
        var release = prepareConfirmation(null);
        Instant originallyConfirmed = NOW.minusSeconds(100);
        release.setConfirmedAt(originallyConfirmed);
        release.setStatus("SCHEDULED");

        workflow.confirm(releaseId);

        verify(releases).readVariantAfterLockingRuleset(variantId);
        verify(releases).lockRelease(releaseId);
        verifyNoInteractions(seasons, audit);
        assertThat(release.getConfirmedAt()).isEqualTo(originallyConfirmed);
    }

    @Test
    void unavailableRegionIsRejectedEvenForAlreadyConfirmedRelease() {
        prepareConfirmation(LOCAL_TODAY).setConfirmedAt(NOW);
        when(releases.lockRegion(regionId)).thenReturn(region(false));

        assertInvalid(() -> workflow.confirm(releaseId), "The market is unavailable.");

        verify(releases, never()).readVariantAfterLockingRuleset(any());
        verify(releases, never()).lockRelease(any());
    }

    @Test
    void refusesNonDraftReleaseBeforeCheckingFutureDateOrPublication() {
        var release = prepareConfirmation(LOCAL_TODAY.plusDays(1));
        release.setStatus("SCHEDULED");

        assertInvalid(() -> workflow.confirm(releaseId),
                "Only a date-only release awaiting confirmation can be confirmed.");

        verifyNoInteractions(seasons, audit);
    }

    @Test
    void refusesReleaseWithoutCalendarDate() {
        prepareConfirmation(null);

        assertInvalid(() -> workflow.confirm(releaseId),
                "Only a date-only release awaiting confirmation can be confirmed.");

        verifyNoInteractions(seasons, audit);
    }

    @Test
    void reportsFutureCalendarDateBeforeUnpublishedVariant() {
        var release = prepareConfirmation(LOCAL_TODAY.plusDays(1));
        when(releases.readVariantAfterLockingRuleset(variantId))
                .thenReturn(new VariantSnapshot(rulesetId, 3, "DRAFT"));

        assertInvalid(() -> workflow.confirm(releaseId), "A future release cannot be confirmed as applied.");

        assertThat(release.getConfirmedAt()).isNull();
        verifyNoInteractions(seasons, audit);
    }

    @Test
    void requiresPublishedVariantBeforeConfirmingTheSeasonOrTimeline() {
        var release = prepareConfirmation(LOCAL_TODAY);
        when(releases.readVariantAfterLockingRuleset(variantId))
                .thenReturn(new VariantSnapshot(rulesetId, 3, "DRAFT"));

        assertInvalid(() -> workflow.confirm(releaseId), "Publish the variant before confirming its release.");

        assertThat(release.getConfirmedAt()).isNull();
        verifyNoInteractions(seasons, audit);
    }

    @Test
    void failedConfirmationLeavesDraftUnchanged() {
        var release = prepareConfirmation(LOCAL_TODAY);
        when(releases.regionUsesRulesetAt(regionId, rulesetId, NOW)).thenReturn(true);
        when(releases.contradictsTimeline(regionId, published, NOW)).thenReturn(true);

        assertInvalid(() -> workflow.confirm(releaseId),
                "The release would contradict the region patch timeline.");

        assertThat(release.getStatus()).isEqualTo("DRAFT");
        assertThat(release.getEffectiveAt()).isNull();
        assertThat(release.getConfirmedAt()).isNull();
        verifyNoInteractions(audit);
    }

    private void prepareScheduling(UUID variantSeasonId) {
        var variant = new PatchVariant();
        variant.setSeasonId(variantSeasonId);
        when(releases.lockVariantWithinRuleset(variantId)).thenReturn(variant);
        when(releases.lockAndReadVariant(variantId)).thenReturn(published);
    }

    private PatchRelease prepareConfirmation(LocalDate date) {
        when(releases.releaseTarget(releaseId)).thenReturn(new ReleaseTarget(regionId, variantId));
        when(releases.lockRegion(regionId)).thenReturn(region(true));
        when(releases.readVariantAfterLockingRuleset(variantId)).thenReturn(published);
        var release = new PatchRelease();
        release.setId(releaseId);
        release.setSeasonId(seasonId);
        release.setEffectiveOn(date);
        release.setStatus("DRAFT");
        when(releases.lockRelease(releaseId)).thenReturn(release);
        return release;
    }

    private Region region(boolean available) {
        return new Region(regionId, "VN", "Vietnam", "AOV", "vi-VN", "Asia/Ho_Chi_Minh", available);
    }

    private Release exactRelease() {
        return new Release(regionId, NOW, null, null, null, null);
    }

    private static void assertInvalid(Runnable action, String detail) {
        assertThatThrownBy(action::run).isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_INVALID))
                .hasMessage(detail);
    }
}
