package com.wikiaov.hero.internal.application.response;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroSection;
import java.time.Instant;
import java.util.*;
public record HeroRevisionView(
        UUID id,
        UUID heroId,
        UUID rulesetId,
        long revisionNo,
        String state,
        long version,
        Long publicationSequence,
        Instant publishedAt,
        Cause cause,
        UUID sourceRevisionId,
        UUID effectiveFromPatchVariantId,
        Map<HeroSection, UUID> sections
) {
}
