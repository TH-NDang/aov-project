package com.wikiaov.build.internal.domain;

import com.wikiaov.build.internal.domain.BuildRules.ArcanaPart;
import com.wikiaov.build.internal.domain.BuildRules.EnchantmentPart;
import com.wikiaov.build.internal.domain.BuildRules.ItemPart;
import java.util.List;
import java.util.UUID;

/**
 * What one build holds; a part may be incomplete while the build waits for review. The arcana page is optional: the
 * game's icons do not always tell which arcana a page holds.
 */
public record BuildContent(
        List<ItemPart> items,
        List<EnchantmentPart> enchantments,
        List<ArcanaPart> arcana,
        UUID spellId
) {
    public BuildContent {
        items = List.copyOf(items);
        enchantments = List.copyOf(enchantments);
        arcana = List.copyOf(arcana);
    }

    public boolean complete() {
        return BuildRules.itemsComplete(items) && BuildRules.enchantmentsComplete(enchantments) && spellId != null;
    }

    public List<String> problems() {
        return BuildRules.problems(items, enchantments, arcana);
    }

    /** The key of the whole build, or null while a part is missing. */
    public String contentKey() {
        return complete()
                ? BuildRules.buildKey(items, BuildRules.enchantmentKey(enchantments), BuildRules.arcanaKey(arcana),
                        spellId)
                : null;
    }
}
