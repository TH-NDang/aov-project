package com.wikiaov.patch.internal.release.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.authoring.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.release.persistence.PatchReleaseStore.VariantSnapshot;
import com.wikiaov.patch.internal.release.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RegionRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RulesetAssignmentRepository;
import com.wikiaov.patch.internal.ruleset.persistence.entity.GameplayRuleset;
import com.wikiaov.platform.ApiException;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

class PatchReleaseStoreTests {
    private final RegionRepository regions = mock(RegionRepository.class);
    private final GameplayRulesetRepository rulesets = mock(GameplayRulesetRepository.class);
    private final PatchVariantRepository variants = mock(PatchVariantRepository.class);
    private final PatchReleaseRepository releases = mock(PatchReleaseRepository.class);
    private final RulesetAssignmentRepository assignments = mock(RulesetAssignmentRepository.class);
    private final PatchReleaseStore store = new PatchReleaseStore(regions, rulesets, variants, releases, assignments);
    private final UUID regionId = UUID.randomUUID();
    private final UUID rulesetId = UUID.randomUUID();
    private final UUID variantId = UUID.randomUUID();

    @Test
    void locksRulesetBeforeLockingTheSelectedVariant() {
        var selected = snapshot(3, "DRAFT");
        when(variants.snapshotById(variantId)).thenReturn(Optional.of(selected));
        when(rulesets.lockById(rulesetId)).thenReturn(Optional.of(new GameplayRuleset()));
        var variant = new PatchVariant();
        when(variants.lockById(variantId)).thenReturn(Optional.of(variant));

        assertThat(store.lockVariantWithinRuleset(variantId)).isSameAs(variant);

        var order = inOrder(variants, rulesets);
        order.verify(variants).snapshotById(variantId);
        order.verify(rulesets).lockById(rulesetId);
        order.verify(variants).lockById(variantId);
    }

    @Test
    void rereadsScalarSnapshotAfterRulesetLockInsteadOfUsingTheStaleOrdinalOrStatus() {
        var beforeLock = snapshot(3, "DRAFT");
        var afterLock = snapshot(4, "PUBLISHED");
        when(variants.snapshotById(variantId)).thenReturn(Optional.of(beforeLock), Optional.of(afterLock));
        when(rulesets.lockById(rulesetId)).thenReturn(Optional.of(new GameplayRuleset()));

        assertThat(store.readVariantAfterLockingRuleset(variantId))
                .isEqualTo(new VariantSnapshot(rulesetId, 4, "PUBLISHED"));

        var order = inOrder(variants, rulesets);
        order.verify(variants).snapshotById(variantId);
        order.verify(rulesets).lockById(rulesetId);
        order.verify(variants).snapshotById(variantId);
        order.verifyNoMoreInteractions();
    }

    @Test
    void readsTheCurrentSnapshotAfterAcquiringTheVariantLock() {
        var managed = new PatchVariant();
        managed.setRulesetOrdinal(3);
        managed.setStatus("DRAFT");
        var current = snapshot(4, "PUBLISHED");
        when(variants.lockById(variantId)).thenReturn(Optional.of(managed));
        when(variants.snapshotById(variantId)).thenReturn(Optional.of(current));

        assertThat(store.lockAndReadVariant(variantId)).isEqualTo(new VariantSnapshot(rulesetId, 4, "PUBLISHED"));

        var order = inOrder(variants);
        order.verify(variants).lockById(variantId);
        order.verify(variants).snapshotById(variantId);
    }

    @Test
    void stopsBeforeLockingRulesetWhenTheSelectedVariantDoesNotExist() {
        assertThatThrownBy(() -> store.lockVariantWithinRuleset(variantId))
                .isInstanceOfSatisfying(ApiException.class,
                        exception -> assertThat(exception.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_NOT_FOUND))
                .hasMessage("Patch resource does not exist.");
        verifyNoInteractions(rulesets, releases);
    }

    @Test
    void mapsInsertConflictsToTheExistingApiError() {
        var release = new PatchRelease();
        doThrow(new DataIntegrityViolationException("constraint details")).when(releases).saveAndFlush(release);

        assertThatThrownBy(() -> store.insert(release)).isInstanceOfSatisfying(ApiException.class,
                exception -> assertThat(exception.getErrorCode()).isEqualTo(PatchErrorCode.PATCH_CONFLICT))
                .hasMessage("The patch operation conflicts with existing data.");
    }

    private PatchVariantRepository.Snapshot snapshot(long ordinal, String status) {
        var snapshot = mock(PatchVariantRepository.Snapshot.class);
        when(snapshot.getRulesetId()).thenReturn(rulesetId);
        when(snapshot.getOrdinal()).thenReturn(ordinal);
        when(snapshot.getStatus()).thenReturn(status);
        return snapshot;
    }
}
