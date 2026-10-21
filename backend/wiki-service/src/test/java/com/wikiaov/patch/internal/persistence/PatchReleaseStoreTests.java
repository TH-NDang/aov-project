package com.wikiaov.patch.internal.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.persistence.PatchReleaseStore.VariantSnapshot;
import com.wikiaov.patch.internal.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.persistence.entity.PatchVariant;
import com.wikiaov.platform.ApiException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

class PatchReleaseStoreTests {
    private final PatchStore store = mock(PatchStore.class);
    private final PatchReleaseStore releases = new PatchReleaseStore(store);
    private final UUID regionId = UUID.randomUUID();
    private final UUID rulesetId = UUID.randomUUID();
    private final UUID variantId = UUID.randomUUID();
    private final Instant effectiveAt = Instant.parse("2026-10-21T12:00:00Z");

    @Test
    void locksRulesetBeforeLockingTheSelectedVariant() {
        when(store.one("SELECT ruleset_id FROM patch.patch_variant WHERE id=?", variantId))
                .thenReturn(Map.of("ruleset_id", rulesetId));
        var variant = new PatchVariant();
        when(store.lock(PatchVariant.class, variantId)).thenReturn(variant);

        assertThat(releases.lockVariantWithinRuleset(variantId)).isSameAs(variant);

        var order = inOrder(store);
        order.verify(store).one("SELECT ruleset_id FROM patch.patch_variant WHERE id=?", variantId);
        order.verify(store).lockRuleset(rulesetId);
        order.verify(store).lock(PatchVariant.class, variantId);
    }

    @Test
    void rereadsVariantAfterRulesetLockInsteadOfUsingTheStaleOrdinalOrStatus() {
        String query = "SELECT * FROM patch.patch_variant WHERE id=?";
        when(store.one(query, variantId)).thenReturn(
                Map.of("ruleset_id", rulesetId, "ruleset_ordinal", 3L, "status", "DRAFT"),
                Map.of("ruleset_id", rulesetId, "ruleset_ordinal", 4L, "status", "PUBLISHED"));

        var snapshot = releases.readVariantAfterLockingRuleset(variantId);

        assertThat(snapshot).isEqualTo(new VariantSnapshot(rulesetId, 4, "PUBLISHED"));
        var order = inOrder(store);
        order.verify(store).one(query, variantId);
        order.verify(store).lockRuleset(rulesetId);
        order.verify(store).one(query, variantId);
        order.verifyNoMoreInteractions();
    }

    @Test
    void assignmentQueryPreservesInclusiveStartAndExclusiveEnd() {
        var time = Timestamp.from(effectiveAt);
        when(store.rows(anyString(), eq(regionId), eq(rulesetId), eq(time), eq(time)))
                .thenReturn(List.of(Map.of("id", UUID.randomUUID())));

        assertThat(releases.regionUsesRulesetAt(regionId, rulesetId, effectiveAt)).isTrue();

        verify(store).rows(argThat(sql -> sql.contains("valid_from<=?") && sql.contains("valid_to>?")),
                eq(regionId), eq(rulesetId), eq(time), eq(time));
    }

    @Test
    void timelineQueryRejectsEqualTimesAndOrdinalsInBothDirections() {
        var variant = new VariantSnapshot(rulesetId, 7, "PUBLISHED");
        var time = Timestamp.from(effectiveAt);
        when(store.rows(anyString(), eq(regionId), eq(rulesetId), eq(time), eq(7L), eq(time), eq(7L)))
                .thenReturn(List.of(Map.of("id", UUID.randomUUID())));

        assertThat(releases.contradictsTimeline(regionId, variant, effectiveAt)).isTrue();

        verify(store).rows(argThat(sql -> sql.contains("rel.status='SCHEDULED'")
                && sql.contains("rel.effective_at<=? AND v.ruleset_ordinal>=?")
                && sql.contains("rel.effective_at>=? AND v.ruleset_ordinal<=?")),
                eq(regionId), eq(rulesetId), eq(time), eq(7L), eq(time), eq(7L));
    }

    @Test
    void mapsInsertConflictsToTheExistingApiError() {
        var release = new PatchRelease();
        doThrow(new DataIntegrityViolationException("constraint details")).when(store).insert(release);

        assertThatThrownBy(() -> releases.insert(release)).isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_CONFLICT))
                .hasMessage("The patch operation conflicts with existing data.");
    }
}
