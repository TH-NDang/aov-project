package com.wikiaov.terminology.internal.reference.application;

import com.wikiaov.patch.CatalogReadScope;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.RulesetReference;
import com.wikiaov.platform.*;
import com.wikiaov.terminology.SkillReferenceProvider;
import com.wikiaov.terminology.internal.application.ReferenceErrorCode;
import com.wikiaov.terminology.internal.application.response.SkillReferencePageView;
import java.time.Clock;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;

/** Redis is outside the hero module's short, consistent read transaction. */
@Service
public class SkillReferenceCatalog {
    private final SkillReferenceProvider skills;
    private final GameplayContexts contexts;
    private final ReadModelCache cache;
    private final Clock clock;

    public SkillReferenceCatalog(SkillReferenceProvider skills, GameplayContexts contexts, ReadModelCache cache,
            Clock clock) {
        this.skills = skills;
        this.contexts = contexts;
        this.cache = cache;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public PageSlice<SkillReferenceProvider.Candidate> admin(UUID requestedRuleset, String locale, String q,
            UUID heroId,
            String ids, int page, Integer size) {
        var input = input(locale, q, ids, page, size);
        UUID selected;
        if (requestedRuleset != null) {
            contexts.requireRuleset(requestedRuleset);
            selected = requestedRuleset;
        } else {
            var rulesets = contexts.rulesets();
            selected = rulesets.stream().filter(r -> r.code().equals("aov-standard")).findFirst()
                    .or(() -> rulesets.stream().findFirst()).map(RulesetReference::id).orElse(null);
        }
        if (selected == null)
            return new PageSlice<>(List.of(), page, input.size(), 0);
        String key = "skills:v1:" + selected + ":" + heroId + ":" + input.key();
        return cache.read(ReadModelCache.Area.ADMIN_REFERENCES, key, SkillReferencePageView.class,
                () -> new SkillReferencePageView(
                        skills.admin(selected, input.q(), heroId, input.ids(), page, input.size())))
                .slice();
    }

    public PageSlice<SkillReferenceProvider.Candidate> published(String region, String locale, String q, UUID heroId,
            String ids, int page, Integer size) {
        return published(region, locale, q, heroId, ids, page, size, null, null, false);
    }

    public PageSlice<SkillReferenceProvider.Candidate> published(String region, String locale, String q, UUID heroId,
            String ids, int page, Integer size, UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        var input = input(locale, q, ids, page, size);
        var at = clock.instant();
        var scope = CatalogReadScope.resolve(contexts, region, at, seasonId, patchVariantId, includeUnscoped);
        var gameplay = scope.gameplay();
        String key = "skills:v1:" + gameplay.regionId() + ":" + gameplay.rulesetId() + ":" + gameplay.patchVariantId()
                + ":" + heroId + ":unscoped=" + scope.allowUnscoped() + ":" + input.key();
        return cache.read(ReadModelCache.Area.PUBLIC_REFERENCES, key, SkillReferencePageView.class,
                () -> new SkillReferencePageView(scope.allowUnscoped()
                        ? skills.published(gameplay, at, locale, input.q(), heroId, input.ids(), page, input.size())
                        : skills.published(gameplay, at, locale, input.q(), heroId, input.ids(), page, input.size(),
                                false)))
                .slice();
    }

    private record Input(
            String locale,
            String q,
            List<String> ids,
            int page,
            int size
    ) {
        String key() {
            return locale + ":" + page + ":" + size + ":" + ids + ":" + q;
        }
    }

    private static Input input(String locale, String query, String identifiers, int page, Integer requestedSize) {
        try {
            if (locale == null || locale.length() > 64)
                throw new IllformedLocaleException();
            var parsed = new Locale.Builder().setLanguageTag(locale).build();
            if (parsed.getLanguage().isEmpty() || !parsed.toLanguageTag().equals(locale))
                throw new IllformedLocaleException();
        } catch (IllformedLocaleException e) {
            throw new ApiException(ReferenceErrorCode.REFERENCE_INVALID_LOCALE, "Use a canonical BCP 47 locale.");
        }
        String q = query == null ? "" : query.strip().replaceAll("\\s+", " ");
        if (q.length() > 120)
            throw invalid("Search text must not exceed 120 characters.");
        var ids = new TreeSet<String>();
        if (identifiers != null) {
            var values = identifiers.split(",", -1);
            if (values.length > 50 || values.length == 0)
                throw invalid("Resolve at most 50 skill reference identifiers.");
            for (var value : values) {
                int dot = value.indexOf('.');
                if (dot != 36 || value.length() > 101 || !value.substring(dot + 1).matches("[a-z0-9]+(?:-[a-z0-9]+)*"))
                    throw invalid("Use hero UUID and skill key separated by a dot.");
                try {
                    var owner = UUID.fromString(value.substring(0, dot));
                    if (!owner.toString().equals(value.substring(0, dot)))
                        throw new IllegalArgumentException();
                } catch (IllegalArgumentException e) {
                    throw invalid("Use a canonical hero UUID in skill reference identifiers.");
                }
                ids.add(value);
            }
            if (!q.isEmpty())
                throw invalid("Search text and explicit identifiers cannot be combined.");
        }
        int size = requestedSize == null ? (ids.isEmpty() ? 20 : 50) : requestedSize;
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE)
            throw invalid("Use a non-negative page and a size between 1 and 100.");
        return new Input(locale, q, List.copyOf(ids), page, size);
    }

    private static ApiException invalid(String detail) {
        return new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, detail);
    }
}
