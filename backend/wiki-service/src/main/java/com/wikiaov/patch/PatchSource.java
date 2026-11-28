package com.wikiaov.patch;

import org.jspecify.annotations.Nullable;

/**
 * A link to the official notes of a patch, shared by every change recorded from them (ADR-016, 2026-11-27).
 *
 * @param label what the page is, such as its language or market, as editors wrote it
 * @param locale the language of the page as a BCP 47 tag, when editors gave one
 * @param region the code of the market that published the page, when editors gave one
 */
public record PatchSource(
        String url,
        String label,
        @Nullable String locale,
        @Nullable String region
) {
}
