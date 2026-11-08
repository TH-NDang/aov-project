package com.wikiaov.gamemode.internal.domain;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Editorial content of one game mode revision, stored as JSON. Text is Vietnamese only for now.
 *
 * @param group        {@code PVP} or {@code ENTERTAINMENT}
 * @param order        display order inside the group, as in the game's mode menu
 * @param playersLabel team format as shown to readers, e.g. {@code 5v5} or eight players
 * @param guideKind    {@code NONE} or {@code AUTO_CHESS}; a detailed guide exists only for the matching kind
 */
public record GameModeContent(
        String name,
        String group,
        Integer order,
        String summary,
        String playersLabel,
        Duration duration,
        Availability availability,
        UUID artAssetId,
        String guideKind,
        List<RuleSection> rules,
        List<ModeHero> heroes,
        List<SpecialItem> specialItems,
        List<Source> sources
) {

    public GameModeContent {
        rules = rules == null ? List.of() : List.copyOf(rules);
        heroes = heroes == null ? List.of() : List.copyOf(heroes);
        specialItems = specialItems == null ? List.of() : List.copyOf(specialItems);
        sources = sources == null ? List.of() : List.copyOf(sources);
        guideKind = guideKind == null ? "NONE" : guideKind;
    }

    /** The initial content of a new mode: only what the editor typed when creating it. */
    public static GameModeContent initial(String name, String group) {
        return new GameModeContent(name, group, null, null, null, null,
                new Availability("UNKNOWN", null, null, null, null, null), null, "NONE", List.of(), List.of(),
                List.of(), List.of());
    }

    /** Typical match length in minutes. */
    public record Duration(
            Integer minMinutes,
            Integer maxMinutes
    ) {
    }

    /**
     * Whether the game offers the mode, as observed. {@code gameLabel} is the text shown in the game; dates are only
     * stored when known and are never derived from a relative label such as "open for 14 hours".
     */
    public record Availability(
            String status,
            String gameLabel,
            LocalDate startsOn,
            LocalDate endsOn,
            LocalDate observedOn,
            String note
    ) {
    }

    /** A rule paragraph. Lines starting with "- " are rendered as bullet points. */
    public record RuleSection(
            String group,
            String title,
            String body
    ) {
    }

    /** A hero that matters for this mode; {@code heroCode} links to the hero catalog when set. */
    public record ModeHero(
            String heroCode,
            String name,
            String note
    ) {
    }

    /** An item that exists only in this mode. */
    public record SpecialItem(
            String name,
            String description,
            UUID iconAssetId
    ) {
    }

    /** Where the information was observed. */
    public record Source(
            String label,
            String url,
            LocalDate observedOn
    ) {
    }
}
