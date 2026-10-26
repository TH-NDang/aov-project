package com.wikiaov.terminology.internal.reference.application;

import com.wikiaov.patch.CatalogReadScope;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ReadModelCache;
import com.wikiaov.terminology.internal.application.ReferenceErrorCode;
import com.wikiaov.terminology.internal.application.response.ReferenceSettingsView;
import java.time.Clock;
import java.util.IllformedLocaleException;
import java.util.Locale;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class PublicReferenceCatalog {
    private final PublicReferenceCatalogLoader loader;
    private final GameplayContexts contexts;
    private final ReadModelCache cache;
    private final Clock clock;

    public PublicReferenceCatalog(PublicReferenceCatalogLoader loader, GameplayContexts contexts,
            ReadModelCache cache, Clock clock) {
        this.loader = loader;
        this.contexts = contexts;
        this.cache = cache;
        this.clock = clock;
    }

    public ReferenceSettingsView read(String region, String locale) {
        return read(region, locale, null, null, false);
    }

    public ReferenceSettingsView read(String region, String locale, UUID seasonId, UUID patchVariantId,
            boolean includeUnscoped) {
        validateLocale(locale);
        var at = clock.instant();
        var scope = CatalogReadScope.resolve(contexts, region, at, seasonId, patchVariantId, includeUnscoped);
        var gameplay = scope.gameplay();
        String key = region + ":" + locale + ":" + gameplay.rulesetId() + ":" + gameplay.patchVariantId()
                + ":unscoped=" + scope.allowUnscoped();
        return cache.read(ReadModelCache.Area.PUBLIC_REFERENCES, key, ReferenceSettingsView.class,
                () -> scope.allowUnscoped()
                        ? loader.read(gameplay, at, region, locale)
                        : loader.read(gameplay, at, region, locale, false));
    }

    private static void validateLocale(String value) {
        try {
            if (value == null || value.length() > 64)
                throw new IllformedLocaleException();
            var locale = new Locale.Builder().setLanguageTag(value).build();
            if (locale.getLanguage().isEmpty() || !locale.toLanguageTag().equals(value))
                throw new IllformedLocaleException();
        } catch (IllformedLocaleException error) {
            throw new ApiException(ReferenceErrorCode.REFERENCE_INVALID_LOCALE, "Use a canonical BCP 47 locale.");
        }
    }
}
