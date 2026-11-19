package com.wikiaov.build.internal.domain;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * The game's rules for one build (ADR-026) and the content keys that let equal arcana pages, enchantment sets and builds
 * share one identity. The enchantment rule matches the one used for tournament loadouts in community-service.
 */
public final class BuildRules {
    public static final int ITEM_SLOTS = 6;
    public static final int ENCHANTMENT_SLOTS = 5;
    public static final int ARCANA_PER_COLOR = 10;

    private BuildRules() {
    }

    public record ItemPart(
            int slot,
            UUID itemId
    ) {
    }

    /** {@code branchCode} and {@code tier} come from the enchantment's owner. */
    public record EnchantmentPart(
            int slot,
            UUID enchantmentId,
            String branchCode,
            Integer tier
    ) {
    }

    /** {@code color} comes from the arcana's owner. */
    public record ArcanaPart(
            UUID arcanaId,
            int quantity,
            String color
    ) {
    }

    public static boolean itemsComplete(List<ItemPart> items) {
        return items.size() == ITEM_SLOTS;
    }

    public static boolean enchantmentsComplete(List<EnchantmentPart> enchantments) {
        return enchantments.size() == ENCHANTMENT_SLOTS;
    }

    /** Rule violations in English; an incomplete part is checked only for what it already holds. */
    public static List<String> problems(List<ItemPart> items, List<EnchantmentPart> enchantments,
            List<ArcanaPart> arcana) {
        List<String> problems = new ArrayList<>();
        itemProblems(items, problems);
        enchantmentProblems(enchantments, problems);
        arcanaProblems(arcana, problems);
        return problems;
    }

    private static void itemProblems(List<ItemPart> items, List<String> problems) {
        Set<Integer> slots = new HashSet<>();
        for (var item : items) {
            if (item.slot() < 1 || item.slot() > ITEM_SLOTS) {
                problems.add("Item slot " + item.slot() + " is outside 1-" + ITEM_SLOTS + ".");
            } else if (!slots.add(item.slot())) {
                problems.add("Item slot " + item.slot() + " is listed twice.");
            }
        }
    }

    private static void enchantmentProblems(List<EnchantmentPart> enchantments, List<String> problems) {
        int before = problems.size();
        Set<Integer> slots = new HashSet<>();
        Set<UUID> ids = new HashSet<>();
        for (var enchantment : enchantments) {
            if (enchantment.slot() < 1 || enchantment.slot() > ENCHANTMENT_SLOTS) {
                problems.add("Enchantment slot " + enchantment.slot() + " is outside 1-" + ENCHANTMENT_SLOTS + ".");
            } else if (!slots.add(enchantment.slot())) {
                problems.add("Enchantment slot " + enchantment.slot() + " is listed twice.");
            }
            if (!ids.add(enchantment.enchantmentId())) {
                problems.add("An enchantment is used twice.");
            }
            if (enchantment.branchCode() == null || enchantment.tier() == null) {
                problems.add("Enchantment in slot " + enchantment.slot() + " has no branch or tier.");
            }
        }
        if (problems.size() > before || !enchantmentsComplete(enchantments)) {
            return;
        }

        Map<Integer, EnchantmentPart> bySlot = enchantments.stream()
                .collect(Collectors.toMap(EnchantmentPart::slot, part -> part));
        String main = bySlot.get(1).branchCode();
        for (int slot = 1; slot <= 3; slot++) {
            var part = bySlot.get(slot);
            if (!main.equals(part.branchCode())) {
                problems.add("The three primary enchantments must share one branch.");
            }
            if (part.tier() != slot) {
                problems.add("Primary enchantment slot " + slot + " must be tier " + slot + ".");
            }
        }
        var first = bySlot.get(4);
        var second = bySlot.get(5);
        if (main.equals(first.branchCode()) || main.equals(second.branchCode())) {
            problems.add("Secondary enchantments must come from another branch than the primary one.");
        }
        if (first.branchCode().equals(second.branchCode())) {
            if (!Set.of(first.tier(), second.tier()).equals(Set.of(1, 2))) {
                problems.add("Two secondary enchantments of one branch must be tiers 1 and 2.");
            }
        } else if (first.tier() != 1 || second.tier() != 1) {
            problems.add("Secondary enchantments of two branches must both be tier 1.");
        }
    }

    private static void arcanaProblems(List<ArcanaPart> arcana, List<String> problems) {
        Set<UUID> ids = new HashSet<>();
        Map<String, Integer> perColor = new TreeMap<>();
        for (var part : arcana) {
            if (!ids.add(part.arcanaId())) {
                problems.add("An arcana is listed twice.");
            }
            if (part.quantity() < 1 || part.quantity() > ARCANA_PER_COLOR) {
                problems.add("An arcana quantity must be 1-" + ARCANA_PER_COLOR + ".");
            }
            if (part.color() == null) {
                problems.add("An arcana has no color.");
            } else {
                perColor.merge(part.color(), part.quantity(), Integer::sum);
            }
        }

        perColor.forEach((color, total) -> {
            if (total > ARCANA_PER_COLOR) {
                problems.add(color + " arcana add up to " + total + "; the game allows " + ARCANA_PER_COLOR + ".");
            }
        });
    }

    /** Equal pages get equal keys whatever the order of their entries. */
    public static String arcanaKey(List<ArcanaPart> arcana) {
        return sha256(arcana.stream().sorted(Comparator.comparing(ArcanaPart::arcanaId))
                .map(part -> part.arcanaId() + ":" + part.quantity()).collect(Collectors.joining(",")));
    }

    public static String enchantmentKey(List<EnchantmentPart> enchantments) {
        return sha256(enchantments.stream().sorted(Comparator.comparingInt(EnchantmentPart::slot))
                .map(part -> part.slot() + ":" + part.enchantmentId()).collect(Collectors.joining(",")));
    }

    public static String buildKey(List<ItemPart> items, String enchantmentKey, String arcanaKey, UUID spellId) {
        String itemText = items.stream().sorted(Comparator.comparingInt(ItemPart::slot))
                .map(item -> item.slot() + ":" + item.itemId())
                .collect(Collectors.joining(","));
        return sha256("items=" + itemText + "|enchantments=" + enchantmentKey + "|arcana=" + arcanaKey + "|spell="
                + spellId);
    }

    static String sha256(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable.", e);
        }
    }
}
