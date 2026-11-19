package com.wikiaov.hero.internal.application.response;

import com.wikiaov.platform.PageSlice;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

/**
 * One page of the public hero list (spec 03 section 4): the published gameplay it was read in, then the page. Items
 * keep the list's open shape, since a hero that holds forms carries them and a playable form names its holder.
 */
public record HeroListView(
        Context context,
        PageSlice<Map<String, Object>> page
) {

    /** The region, locale and published patch the list was read in. */
    public record Context(
            String region,
            String requestedLocale,
            Reference ruleset,
            Reference patch,
            UUID patchVariantId,
            Instant effectiveAt
    ) {
    }

    /** A ruleset or a patch, by id and code. */
    public record Reference(
            UUID id,
            String code
    ) {
    }
}
