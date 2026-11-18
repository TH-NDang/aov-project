package com.wikiaov.hero.internal.change.application;

import com.wikiaov.hero.HeroChangeEntry;
import com.wikiaov.hero.HeroChangeEntry.Line;
import com.wikiaov.hero.HeroChangeEntry.MechanicLine;
import com.wikiaov.hero.HeroChangeEntry.OtherLine;
import com.wikiaov.hero.HeroChangeEntry.Previous;
import com.wikiaov.hero.HeroChangeEntry.RoleLine;
import com.wikiaov.hero.HeroChangeEntry.SkillLine;
import com.wikiaov.hero.HeroChangeEntry.StatLine;
import com.wikiaov.hero.HeroChangeEntry.VisualLine;
import com.wikiaov.hero.internal.change.persistence.HeroPatchHistory.Entry;
import com.wikiaov.hero.internal.change.persistence.entity.HeroChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.MechanicChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.MechanicChangePrevious;
import com.wikiaov.hero.internal.change.persistence.entity.OtherChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.RoleChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.SkillChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.StatChangeClassification;
import com.wikiaov.hero.internal.change.persistence.entity.VisualChangeClassification;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Turns the stored change sets into the history entries the API sends. */
final class HeroPatchChangeViews {
    private static final List<String> TYPE_ORDER = List.of(StatLine.TYPE, SkillLine.TYPE, RoleLine.TYPE,
            VisualLine.TYPE, MechanicLine.TYPE, OtherLine.TYPE);

    private HeroPatchChangeViews() {
    }

    static List<HeroChangeEntry> render(List<Entry> entries) {
        return entries.stream().map(HeroPatchChangeViews::render).toList();
    }

    private static HeroChangeEntry render(Entry entry) {
        var header = entry.header();
        var assessment = entry.assessment();
        var translation = entry.translation();

        var changes = entry.changes().stream().map(change -> line(change, entry.previous()))
                .sorted(Comparator.comparingInt(Line::sortOrder)
                        .thenComparingInt(line -> TYPE_ORDER.indexOf(line.type())))
                .toList();

        return new HeroChangeEntry(header.getId(), assessment == null ? null : assessment.getKind(),
                assessment == null ? 0L : assessment.getVersion(), header.getHeroId(), header.getHeroCode(),
                header.getPatchVariantId(), header.getFromHeroRevisionId(), header.getToHeroRevisionId(),
                header.getSourceKind(), header.getSourceUrl(), header.getIntroducesHero(),
                translation == null ? null : translation.getLocale(),
                translation == null ? null : translation.getSummary(), changes, null, null, null, null);
    }

    private static Line line(HeroChangeClassification change, Map<UUID, MechanicChangePrevious> previous) {
        var id = change.getId();
        var kind = change.getChangeKind();
        int order = change.getSortOrder();

        return switch (change) {
            case StatChangeClassification item -> new StatLine(id, kind, order, StatLine.TYPE, item.getStatKey(),
                    item.getOldValue(), item.getNewValue(), item.getUnitCode());
            case SkillChangeClassification item -> new SkillLine(id, kind, order, SkillLine.TYPE, item.getSkillKey(),
                    item.getFieldKey(), item.getOldValue(), item.getNewValue());
            case RoleChangeClassification item -> new RoleLine(id, kind, order, RoleLine.TYPE, item.getRoleCode(),
                    item.isAdded());
            case VisualChangeClassification item -> new VisualLine(id, kind, order, VisualLine.TYPE,
                    item.getMediaRole(), item.getOldAssetId(), item.getNewAssetId());
            case MechanicChangeClassification item -> new MechanicLine(id, kind, order, MechanicLine.TYPE,
                    item.getMechanicKey(), item.getDescription(), id == null ? null : previous(previous.get(id)));
            case OtherChangeClassification item -> new OtherLine(id, kind, order, OtherLine.TYPE,
                    item.getDescription());
            default -> throw new IllegalStateException("Unsupported hero change classification.");
        };
    }

    /** What the mechanic did before its change, with the source it was written from; null until recorded. */
    private static @Nullable Previous previous(@Nullable MechanicChangePrevious value) {
        return value == null ? null : new Previous(value.getDescription(), value.getSourceUrl(), value.getCreatedAt());
    }
}
