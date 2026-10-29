package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import java.net.http.HttpClient;
import java.time.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class WikiCatalog {
    private record Key(
            String region,
            String locale,
            UUID season,
            UUID patch,
            boolean unscoped
    ) {
    }

    private record Cached(
            Catalog catalog,
            Instant expiresAt
    ) {
    }

    private final RestClient client;
    private final Map<Key, Cached> cache = new ConcurrentHashMap<>();

    public WikiCatalog(@Value("${community.wiki-base-url}") String baseUrl) {
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(15));
        client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    public Catalog read(String region, String locale, UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        if (region == null || !region.matches("[A-Z]{2,16}") || !Set.of("vi-VN", "en-US").contains(locale))
            throw TournamentErrors.invalid("Choose a valid region and supported locale.");
        var key = new Key(region, locale, seasonId, patchVariantId, includeUnscoped);
        var cached = cache.get(key);
        if (cached != null && cached.expiresAt().isAfter(Instant.now()))
            return cached.catalog();

        try {
            if (!marketAvailable(region)) {
                if (seasonId != null || patchVariantId != null)
                    throw TournamentErrors.invalid(
                            "Historical wiki data is unavailable for this market. Record observed names without a linked patch.");
                var unknown = new ResolvedContext(region, locale, null, null, null, null, null, null, true,
                        includeUnscoped);
                var empty = new Catalog(List.of(), List.of(), List.of(), List.of(), List.of(), unknown);
                cache.put(key, new Cached(empty, Instant.now().plusSeconds(60)));
                return empty;
            }
            var context = context(key);
            var resolved = new Key(region, locale, context.seasonId(), context.patchVariantId(), includeUnscoped);
            var value = new Catalog(references("heroes", resolved), references("items", resolved),
                    references("arcana", resolved), references("enchantments", resolved),
                    references("spells", resolved), context);
            if (cache.size() > 128)
                cache.clear();
            cache.put(key, new Cached(value, Instant.now().plusSeconds(60)));
            return value;
        } catch (RestClientException error) {
            throw new ApiException(TournamentErrorCode.TOURNAMENT_WIKI_UNAVAILABLE,
                    "The published wiki catalog is unavailable. Retry before publishing.");
        }
    }

    private boolean marketAvailable(String region) {
        var values = client.get().uri("/api/wiki/v1/regions").retrieve().body(List.class);
        if (values != null)
            for (var value : values) {
                var market = map(value);
                if (region.equals(market.get("code")))
                    return Boolean.TRUE.equals(market.get("available"));
            }
        throw TournamentErrors.invalid("Choose a known game market.");
    }

    private ResolvedContext context(Key key) {
        var data = readMap("catalog-context", key, 0, false);
        var current = map(data.get("current"));
        Map<String, Object> selectedSeason = Map.of(), selectedPatch = Map.of();
        for (var season : maps(data.get("seasons"))) {
            for (var patch : maps(season.get("patches"))) {
                boolean selected = key.patch() != null
                        ? key.patch().toString().equals(patch.get("id"))
                        : key.season() != null ? key.season().toString().equals(season.get("id")) : false;
                if (selected && (selectedPatch.isEmpty()
                        || number(patch.get("ordinal")) > number(selectedPatch.get("ordinal")))) {
                    selectedSeason = season;
                    selectedPatch = patch;
                }
            }
        }
        if ((key.season() != null || key.patch() != null) && selectedPatch.isEmpty())
            throw TournamentErrors.invalid("The selected season or patch is unavailable in this market.");
        if (key.season() != null && !key.season().toString().equals(selectedSeason.get("id")))
            throw TournamentErrors.invalid("The selected patch does not belong to this season.");
        return new ResolvedContext(key.region(), key.locale(),
                uuid(selectedPatch.getOrDefault("rulesetId", current.get("rulesetId"))), uuid(selectedSeason.get("id")),
                string(selectedSeason.get("name")), uuid(selectedPatch.get("id")), string(selectedPatch.get("code")),
                string(selectedPatch.get("title")), selectedPatch.isEmpty(), key.unscoped());
    }

    private List<Reference> references(String kind, Key key) {
        var result = new ArrayList<Reference>();
        for (int page = 0; page < 100; page++) {
            var data = readMap(kind, key, page, true);
            var entries = maps(data.get("items"));
            for (var row : entries)
                result.add(reference(row, kind));
            long total = number(data.get("totalElements"));
            if (entries.isEmpty() || result.size() >= total)
                return List.copyOf(result);
        }
        throw new ApiException(TournamentErrorCode.TOURNAMENT_CATALOG_LIMIT,
                "The wiki catalog exceeds the supported reference limit.");
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readMap(String path, Key key, int page, boolean historical) {
        return client.get().uri(builder -> {
            builder.path("/api/wiki/v1/" + path).queryParam("region", key.region()).queryParam("locale", key.locale());
            if (historical) {
                builder.queryParam("page", page).queryParam("size", 100);
                if (key.season() != null)
                    builder.queryParam("seasonId", key.season());
                if (key.patch() != null)
                    builder.queryParam("patchVariantId", key.patch());
                if ((key.season() != null || key.patch() != null) && key.unscoped())
                    builder.queryParam("includeUnscoped", true);
            }
            return builder.build();
        }).retrieve().body(Map.class);
    }

    private Reference reference(Map<String, Object> row, String kind) {
        var content = map(row.get("content"));
        var translations = maps(content.get("translations"));
        var text = translations.isEmpty() ? Map.<String, Object>of() : translations.getFirst();
        String name = string(row.get("name"));
        if (name == null)
            name = string(text.get("name"));
        String icon = null;
        if (kind.equals("heroes"))
            icon = url(map(row.get("head")));
        else {
            var media = map(row.get("media"));
            String asset = string(content.get("iconAssetId"));
            if (asset != null)
                icon = url(map(media.get(asset)));
        }
        UUID revision = uuid(row.get("revisionId"));
        if (revision == null)
            revision = uuid(map(row.get("revision")).get("id"));
        return new Reference(uuid(row.get("id")), string(row.get("code")),
                name == null ? string(row.get("code")) : name, icon, integer(content.get("tier")),
                string(content.get("color")), string(content.get("branchCode")), revision);
    }

    private static String url(Map<String, Object> asset) {
        return string(map(asset.get("currentVersion")).get("url"));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(Object value) {
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
    }

    private static List<Map<String, Object>> maps(Object value) {
        return value instanceof List<?> list
                ? list.stream().filter(Map.class::isInstance).map(WikiCatalog::map).toList()
                : List.of();
    }

    private static UUID uuid(Object value) {
        return value instanceof String text && !text.isBlank() ? UUID.fromString(text) : null;
    }

    private static String string(Object value) {
        return value instanceof String text ? text : null;
    }

    private static long number(Object value) {
        return value instanceof Number number ? number.longValue() : 0;
    }

    private static Integer integer(Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }
}
