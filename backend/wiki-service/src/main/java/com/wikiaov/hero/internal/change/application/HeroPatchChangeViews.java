package com.wikiaov.hero.internal.change.application;

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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Preserves the existing history JSON field names while persistence uses typed entities. */
final class HeroPatchChangeViews {
    private static final List<String> TYPE_ORDER = List.of("HERO_STAT_CHANGE", "HERO_SKILL_CHANGE", "HERO_ROLE_CHANGE",
            "HERO_VISUAL_CHANGE", "HERO_MECHANIC_CHANGE", "HERO_OTHER_CHANGE");

    private HeroPatchChangeViews() {
    }

    static List<Map<String, Object>> render(List<Entry> entries) {
        return entries.stream().map(HeroPatchChangeViews::render).toList();
    }

    private static Map<String, Object> render(Entry entry) {
        var header = entry.header();

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", header.getId());
        result.put("overallKind", entry.assessment() == null ? null : entry.assessment().getKind().name());
        result.put("assessmentVersion", entry.assessment() == null ? 0L : entry.assessment().getVersion());
        result.put("heroId", header.getHeroId());
        result.put("heroCode", header.getHeroCode());
        result.put("patchVariantId", header.getPatchVariantId());
        result.put("fromHeroRevisionId", header.getFromHeroRevisionId());
        result.put("toHeroRevisionId", header.getToHeroRevisionId());
        result.put("sourceKind", header.getSourceKind().name());
        result.put("sourceUrl", header.getSourceUrl());
        result.put("introducesHero", header.getIntroducesHero());

        if (entry.translation() != null) {
            result.put("actualLocale", entry.translation().getLocale());
            result.put("summary", entry.translation().getSummary());
        }

        var changes = entry.changes().stream().map(change -> change(change, entry.previous()))
                .sorted(Comparator.<Map<String, Object>>comparingInt(value -> (Integer) value.get("sortOrder"))
                        .thenComparingInt(value -> TYPE_ORDER.indexOf((String) value.get("type"))))
                .toList();
        result.put("changes", changes);
        return result;
    }

    private static Map<String, Object> change(HeroChangeClassification change,
            Map<UUID, MechanicChangePrevious> previous) {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("id", change.getId());
        value.put("changeKind", change.getChangeKind());
        value.put("sortOrder", change.getSortOrder());

        switch (change) {
            case StatChangeClassification item -> {
                value.put("type", "HERO_STAT_CHANGE");
                value.put("statKey", item.getStatKey());
                value.put("oldValue", item.getOldValue());
                value.put("newValue", item.getNewValue());
                value.put("unitCode", item.getUnitCode());
            }
            case SkillChangeClassification item -> {
                value.put("type", "HERO_SKILL_CHANGE");
                value.put("skillKey", item.getSkillKey());
                value.put("fieldKey", item.getFieldKey());
                value.put("oldValue", item.getOldValue());
                value.put("newValue", item.getNewValue());
            }
            case RoleChangeClassification item -> {
                value.put("type", "HERO_ROLE_CHANGE");
                value.put("roleCode", item.getRoleCode());
                value.put("added", item.isAdded());
            }
            case VisualChangeClassification item -> {
                value.put("type", "HERO_VISUAL_CHANGE");
                value.put("mediaRole", item.getMediaRole());
                value.put("oldAssetId", item.getOldAssetId());
                value.put("newAssetId", item.getNewAssetId());
            }
            case MechanicChangeClassification item -> {
                value.put("type", "HERO_MECHANIC_CHANGE");
                value.put("mechanicKey", item.getMechanicKey());
                value.put("description", item.getDescription());
                value.put("previous", item.getId() == null ? null : previous(previous.get(item.getId())));
            }
            case OtherChangeClassification item -> {
                value.put("type", "HERO_OTHER_CHANGE");
                value.put("description", item.getDescription());
            }
            default -> throw new IllegalStateException("Unsupported hero change classification.");
        }

        return value;
    }

    /** What the mechanic did before its change, with the source it was written from; null until recorded. */
    private static Map<String, Object> previous(MechanicChangePrevious value) {
        if (value == null)
            return null;

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("description", value.getDescription());
        result.put("sourceUrl", value.getSourceUrl());
        result.put("recordedAt", value.getCreatedAt());
        return result;
    }
}
