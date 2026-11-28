package com.wikiaov.community.community.internal.translation.infrastructure;

import com.wikiaov.community.community.internal.translation.application.TranslationSettings;
import com.wikiaov.community.community.internal.translation.application.port.GlossarySource;
import com.wikiaov.community.community.internal.translation.domain.Glossary;
import java.net.http.HttpClient;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Reads the public reference catalog of wiki-service once per language and keeps it for a while, checking it again
 * with its ETag. That catalog is the terminology editors keep in Admin plus the names of heroes, items, spells, arcana
 * and enchantments. Heroes are not translated: their names only tell the language check what to skip.
 */
@Component
class WikiGlossaryClient implements GlossarySource {
    private static final Logger log = LoggerFactory.getLogger(WikiGlossaryClient.class);
    private static final Set<String> KINDS = Set.of("term", "item", "spell", "arcana", "enchantment");
    /** How soon a language that could not be read is tried again. */
    private static final Duration RETRY = Duration.ofMinutes(1);

    private final RestClient client;
    private final TranslationSettings settings;
    private final Clock clock = Clock.systemUTC();
    private final Map<String, Snapshot> snapshots = new HashMap<>();
    private Glossary glossary = Glossary.empty();

    WikiGlossaryClient(@Value("${community.wiki-base-url}") String baseUrl, TranslationSettings settings) {
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(15));
        this.client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
        this.settings = settings;
    }

    @Override
    public synchronized Glossary glossary() {
        Instant now = clock.instant();
        boolean changed = false;
        for (String locale : settings.glossaryLocales()) {
            var snapshot = snapshots.get(locale);
            if (snapshot != null && now.isBefore(snapshot.checkAgainAt())) {
                continue;
            }
            changed |= refresh(locale, snapshot, now);
        }
        if (changed) {
            glossary = build(snapshots.values().stream().map(Snapshot::entities).toList());
            log.info("Translation glossary has {} entries", glossary.size());
        }
        return glossary;
    }

    private boolean refresh(String locale, @Nullable Snapshot snapshot, Instant now) {
        try {
            var request = client.get().uri(builder -> builder.path("/api/wiki/v1/reference-catalog")
                    .queryParam("region", settings.region()).queryParam("locale", locale).build());
            if (snapshot != null && snapshot.etag() != null) {
                request = request.header("If-None-Match", snapshot.etag());
            }
            var response = request.retrieve().toEntity(Map.class);
            if (response.getStatusCode().isSameCodeAs(HttpStatus.NOT_MODIFIED) && snapshot != null) {
                snapshots.put(locale, new Snapshot(snapshot.etag(), snapshot.entities(),
                        now.plus(settings.glossaryTtl())));
                return false;
            }
            var settingsNode = map(map(response.getBody()).get("settings"));
            var entities = maps(settingsNode.get("entities"));
            snapshots.put(locale, new Snapshot(response.getHeaders().getETag(), entities,
                    now.plus(settings.glossaryTtl())));
            return true;
        } catch (RestClientException | IllegalArgumentException failure) {
            log.warn("Could not read the {} reference catalog of wiki-service for translation: {}", locale,
                    failure.getClass().getSimpleName());
            snapshots.put(locale, snapshot == null
                    ? new Snapshot(null, List.of(), now.plus(RETRY))
                    : new Snapshot(snapshot.etag(), snapshot.entities(), now.plus(RETRY)));
            return false;
        }
    }

    /** One entry per kind and id, with the names every language's catalog gave it. */
    static Glossary build(List<List<Map<String, Object>>> catalogs) {
        var names = new LinkedHashMap<String, Map<String, Glossary.Names>>();
        var kinds = new HashMap<String, String>();
        var kept = new HashSet<String>();
        for (var entities : catalogs) {
            for (var entity : entities) {
                String kind = string(entity.get("kind"));
                String id = string(entity.get("id"));
                if (kind == null || id == null) {
                    continue;
                }
                for (var translation : maps(entity.get("translations"))) {
                    String locale = string(translation.get("locale"));
                    String name = string(translation.get("name"));
                    if (locale == null || name == null || name.isBlank()) {
                        continue;
                    }
                    if (kind.equals("hero")) {
                        kept.add(name);
                        continue;
                    }
                    if (!KINDS.contains(kind)) {
                        continue;
                    }
                    var aliases = new ArrayList<String>();
                    if (translation.get("aliases") instanceof List<?> listed) {
                        listed.stream().filter(String.class::isInstance).map(String.class::cast).forEach(aliases::add);
                    }
                    String key = kind + ":" + id;
                    kinds.put(key, kind);
                    names.computeIfAbsent(key, ignored -> new LinkedHashMap<>())
                            .put(locale, new Glossary.Names(name, aliases));
                }
            }
        }
        var terms = names.entrySet().stream()
                .map(entry -> new Glossary.Term(entry.getKey(), kinds.get(entry.getKey()), entry.getValue()))
                .toList();
        return Glossary.of(terms, kept);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(@Nullable Object value) {
        if (value instanceof Map<?, ?> found) {
            return (Map<String, Object>) found;
        }
        throw new IllegalArgumentException("Expected a JSON object.");
    }

    private static List<Map<String, Object>> maps(@Nullable Object value) {
        if (!(value instanceof List<?> values)) {
            return List.of();
        }
        return values.stream().filter(Map.class::isInstance).map(WikiGlossaryClient::map).toList();
    }

    private static @Nullable String string(@Nullable Object value) {
        return value instanceof String text ? text : null;
    }

    private record Snapshot(
            @Nullable String etag,
            List<Map<String, Object>> entities,
            Instant checkAgainAt
    ) {
    }
}
