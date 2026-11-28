package com.wikiaov.patch;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/**
 * A published patch as one market reads it (03, Patch APIs).
 *
 * @param text the translation picked for the requested locale; its fields sit beside the others on the wire and are
 *             left out together when the patch has no translation
 * @param effectiveAt when the release starts in this market, or {@code null} for a variant read before it is dated
 * @param sources the links to the official notes of the variant, in the order editors gave them
 * @param markets when each market gets this variant, ordered like the markets; a market without a known release is
 *                left out
 */
public record PublishedPatch(
        UUID id,
        String code,
        long sequence,
        @JsonUnwrapped @Nullable Text text,
        String region,
        String requestedLocale,
        UUID variantId,
        UUID rulesetId,
        @Nullable Instant effectiveAt,
        List<PatchSource> sources,
        List<PatchMarketRelease> markets
) {

    /** The title and notes of a patch in the picked locale, and whether that locale replaced the requested one. */
    public record Text(
            String locale,
            String title,
            @Nullable String summary,
            @Nullable String description,
            String actualLocale,
            boolean fallbackApplied
    ) {
    }
}
