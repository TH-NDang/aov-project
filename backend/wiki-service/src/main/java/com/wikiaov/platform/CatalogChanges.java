package com.wikiaov.platform;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * Shared vocabulary and the pure checks of a change record (ADR-031); each catalog owns its change records,
 * persistence and errors.
 */
public final class CatalogChanges {
    private static final int MAX_KINDS = 4;
    private static final int MAX_SUMMARIES = 50;
    private static final int MAX_SUMMARY_LENGTH = 4000;
    private static final int MAX_SOURCE_LENGTH = 2048;

    private CatalogChanges() {
    }

    public enum Kind {
        DATA_BASELINE,
        ADDED,
        UPDATED,
        REMOVED,
        BUFF,
        NERF,
        BALANCE,
        REWORK,
        FIX
    }

    public record Summary(
            String locale,
            String text
    ) {
    }

    public record Record(
            UUID patchVariantId,
            UUID toRevisionId,
            UUID fromRevisionId,
            List<Kind> kinds,
            List<Summary> translations,
            String sourceUrl
    ) {
    }

    public record Entry(
            UUID id,
            String domain,
            UUID ownerId,
            String code,
            String name,
            UUID iconAssetId,
            UUID rulesetId,
            UUID patchVariantId,
            UUID fromRevisionId,
            UUID toRevisionId,
            List<Kind> kinds,
            String summary,
            String actualLocale,
            String sourceUrl,
            boolean confirmed,
            Instant recordedAt
    ) {
    }

    /** The summary a reader of {@code locale} sees, following the catalog fallback order, or null when none exists. */
    public static @Nullable Summary summary(List<Summary> copy, String locale) {
        return CatalogLocales.pick(copy, locale, Summary::locale);
    }

    /**
     * The rule a change record breaks before any stored data is read, or {@code null}: it names a patch and a target
     * and one to four distinct kinds. The catalog answers a broken rule with its own invalid-content error.
     */
    public static @Nullable String requestProblem(Record input) {
        if (input.patchVariantId() == null || input.toRevisionId() == null || input.kinds() == null
                || input.kinds().isEmpty() || input.kinds().size() > MAX_KINDS
                || input.kinds().stream().anyMatch(Objects::isNull)
                || new HashSet<>(input.kinds()).size() != input.kinds().size()) {
            return "A patch, published target and unique change kinds are required.";
        }
        return null;
    }

    /**
     * The rule the kinds of a change record break for a target snapshot of {@code targetCause}, or {@code null}: a
     * baseline or an addition stands alone, only a baseline snapshot is a baseline, and an update needs a gameplay
     * snapshot and the snapshot before it. {@code removed} says whether the record removes the entry.
     */
    public static @Nullable String kindsProblem(Record input, CatalogCause targetCause, boolean removed) {
        var kinds = input.kinds();
        if (kinds.contains(Kind.DATA_BASELINE) && kinds.size() != 1
                || kinds.contains(Kind.ADDED) && kinds.size() != 1) {
            return "Baseline and addition must be recorded separately from balance changes.";
        }
        if (kinds.contains(Kind.DATA_BASELINE) && targetCause != CatalogCause.DATA_BASELINE) {
            return "Only baseline snapshots can be classified as baseline.";
        }
        if (!removed && !kinds.contains(Kind.ADDED) && !kinds.contains(Kind.DATA_BASELINE)
                && (targetCause != CatalogCause.GAME_PATCH || input.fromRevisionId() == null)) {
            return "Updates require a gameplay snapshot and a known previous snapshot.";
        }
        return null;
    }

    /**
     * The rule the evidence of a change record breaks, or {@code null}: one summary per locale, each a short text, and
     * the http(s) source the change was read from.
     */
    public static @Nullable String evidenceProblem(Record input) {
        var copy = input.translations() == null ? List.<Summary>of() : input.translations();
        if (copy.isEmpty() || copy.size() > MAX_SUMMARIES) {
            return "A localized change summary is required.";
        }

        Set<String> locales = new HashSet<>();
        for (var text : copy) {
            if (text == null || text.locale() == null || !text.locale().matches(CatalogLocales.PATTERN)
                    || !locales.add(text.locale()) || text.text() == null || text.text().isBlank()
                    || text.text().length() > MAX_SUMMARY_LENGTH) {
                return "Invalid or duplicate summary translations.";
            }
        }
        if (input.sourceUrl() == null || input.sourceUrl().length() > MAX_SOURCE_LENGTH
                || !input.sourceUrl().matches("https?://[^\\s]+")) {
            return "An HTTP source URL is required for confirmed game changes.";
        }
        return null;
    }
}
