package com.wikiaov.build.internal.application;

import com.wikiaov.build.internal.domain.BuildRules;
import com.wikiaov.build.internal.domain.BuildRules.ArcanaPart;
import com.wikiaov.build.internal.domain.BuildRules.EnchantmentPart;
import com.wikiaov.build.internal.persistence.ArcanaPageEntryRepository;
import com.wikiaov.build.internal.persistence.ArcanaPageRepository;
import com.wikiaov.build.internal.persistence.EnchantmentSetEntryRepository;
import com.wikiaov.build.internal.persistence.EnchantmentSetRepository;
import com.wikiaov.build.internal.persistence.entity.ArcanaPageEntryRow;
import com.wikiaov.build.internal.persistence.entity.EnchantmentSetEntryRow;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Shared arcana pages and enchantment sets (ADR-026). Equal content resolves to one row; rows are never changed and are
 * removed once no build uses them. Runs inside the caller's transaction.
 */
@Component
public class BuildValues {
    private final ArcanaPageRepository pages;
    private final ArcanaPageEntryRepository pageEntries;
    private final EnchantmentSetRepository sets;
    private final EnchantmentSetEntryRepository setEntries;

    public BuildValues(ArcanaPageRepository pages, ArcanaPageEntryRepository pageEntries,
            EnchantmentSetRepository sets, EnchantmentSetEntryRepository setEntries) {
        this.pages = pages;
        this.pageEntries = pageEntries;
        this.sets = sets;
        this.setEntries = setEntries;
    }

    public UUID arcanaPage(List<ArcanaPart> arcana, Instant now) {
        String key = BuildRules.arcanaKey(arcana);
        UUID id = UUID.randomUUID();
        if (pages.insertIfAbsent(id, key, now) == 0) {
            return pages.findByContentKey(key)
                    .orElseThrow(() -> new IllegalStateException("An arcana page was neither inserted nor found."))
                    .getId();
        }

        pageEntries.saveAllAndFlush(arcana.stream().map(part -> {
            var row = new ArcanaPageEntryRow();
            row.setPageId(id);
            row.setArcanaId(part.arcanaId());
            row.setQuantity(part.quantity());
            return row;
        }).toList());
        return id;
    }

    public UUID enchantmentSet(List<EnchantmentPart> enchantments, Instant now) {
        String key = BuildRules.enchantmentKey(enchantments);
        UUID id = UUID.randomUUID();
        if (sets.insertIfAbsent(id, key, now) == 0) {
            return sets.findByContentKey(key)
                    .orElseThrow(
                            () -> new IllegalStateException("An enchantment set was neither inserted nor found."))
                    .getId();
        }

        setEntries.saveAllAndFlush(enchantments.stream().map(part -> {
            var row = new EnchantmentSetEntryRow();
            row.setSetId(id);
            row.setSlot(part.slot());
            row.setEnchantmentId(part.enchantmentId());
            return row;
        }).toList());
        return id;
    }

    /** Drops the given pages and sets if no build uses them any more. Callers flush their build changes first. */
    public void dropUnused(Collection<UUID> pageIds, Collection<UUID> setIds) {
        var unusedPages = pageIds.stream().filter(Objects::nonNull).distinct().toList();
        var unusedSets = setIds.stream().filter(Objects::nonNull).distinct().toList();
        if (!unusedPages.isEmpty()) {
            pages.deleteUnused(unusedPages);
        }
        if (!unusedSets.isEmpty()) {
            sets.deleteUnused(unusedSets);
        }
    }

    public List<ArcanaPageEntryRow> pageEntries(Collection<UUID> pageIds) {
        return pageIds.isEmpty() ? List.of() : pageEntries.findByPageIdIn(pageIds);
    }

    public List<EnchantmentSetEntryRow> setEntries(Collection<UUID> setIds) {
        return setIds.isEmpty() ? List.of() : setEntries.findBySetIdIn(setIds);
    }
}
