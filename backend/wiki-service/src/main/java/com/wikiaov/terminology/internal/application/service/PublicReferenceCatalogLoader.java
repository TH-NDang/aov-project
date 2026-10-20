package com.wikiaov.terminology.internal.application.service;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.terminology.PublicReferenceProvider;
import com.wikiaov.terminology.internal.application.response.ReferenceSettingsView;
import com.wikiaov.terminology.internal.domain.ReferenceSettings;
import com.wikiaov.terminology.internal.domain.ReferenceSettings.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

/** Build all catalog modules from one database snapshot, before any Redis write. */
@Service
public class PublicReferenceCatalogLoader {
    private final ReferenceCatalog settings;
    private final List<PublicReferenceProvider> providers;
    private final GameplayContexts contexts;

    public PublicReferenceCatalogLoader(ReferenceCatalog settings, List<PublicReferenceProvider> providers,
            GameplayContexts contexts) {
        this.settings = settings;
        this.providers = providers;
        this.contexts = contexts;
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public ReferenceSettingsView read(GameplayContext gameplay, Instant at, String region, String locale) {
        var ordinals = contexts.rulesetVariants(gameplay.rulesetId()).stream()
                .collect(Collectors.toMap(v -> v.id(), v -> v.rulesetOrdinal()));
        var scope = new PublicReferenceProvider.Scope(gameplay, ordinals, at);
        var document = settings.readCatalogConfiguration();
        var config = document.settings();
        var entries = new LinkedHashMap<String, Entry>();
        for (var e : config.entities())
            if (e.kind().equals("term"))
                entries.put("term:" + e.id(), e);
        for (var provider : providers)
            for (var candidate : provider.references(scope, locale)) {
                String id = candidate.id().toString();
                entries.put(candidate.kind() + ":" + id, new Entry(id, candidate.kind(),
                        List.of(new Translation(candidate.locale(), candidate.name(), List.of(),
                                candidate.description())),
                        candidate.icon(), candidate.kind().equals("hero") || candidate.kind().equals("term"), null,
                        destination(candidate.kind(), id, region, locale)));
            }
        for (var custom : config.entities()) {
            String key = custom.kind() + ":" + custom.id();
            var original = entries.get(key);
            if (original == null || custom.kind().equals("term"))
                continue;
            var copies = new LinkedHashMap<String, Translation>();
            original.translations().forEach(t -> copies.put(t.locale().toLowerCase(Locale.ROOT), t));
            custom.translations().forEach(t -> copies.put(t.locale().toLowerCase(Locale.ROOT), t));
            entries.put(key, new Entry(custom.id(), custom.kind(), List.copyOf(copies.values()),
                    custom.icon() == null ? original.icon() : custom.icon(),
                    custom.autoMatch() == null ? original.autoMatch() : custom.autoMatch(), custom.display(),
                    custom.destinations() != null && custom.destinations().wiki() != null
                            ? custom.destinations()
                            : original.destinations()));
        }
        return new ReferenceSettingsView(document.version(), new ReferenceSettings(1, config.autoRecognize(),
                config.fallbackLocale(), List.copyOf(entries.values())));
    }

    private Destinations destination(String kind, String id, String region, String locale) {
        return new Destinations(null, "/?" + kind + "=" + id + "&region="
                + URLEncoder.encode(region, StandardCharsets.UTF_8) + "&locale="
                + URLEncoder.encode(locale, StandardCharsets.UTF_8));
    }
}
