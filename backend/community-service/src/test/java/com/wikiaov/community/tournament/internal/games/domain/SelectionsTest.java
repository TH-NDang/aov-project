package com.wikiaov.community.tournament.internal.games.domain;

import static com.wikiaov.community.testsupport.GameContentFixtures.named;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import org.junit.jupiter.api.Test;

class SelectionsTest {
    @Test
    void aSelectionNameHoldsAtMostTwoHundredCharacters() {
        var errors = new ArrayList<String>();

        Selections.check(named("x".repeat(201)), false, "hero", errors, null);

        assertThat(errors).containsExactly("hero.name.length");
    }

    @Test
    void selectionsNamedAlikeAreTheSameWhateverTheirCaseAndSpacing() {
        assertThat(Selections.identity(named(" Florentino "))).isEqualTo(Selections.identity(named("florentino")));
    }
}
