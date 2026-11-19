package com.wikiaov.community.tournament.internal.games.domain;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.ArcanaAllocation;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Catalog;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.EnchantmentAllocation;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Loadout;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.ObservationStatus;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/** The arcana page and the enchantments a player brought into a game, as far as the source showed them. */
final class LoadoutRules {
    /** Arcana: at most ten of one kind and ten of each colour, thirty in a full page. */
    static final int MAX_ARCANA_COUNT = 10;
    static final int ARCANA_PER_COLOR = 10;
    static final int ARCANA_TOTAL = 30;
    static final List<String> ARCANA_COLORS = List.of("RED", "PURPLE", "GREEN");
    /** Enchantments: three of the primary branch, two of the secondary one, tiers 1 to 3. */
    static final int MAX_ENCHANTMENTS = 5;
    static final int PRIMARY_ENCHANTMENTS = 3;
    static final int SECONDARY_ENCHANTMENTS = 2;
    static final int MAX_ENCHANTMENT_TIER = 3;
    static final int MAX_SECONDARY_TIER = 2;

    private LoadoutRules() {
    }

    static void arcana(Loadout<ArcanaAllocation> loadout, String path, boolean publication, @Nullable Catalog catalog,
            List<String> errors) {
        if (unobserved(loadout, path, errors)) {
            return;
        }
        boolean complete = publication && loadout.status() == ObservationStatus.KNOWN;
        var references = catalog == null ? null : catalog.arcana();
        var colors = new HashMap<String, Integer>();
        var ids = new HashSet<String>();
        int total = 0;
        for (int index = 0; index < loadout.entries().size(); index++) {
            var entry = loadout.entries().get(index);
            String field = path + ".entries[" + index + "]";
            Selections.check(entry.selection(), complete, field + ".selection", errors, references);
            if (Selections.present(entry.selection()) && !ids.add(Selections.identity(entry.selection()))) {
                errors.add(field + ".duplicate");
            }
            int count = entry.count() == null ? 0 : entry.count();
            if (count < 1 || count > MAX_ARCANA_COUNT) {
                errors.add(field + ".count.range");
            }
            total += count;
            String color = entry.color();
            var reference = Selections.reference(entry.selection(), references);
            if (reference != null) {
                if (color != null && !color.equals(reference.color())) {
                    errors.add(field + ".color.mismatch");
                }
                color = reference.color();
            }
            if (color != null && ARCANA_COLORS.contains(color)) {
                colors.merge(color, count, Integer::sum);
            } else if (complete || !Selections.present(entry.selection())) {
                errors.add(field + ".color");
            }
        }
        if (total > ARCANA_TOTAL || complete && total != ARCANA_TOTAL) {
            errors.add(path + ".total.thirty");
        }
        for (var color : ARCANA_COLORS) {
            if (colors.getOrDefault(color, 0) > ARCANA_PER_COLOR
                    || complete && colors.getOrDefault(color, 0) != ARCANA_PER_COLOR) {
                errors.add(path + ".colors." + color + ".ten");
            }
        }
    }

    static void enchantments(Loadout<EnchantmentAllocation> loadout, String path, boolean publication,
            @Nullable Catalog catalog, List<String> errors) {
        if (unobserved(loadout, path, errors)) {
            return;
        }
        boolean complete = publication && loadout.status() == ObservationStatus.KNOWN;
        if (loadout.entries().size() > MAX_ENCHANTMENTS) {
            errors.add(path + ".maximum");
        }
        var references = catalog == null ? null : catalog.enchantments();
        var primary = new HashMap<Integer, String>();
        var secondary = new ArrayList<Map.Entry<Integer, String>>();
        var ids = new HashSet<String>();
        for (int index = 0; index < loadout.entries().size(); index++) {
            var entry = loadout.entries().get(index);
            String field = path + ".entries[" + index + "]";
            Selections.check(entry.selection(), complete, field + ".selection", errors, references);
            if (Selections.present(entry.selection()) && !ids.add(Selections.identity(entry.selection()))) {
                errors.add(field + ".duplicate");
            }
            int tier = entry.tier() == null ? 0 : entry.tier();
            String branch = entry.branchCode();
            var reference = Selections.reference(entry.selection(), references);
            if (reference != null) {
                if (entry.tier() != null && !entry.tier().equals(reference.tier())) {
                    errors.add(field + ".tier.mismatch");
                }
                if (branch != null && !branch.equals(reference.branchCode())) {
                    errors.add(field + ".branch.mismatch");
                }
                tier = reference.tier() == null ? 0 : reference.tier();
                branch = reference.branchCode();
            }
            if (tier < 1 || tier > MAX_ENCHANTMENT_TIER || !entry.primary() && tier > MAX_SECONDARY_TIER) {
                errors.add(field + ".tier.range");
            }
            if (branch == null || branch.isBlank()) {
                if (complete) {
                    errors.add(field + ".branchCode");
                }
                branch = "unknown";
            }
            if (entry.primary()) {
                if (primary.put(tier, branch) != null) {
                    errors.add(field + ".primaryTier.duplicate");
                }
            } else {
                secondary.add(Map.entry(tier, branch));
            }
        }
        if (complete && (primary.size() != PRIMARY_ENCHANTMENTS || secondary.size() != SECONDARY_ENCHANTMENTS)) {
            errors.add(path + ".primaryThree.secondaryTwo");
        }
        if (new HashSet<>(primary.values()).size() > 1) {
            errors.add(path + ".primary.sameBranch");
        }
        secondaryBranch(primary, secondary, path, errors);
    }

    /** A loadout the source did not show has nothing to check, but it cannot carry entries either. */
    private static boolean unobserved(Loadout<?> loadout, String path, List<String> errors) {
        if (loadout.status() == ObservationStatus.KNOWN || loadout.status() == ObservationStatus.PARTIAL) {
            return false;
        }
        if (!loadout.entries().isEmpty()) {
            errors.add(path + ".unknownHasEntries");
        }
        return true;
    }

    /**
     * The secondary enchantments come from another branch than the primary ones: tiers 1 and 2 of one branch, or tier 1
     * of two branches.
     */
    private static void secondaryBranch(Map<Integer, String> primary, List<Map.Entry<Integer, String>> secondary,
            String path, List<String> errors) {
        String main = primary.values().stream().findFirst().orElse(null);
        if (secondary.stream().anyMatch(entry -> entry.getValue().equals(main))) {
            errors.add(path + ".secondary.differentBranch");
        }
        if (secondary.size() == SECONDARY_ENCHANTMENTS) {
            var first = secondary.get(0);
            var second = secondary.get(1);
            if (first.getValue().equals(second.getValue())) {
                if (!new HashSet<>(List.of(first.getKey(), second.getKey())).equals(Set.of(1, 2))) {
                    errors.add(path + ".secondary.tiersOneTwo");
                }
            } else if (first.getKey() != 1 || second.getKey() != 1) {
                errors.add(path + ".secondary.mixedTierOne");
            }
        }
    }
}
