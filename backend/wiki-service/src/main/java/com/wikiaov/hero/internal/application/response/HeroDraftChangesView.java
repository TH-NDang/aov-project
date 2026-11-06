package com.wikiaov.hero.internal.application.response;

import com.wikiaov.hero.internal.domain.HeroSection;
import java.time.Instant;
import java.util.Map;
import org.jspecify.annotations.Nullable;

/**
 * What a draft has changed so far. Compared with the revision it came from, or with its own first content when it
 * started on its own, in which case {@code source} is null.
 */
public record HeroDraftChangesView(
        @Nullable HeroRevisionView source,
        Instant startedAt,
        Map<HeroSection, Object> before,
        Map<HeroSection, Object> after
) {
}
