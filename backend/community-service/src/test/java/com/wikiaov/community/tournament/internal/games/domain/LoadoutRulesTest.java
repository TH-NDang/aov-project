package com.wikiaov.community.tournament.internal.games.domain;

import static com.wikiaov.community.testsupport.GameContentFixtures.named;
import static com.wikiaov.community.testsupport.GameContentFixtures.reference;
import static com.wikiaov.community.testsupport.GameContentFixtures.selection;
import static org.assertj.core.api.Assertions.assertThat;

import com.wikiaov.community.tournament.internal.domain.CatalogContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.GameContent.ArcanaAllocation;
import com.wikiaov.community.tournament.internal.domain.GameContent.EnchantmentAllocation;
import com.wikiaov.community.tournament.internal.domain.GameContent.Loadout;
import com.wikiaov.community.tournament.internal.domain.GameContent.ObservationStatus;
import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.Test;

class LoadoutRulesTest {
    private static final Catalog CATALOG = new Catalog(List.of(), List.of(),
            List.of(reference(100, 3, "RED", null), reference(101, 3, "PURPLE", null)),
            List.of(reference(110, 1, null, "main"), reference(111, 2, null, "main"),
                    reference(113, 1, null, "secondary-a")),
            List.of(), null);

    @Test
    void anArcanaIsListedOnceInALoadout() {
        var entries = List.of(new ArcanaAllocation(selection(100), 5, "RED"),
                new ArcanaAllocation(selection(100), 5, "RED"));

        assertThat(arcana(entries)).containsExactly("arcana.entries[1].duplicate");
    }

    @Test
    void anArcanaCountIsBetweenOneAndTen() {
        var entries = List.of(new ArcanaAllocation(selection(101), 0, "PURPLE"));

        assertThat(arcana(entries)).containsExactly("arcana.entries[0].count.range");
    }

    @Test
    void anUnobservedEnchantmentLoadoutCannotCarryEntries() {
        var loadout = new Loadout<>(ObservationStatus.NOT_SHOWN,
                List.of(new EnchantmentAllocation(selection(110), true, 1, "main")), null);

        assertThat(enchantments(loadout, false, CATALOG)).containsExactly("enchantments.unknownHasEntries");
    }

    @Test
    void aLoadoutHoldsAtMostFiveEnchantments() {
        var entries = new ArrayList<EnchantmentAllocation>();
        for (int index = 0; index < 6; index++) {
            entries.add(new EnchantmentAllocation(named("secondary " + index), false, 1, "branch-" + index));
        }

        assertThat(enchantments(partial(entries), false, null)).contains("enchantments.maximum");
    }

    @Test
    void anEnchantmentKeepsTheTierAndBranchOfTheCatalog() {
        var entries = List.of(new EnchantmentAllocation(selection(110), true, 2, "other"));

        assertThat(enchantments(partial(entries), false, CATALOG)).containsExactly(
                "enchantments.entries[0].tier.mismatch", "enchantments.entries[0].branch.mismatch");
    }

    @Test
    void aPublishedLoadoutNamesTheBranchOfEveryEnchantment() {
        var entries = List.of(new EnchantmentAllocation(named("Observed"), true, 1, null));

        assertThat(enchantments(new Loadout<>(ObservationStatus.KNOWN, entries, null), true, CATALOG))
                .contains("enchantments.entries[0].branchCode");
    }

    @Test
    void twoPrimaryEnchantmentsCannotShareATier() {
        var entries = List.of(new EnchantmentAllocation(named("first"), true, 1, "main"),
                new EnchantmentAllocation(named("second"), true, 1, "main"));

        assertThat(enchantments(partial(entries), false, null))
                .containsExactly("enchantments.entries[1].primaryTier.duplicate");
    }

    @Test
    void aPublishedLoadoutHasThreePrimaryAndTwoSecondaryEnchantments() {
        var entries = List.of(new EnchantmentAllocation(selection(110), true, 1, "main"),
                new EnchantmentAllocation(selection(111), true, 2, "main"),
                new EnchantmentAllocation(selection(113), false, 1, "secondary-a"));

        assertThat(enchantments(new Loadout<>(ObservationStatus.KNOWN, entries, null), true, CATALOG))
                .containsExactly("enchantments.primaryThree.secondaryTwo");
    }

    @Test
    void primaryEnchantmentsComeFromOneBranch() {
        var entries = List.of(new EnchantmentAllocation(named("first"), true, 1, "main"),
                new EnchantmentAllocation(named("second"), true, 2, "other"));

        assertThat(enchantments(partial(entries), false, null)).containsExactly("enchantments.primary.sameBranch");
    }

    @Test
    void twoSecondaryEnchantmentsOfOneBranchAreItsTiersOneAndTwo() {
        var entries = List.of(new EnchantmentAllocation(named("first"), false, 1, "secondary-a"),
                new EnchantmentAllocation(named("second"), false, 1, "secondary-a"));

        assertThat(enchantments(partial(entries), false, null))
                .containsExactly("enchantments.secondary.tiersOneTwo");
    }

    @Test
    void secondaryEnchantmentsOfTwoBranchesAreBothTierOne() {
        var entries = List.of(new EnchantmentAllocation(named("first"), false, 2, "secondary-a"),
                new EnchantmentAllocation(named("second"), false, 1, "secondary-b"));

        assertThat(enchantments(partial(entries), false, null))
                .containsExactly("enchantments.secondary.mixedTierOne");
    }

    private static <T> Loadout<T> partial(List<T> entries) {
        return new Loadout<>(ObservationStatus.PARTIAL, entries, null);
    }

    private static List<String> arcana(List<ArcanaAllocation> entries) {
        var errors = new ArrayList<String>();
        LoadoutRules.arcana(partial(entries), "arcana", false, CATALOG, errors);
        return errors;
    }

    private static List<String> enchantments(Loadout<EnchantmentAllocation> loadout, boolean publication,
            @Nullable Catalog catalog) {
        var errors = new ArrayList<String>();
        LoadoutRules.enchantments(loadout, "enchantments", publication, catalog, errors);
        return errors;
    }
}
