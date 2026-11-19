package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.RevisionState;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * What readers see of a published hero: the revision chosen at the moment they selected (ADR-016), the later patch it
 * may come from, and the locale its profile answers in.
 */
@Component
public class HeroReaderSelection {
    private final HeroStore store;
    private final GameplayContexts contexts;

    public HeroReaderSelection(HeroStore store, GameplayContexts contexts) {
        this.store = store;
        this.contexts = contexts;
    }

    /** The locale requested, or the fallback the profile has; a profile without any is invalid content. */
    static String profileLocale(Profile profile, String requested) {
        String selected = CatalogLocales.pick(profile.translations().stream().map(ProfileTranslation::locale).toList(),
                requested, Function.identity());
        if (selected == null) {
            throw HeroValidation.invalid("A published section has no translation.");
        }
        return selected;
    }

    /** The published revision readers see of one hero at the selected moment. */
    Optional<HeroReadMoments.Choice<HeroRevisionView>> choose(UUID heroId, HeroReadMoments.Moment moment, Instant at) {
        return choose(heroId, store.revisions(heroId), moment, at);
    }

    /** The same choice among revisions already read. */
    Optional<HeroReadMoments.Choice<HeroRevisionView>> choose(UUID heroId, List<HeroRevisionView> all,
            HeroReadMoments.Moment moment, Instant at) {
        var revisions = all.stream()
                .filter(r -> r.state() == RevisionState.PUBLISHED && r.rulesetId().equals(moment.context().rulesetId())
                        && !r.publishedAt().isAfter(at))
                .toList();

        return moment.choose(heroId, revisions, HeroRevisionView::effectiveFromPatchVariantId,
                HeroRevisionView::publicationSequence);
    }

    /** Content observed at a later patch says so, and readers are never shown it as the selected patch's data. */
    @Nullable
    Map<String, Object> laterObservation(HeroReadMoments.Choice<?> choice) {
        return choice.laterVariantId() == null
                ? null
                : Map.<String, Object>of("patchVariantId", choice.laterVariantId(), "patchCode",
                        contexts.patchCode(choice.laterVariantId()));
    }
}
