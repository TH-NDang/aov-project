package com.wikiaov.hero.internal.change.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.change.persistence.HeroPatchHistory;
import com.wikiaov.hero.internal.domain.HeroChanges.Kind;
import com.wikiaov.hero.internal.domain.HeroChanges.OtherChange;
import com.wikiaov.hero.internal.domain.HeroChanges.OverallKind;
import com.wikiaov.hero.internal.domain.HeroChanges.Summary;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchCatalog;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HeroPatchChangesTest {
    private final HeroPatchHistory history = mock(HeroPatchHistory.class);
    private final HeroStore store = mock(HeroStore.class);
    private final AuditLog audit = mock(AuditLog.class);
    private final HeroPatchChanges changes = new HeroPatchChanges(mock(PatchDataReviews.class), history, store,
            mock(GameplayContexts.class), audit, mock(CurrentActor.class), Clock.systemUTC(),
            mock(PatchCatalog.class), mock(HeroSections.class), mock(HeroForms.class), true);

    @Test
    void assessingAChangeSetThatDoesNotExistIsNotFound() {
        UUID changeSet = UUID.randomUUID();
        when(history.heroId(changeSet)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> changes.assess(changeSet, new HeroPatchChanges.AssessmentInput(OverallKind.BUFF, 0)))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getErrorCode())
                        .isEqualTo(HeroErrorCode.HERO_PATCH_CHANGE_NOT_FOUND));
        verifyNoInteractions(store, audit);
    }

    @Test
    void rewritingARecordedChangeSetIsRefusedOnceEditsAreLocked() {
        var locked = new HeroPatchChanges(mock(PatchDataReviews.class), history, store, mock(GameplayContexts.class),
                audit, mock(CurrentActor.class), Clock.systemUTC(), mock(PatchCatalog.class), mock(HeroSections.class),
                mock(HeroForms.class), false);
        var input = new HeroChangeEditCommand("https://example.org/notes",
                List.of(new Summary("vi-VN", "Sửa lại")), List.of(new OtherChange(Kind.OTHER, "Ghi chú")));

        assertThatThrownBy(() -> locked.edit(UUID.randomUUID(), input))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getErrorCode())
                        .isEqualTo(HeroErrorCode.HERO_PATCH_CHANGE_LOCKED));
        verifyNoInteractions(history, store, audit);
    }

    @Test
    void describingAMechanicChangeThatDoesNotExistIsNotFound() {
        UUID change = UUID.randomUUID();
        when(history.mechanicChange(change)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> changes.recordPrevious(UUID.randomUUID(), change,
                new HeroPatchChanges.PreviousInput("Earlier behaviour", "https://example.org/old")))
                .isInstanceOfSatisfying(ApiException.class, error -> assertThat(error.getErrorCode())
                        .isEqualTo(HeroErrorCode.HERO_PATCH_CHANGE_NOT_FOUND));
        verifyNoInteractions(store, audit);
    }
}
