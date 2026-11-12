package com.wikiaov.build.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.build.internal.domain.BuildRules.ArcanaPart;
import com.wikiaov.build.internal.domain.BuildRules.EnchantmentPart;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class BuildRulesTest {
    private static final UUID A1 = UUID.randomUUID(), A2 = UUID.randomUUID(), A3 = UUID.randomUUID(),
            B1 = UUID.randomUUID(), B2 = UUID.randomUUID(), C1 = UUID.randomUUID();

    @Test
    void acceptsTheGamesTwoWaysOfPickingSecondaryEnchantments() {
        var sameBranch = List.of(part(1, A1, "a", 1), part(2, A2, "a", 2), part(3, A3, "a", 3), part(4, B2, "b", 2),
                part(5, B1, "b", 1));
        var twoBranches = List.of(part(1, A1, "a", 1), part(2, A2, "a", 2), part(3, A3, "a", 3), part(4, C1, "c", 1),
                part(5, B1, "b", 1));

        assertThat(BuildRules.problems(List.of(), sameBranch, List.of())).isEmpty();
        assertThat(BuildRules.problems(List.of(), twoBranches, List.of())).isEmpty();
    }

    @Test
    void rejectsSecondaryPicksTheGameDoesNotAllow() {
        var twoBranchesTierTwo = List.of(part(1, A1, "a", 1), part(2, A2, "a", 2), part(3, A3, "a", 3),
                part(4, C1, "c", 1), part(5, B2, "b", 2));
        var mainBranchAgain = List.of(part(1, A1, "a", 1), part(2, A2, "a", 2), part(3, A3, "a", 3),
                part(4, B1, "b", 1), part(5, UUID.randomUUID(), "a", 1));
        var primaryOutOfOrder = List.of(part(1, A2, "a", 2), part(2, A1, "a", 1), part(3, A3, "a", 3),
                part(4, B1, "b", 1), part(5, B2, "b", 2));

        assertThat(BuildRules.problems(List.of(), twoBranchesTierTwo, List.of()))
                .containsExactly("Secondary enchantments of two branches must both be tier 1.");
        assertThat(BuildRules.problems(List.of(), mainBranchAgain, List.of()))
                .contains("Secondary enchantments must come from another branch than the primary one.");
        assertThat(BuildRules.problems(List.of(), primaryOutOfOrder, List.of()))
                .contains("Primary enchantment slot 1 must be tier 1.");
    }

    @Test
    void checksArcanaPerColorAndKeysPagesWhateverTheOrder() {
        var red = UUID.randomUUID();
        var purple = UUID.randomUUID();
        var otherPurple = UUID.randomUUID();
        var page = List.of(new ArcanaPart(red, 10, "RED"), new ArcanaPart(purple, 3, "PURPLE"),
                new ArcanaPart(otherPurple, 7, "PURPLE"));

        assertThat(BuildRules.problems(List.of(), List.of(), page)).isEmpty();
        assertThat(BuildRules.problems(List.of(), List.of(),
                List.of(new ArcanaPart(purple, 5, "PURPLE"), new ArcanaPart(otherPurple, 6, "PURPLE"))))
                .containsExactly("PURPLE arcana add up to 11; the game allows 10.");
        assertThat(BuildRules.arcanaKey(page)).isEqualTo(BuildRules.arcanaKey(List.of(page.get(2), page.get(0),
                page.get(1)))).hasSize(64);
    }

    private static EnchantmentPart part(int slot, UUID id, String branch, int tier) {
        return new EnchantmentPart(slot, id, branch, tier);
    }
}
