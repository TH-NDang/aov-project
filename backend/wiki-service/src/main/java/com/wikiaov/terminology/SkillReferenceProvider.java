package com.wikiaov.terminology;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.platform.PageSlice;
import java.time.Instant;
import java.util.*;

/** Lazy, bounded skill references; no gameplay sections or draft data cross into public reads. */
public interface SkillReferenceProvider {
    PageSlice<Candidate> admin(UUID rulesetId, String q, UUID heroId, List<String> ids, int page, int size);

    PageSlice<Candidate> published(GameplayContext context, Instant at, String locale, String q, UUID heroId,
            List<String> ids, int page, int size);

    record Translation(
            String locale,
            String name,
            List<String> aliases,
            String description
    ) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Owner(
            UUID id,
            String kind,
            List<Translation> translations,
            UUID iconAssetId,
            String icon
    ) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Destinations(
            String admin,
            String wiki
    ) {
    }

    @JsonInclude(JsonInclude.Include.NON_NULL)
    record Candidate(
            String id,
            String kind,
            UUID heroId,
            String skillKey,
            UUID revisionId,
            Integer sourceSlot,
            Integer variantNo,
            String formKey,
            List<Translation> translations,
            UUID iconAssetId,
            String icon,
            String iconSource,
            boolean autoMatch,
            Destinations destinations,
            Owner owner
    ) {
    }
}
