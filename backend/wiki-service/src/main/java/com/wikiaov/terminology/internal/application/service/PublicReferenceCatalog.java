package com.wikiaov.terminology.internal.application.service;
import com.wikiaov.terminology.PublicReferenceProvider;
import com.wikiaov.terminology.internal.application.response.ReferenceSettingsView;
import com.wikiaov.terminology.internal.domain.ReferenceSettings;
import com.wikiaov.terminology.internal.domain.ReferenceSettings.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class PublicReferenceCatalog {
    private final ReferenceCatalog settings;
    private final List<PublicReferenceProvider> providers;
    public PublicReferenceCatalog(ReferenceCatalog settings, List<PublicReferenceProvider> providers) {
        this.settings = settings;
        this.providers = providers;
    }
    public ReferenceSettingsView read(String region, String locale) {
        var document = settings.readCatalogConfiguration();
        var config = document.settings();
        var entries = new LinkedHashMap<String, Entry>();
        for (var e : config.entities())
            if (e.kind().equals("term"))
                entries.put("term:" + e.id(), e);
        for (var provider : providers)
            for (var candidate : provider.references(region, locale)) {
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
