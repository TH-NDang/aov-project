package com.wikiaov.gamemode.internal.domain;

import com.wikiaov.gamemode.internal.domain.GameModeContent.RuleSection;
import com.wikiaov.gamemode.internal.domain.GameModeContent.Source;
import com.wikiaov.platform.ApiFieldError;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Structural rules of a mode revision (spec 01, game modes section). */
public final class GameModeContentRules {
    public static final Set<String> GROUPS = Set.of("PVP", "ENTERTAINMENT");

    public static final Set<String> AVAILABILITY = Set.of("ALWAYS_OPEN", "LIMITED", "SPECIAL", "CLOSED", "LOCKED",
            "UNKNOWN");

    public static final Set<String> GUIDE_KINDS = Set.of("NONE", "AUTO_CHESS");

    private GameModeContentRules() {
    }

    /** Errors that block saving, e.g. an unknown group or an end date before the start date. */
    public static List<ApiFieldError> validate(GameModeContent content) {
        var checks = new ContentChecks();

        checks.text("name", content.name(), 120, false);
        checks.oneOf("group", content.group(), GROUPS, false);
        checks.range("order", content.order(), 0, 999, false);
        checks.text("summary", content.summary(), 1000, false);
        checks.text("playersLabel", content.playersLabel(), 40, false);
        checks.oneOf("guideKind", content.guideKind(), GUIDE_KINDS, true);
        duration(checks, content.duration());
        availability(checks, content.availability());
        rules(checks, "rules", content.rules(), 40);
        heroes(checks, content);
        specialItems(checks, content);
        sources(checks, "sources", content.sources());

        return checks.errors();
    }

    /** Fields that must be filled before publication; an empty list means the revision can be published. */
    public static List<String> missingFields(GameModeContent content) {
        var missing = new ArrayList<String>();
        if (content.name() == null || content.name().isBlank())
            missing.add("name");
        if (content.group() == null)
            missing.add("group");
        if (content.availability() == null || content.availability().status() == null)
            missing.add("availability.status");
        return missing;
    }

    /** Every asset the revision refers to, in display order. */
    public static Set<UUID> assets(GameModeContent content) {
        var ids = new LinkedHashSet<UUID>();
        if (content.artAssetId() != null)
            ids.add(content.artAssetId());
        content.specialItems().forEach(item -> {
            if (item.iconAssetId() != null)
                ids.add(item.iconAssetId());
        });
        return ids;
    }

    static void rules(ContentChecks checks, String path, List<RuleSection> rules, int max) {
        checks.size(path, rules, max);
        for (int i = 0; i < rules.size(); i++) {
            var rule = rules.get(i);
            String at = path + "[" + i + "]";
            if (rule == null) {
                checks.fail(at, "REQUIRED", "A rule entry is required.");
                continue;
            }
            checks.text(at + ".group", rule.group(), 120, false);
            checks.text(at + ".title", rule.title(), 160, true);
            checks.text(at + ".body", rule.body(), 4000, false);
        }
    }

    static void sources(ContentChecks checks, String path, List<Source> sources) {
        checks.size(path, sources, 20);
        for (int i = 0; i < sources.size(); i++) {
            var source = sources.get(i);
            String at = path + "[" + i + "]";
            if (source == null) {
                checks.fail(at, "REQUIRED", "A source entry is required.");
                continue;
            }
            checks.text(at + ".label", source.label(), 300, true);
            checks.url(at + ".url", source.url());
        }
    }

    private static void duration(ContentChecks checks, GameModeContent.Duration duration) {
        if (duration == null)
            return;
        checks.range("duration.minMinutes", duration.minMinutes(), 1, 600, false);
        checks.range("duration.maxMinutes", duration.maxMinutes(), 1, 600, false);
        if (duration.minMinutes() != null && duration.maxMinutes() != null
                && duration.minMinutes() > duration.maxMinutes())
            checks.fail("duration.maxMinutes", "INVALID_RANGE", "The longest time is shorter than the shortest.");
    }

    private static void availability(ContentChecks checks, GameModeContent.Availability availability) {
        if (availability == null)
            return;
        checks.oneOf("availability.status", availability.status(), AVAILABILITY, false);
        checks.text("availability.gameLabel", availability.gameLabel(), 120, false);
        checks.text("availability.note", availability.note(), 500, false);
        if (availability.startsOn() != null && availability.endsOn() != null
                && availability.endsOn().isBefore(availability.startsOn()))
            checks.fail("availability.endsOn", "INVALID_RANGE", "The end date is before the start date.");
    }

    private static void heroes(ContentChecks checks, GameModeContent content) {
        checks.size("heroes", content.heroes(), 40);
        for (int i = 0; i < content.heroes().size(); i++) {
            var hero = content.heroes().get(i);
            String at = "heroes[" + i + "]";
            if (hero == null) {
                checks.fail(at, "REQUIRED", "A hero entry is required.");
                continue;
            }
            checks.text(at + ".name", hero.name(), 120, true);
            checks.text(at + ".note", hero.note(), 500, false);
            if (hero.heroCode() != null && !ContentChecks.CODE.matcher(hero.heroCode()).matches())
                checks.fail(at + ".heroCode", "INVALID_CODE", "Use the hero's catalog code.");
        }
    }

    private static void specialItems(ContentChecks checks, GameModeContent content) {
        checks.size("specialItems", content.specialItems(), 60);
        for (int i = 0; i < content.specialItems().size(); i++) {
            var item = content.specialItems().get(i);
            String at = "specialItems[" + i + "]";
            if (item == null) {
                checks.fail(at, "REQUIRED", "An item entry is required.");
                continue;
            }
            checks.text(at + ".name", item.name(), 120, true);
            checks.text(at + ".description", item.description(), 1000, false);
        }
    }
}
