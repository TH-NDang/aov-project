package com.wikiaov.build.internal.application;

import com.wikiaov.build.BuildReference;
import com.wikiaov.build.BuildReferenceKind;
import com.wikiaov.build.internal.application.response.BuildViews;
import com.wikiaov.build.internal.persistence.BuildItemRepository;
import com.wikiaov.build.internal.persistence.entity.ArcanaPageEntryRow;
import com.wikiaov.build.internal.persistence.entity.BuildItemRow;
import com.wikiaov.build.internal.persistence.entity.BuildRow;
import com.wikiaov.build.internal.persistence.entity.EnchantmentSetEntryRow;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** Loads the parts of many builds at once and names every reference by its current code. */
@Component
public class BuildReadModel {
    private static final List<String> COLOR_ORDER = List.of("RED", "PURPLE", "GREEN");

    private final BuildItemRepository items;
    private final BuildValues values;
    private final BuildReferences references;

    public BuildReadModel(BuildItemRepository items, BuildValues values, BuildReferences references) {
        this.items = items;
        this.values = values;
        this.references = references;
    }

    /** Parts of the given builds; references that no longer exist keep their identifier and have no code. */
    public Loaded load(Collection<BuildRow> builds) {
        var buildIds = builds.stream().map(BuildRow::getId).toList();
        var pageIds = builds.stream().map(BuildRow::getArcanaPageId).filter(Objects::nonNull).collect(
                Collectors.toSet());
        var setIds = builds.stream().map(BuildRow::getEnchantmentSetId).filter(Objects::nonNull).collect(
                Collectors.toSet());

        Map<UUID, List<BuildItemRow>> itemRows = (buildIds.isEmpty()
                ? List.<BuildItemRow>of()
                : items.findByBuildIdIn(buildIds)).stream().collect(Collectors.groupingBy(BuildItemRow::getBuildId));
        Map<UUID, List<ArcanaPageEntryRow>> pageRows = values.pageEntries(pageIds).stream()
                .collect(Collectors.groupingBy(ArcanaPageEntryRow::getPageId));
        Map<UUID, List<EnchantmentSetEntryRow>> setRows = values.setEntries(setIds).stream()
                .collect(Collectors.groupingBy(EnchantmentSetEntryRow::getSetId));

        var itemRefs = references.byIds(BuildReferenceKind.ITEM, itemRows.values().stream().flatMap(List::stream)
                .map(BuildItemRow::getItemId).collect(Collectors.toSet()));
        var arcanaRefs = references.byIds(BuildReferenceKind.ARCANA, pageRows.values().stream()
                .flatMap(List::stream).map(ArcanaPageEntryRow::getArcanaId).collect(Collectors.toSet()));
        var enchantmentRefs = references.byIds(BuildReferenceKind.ENCHANTMENT, setRows.values().stream()
                .flatMap(List::stream).map(EnchantmentSetEntryRow::getEnchantmentId).collect(Collectors.toSet()));
        var spellRefs = references.byIds(BuildReferenceKind.SPELL, builds.stream().map(BuildRow::getSpellId)
                .filter(Objects::nonNull).collect(Collectors.toSet()));
        return new Loaded(itemRows, pageRows, setRows, itemRefs, arcanaRefs, enchantmentRefs, spellRefs);
    }

    public record Loaded(
            Map<UUID, List<BuildItemRow>> itemRows,
            Map<UUID, List<ArcanaPageEntryRow>> pageRows,
            Map<UUID, List<EnchantmentSetEntryRow>> setRows,
            Map<UUID, BuildReference> itemRefs,
            Map<UUID, BuildReference> arcanaRefs,
            Map<UUID, BuildReference> enchantmentRefs,
            Map<UUID, BuildReference> spellRefs
    ) {
        public List<BuildViews.Item> items(BuildRow build) {
            return itemRows.getOrDefault(build.getId(), List.of()).stream()
                    .sorted(Comparator.comparingInt(BuildItemRow::getSlot))
                    .map(row -> new BuildViews.Item(row.getSlot(), row.getItemId(), code(itemRefs, row.getItemId())))
                    .toList();
        }

        public List<BuildViews.Enchantment> enchantments(BuildRow build) {
            return build.getEnchantmentSetId() == null
                    ? List.of()
                    : setRows.getOrDefault(build.getEnchantmentSetId(), List.of()).stream()
                            .sorted(Comparator.comparingInt(EnchantmentSetEntryRow::getSlot))
                            .map(row -> new BuildViews.Enchantment(row.getSlot(), row.getEnchantmentId(),
                                    code(enchantmentRefs, row.getEnchantmentId())))
                            .toList();
        }

        /** Arcana in the game's color order (red, purple, green), then by code. */
        public List<BuildViews.Arcana> arcana(BuildRow build) {
            return build.getArcanaPageId() == null
                    ? List.of()
                    : pageRows.getOrDefault(build.getArcanaPageId(), List.of()).stream()
                            .map(row -> new BuildViews.Arcana(row.getArcanaId(), code(arcanaRefs, row.getArcanaId()),
                                    row.getQuantity()))
                            .sorted(Comparator.comparingInt((BuildViews.Arcana arcana) -> colorRank(arcana.arcanaId()))
                                    .thenComparing(arcana -> Objects.toString(arcana.code(), "")))
                            .toList();
        }

        public String spellCode(BuildRow build) {
            return build.getSpellId() == null ? null : code(spellRefs, build.getSpellId());
        }

        public BuildViews.Build view(BuildRow build) {
            return new BuildViews.Build(build.getId(), build.getListPosition(), build.getImageId(), items(build),
                    build.getEnchantmentSetId(), enchantments(build), build.getArcanaPageId(), arcana(build),
                    build.getSpellId(), spellCode(build), build.getContentKey(), build.getPlayerName(),
                    build.getPlayerPower(), build.getPlayerWinRate(), build.isNeedsReview(), build.getNote(),
                    build.getReviewedAt(), build.getVersion());
        }

        private int colorRank(UUID arcanaId) {
            var reference = arcanaRefs.get(arcanaId);
            int rank = reference == null ? -1 : COLOR_ORDER.indexOf(reference.color());
            return rank < 0 ? COLOR_ORDER.size() : rank;
        }

        private static String code(Map<UUID, BuildReference> references, UUID id) {
            var reference = references.get(id);
            return reference == null ? null : reference.code();
        }
    }
}
