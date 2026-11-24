package com.wikiaov.community.tournament.internal.catalog.infrastructure;

import com.wikiaov.community.tournament.internal.catalog.application.port.WikiCatalogSource;
import com.wikiaov.community.tournament.internal.domain.TournamentContent.Reference;
import java.net.URI;
import java.net.http.HttpClient;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import org.jspecify.annotations.Nullable;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriBuilder;

/** Reads the public catalog API of wiki-service over HTTP and maps its JSON to the port's records. */
@Component
public class WikiCatalogClient implements WikiCatalogSource {
    private static final int REFERENCE_PAGE_SIZE = 100;

    private final RestClient client;

    public WikiCatalogClient(@Value("${community.wiki-base-url}") String baseUrl) {
        var factory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build());
        factory.setReadTimeout(Duration.ofSeconds(15));
        client = RestClient.builder().baseUrl(baseUrl).requestFactory(factory).build();
    }

    @Override
    public List<Market> markets() {
        List<?> values = call(() -> client.get().uri("/api/wiki/v1/regions").retrieve().body(List.class));
        if (values == null) {
            return List.of();
        }
        return values.stream().map(WikiCatalogClient::map)
                .map(market -> new Market(string(market.get("code")), Boolean.TRUE.equals(market.get("available"))))
                .toList();
    }

    @Override
    public CatalogContext context(String region, String locale) {
        var data = read(builder -> builder.path("/api/wiki/v1/catalog-context").queryParam("region", region)
                .queryParam("locale", locale).build());
        var seasons = maps(data.get("seasons")).stream().map(season -> new Season(uuid(season.get("id")),
                string(season.get("name")),
                maps(season.get("patches")).stream().map(WikiCatalogClient::patch).toList()))
                .toList();
        return new CatalogContext(uuid(map(data.get("current")).get("rulesetId")), seasons);
    }

    @Override
    public ReferencePage references(String kind, ReferenceScope scope, int page) {
        var data = read(builder -> {
            builder.path("/api/wiki/v1/" + kind).queryParam("region", scope.region())
                    .queryParam("locale", scope.locale());
            // Players pick a hero's forms, never the hero that holds them, so games keep each form's id (ADR-024).
            if (kind.equals("heroes")) {
                builder.queryParam("playable", true);
            }
            builder.queryParam("page", page).queryParam("size", REFERENCE_PAGE_SIZE);
            if (scope.seasonId() != null) {
                builder.queryParam("seasonId", scope.seasonId());
            }
            if (scope.patchVariantId() != null) {
                builder.queryParam("patchVariantId", scope.patchVariantId());
            }
            if ((scope.seasonId() != null || scope.patchVariantId() != null) && scope.includeUnscoped()) {
                builder.queryParam("includeUnscoped", true);
            }
            return builder.build();
        });
        // The public hero list answers its rows under "page", next to the context it was read in; the other lists
        // are a bare page.
        var rows = kind.equals("heroes") ? map(data.get("page")) : data;
        var items = maps(rows.get("items")).stream().map(row -> reference(row, kind)).toList();
        return new ReferencePage(items, number(rows.get("totalElements")));
    }

    private Map<String, Object> read(Function<UriBuilder, URI> uri) {
        Map<?, ?> body = call(() -> client.get().uri(uri).retrieve().body(Map.class));
        return map(body);
    }

    private static <T> T call(Supplier<T> request) {
        try {
            return request.get();
        } catch (RestClientException failure) {
            throw new Unavailable(failure);
        }
    }

    private static Patch patch(Map<String, Object> patch) {
        return new Patch(uuid(patch.get("id")), uuid(patch.get("patchId")), string(patch.get("code")),
                string(patch.get("title")),
                uuid(patch.get("rulesetId")), number(patch.get("ordinal")));
    }

    private static Reference reference(Map<String, Object> row, String kind) {
        var content = map(row.get("content"));
        var translations = maps(content.get("translations"));
        var text = translations.isEmpty() ? Map.<String, Object>of() : translations.getFirst();
        String name = string(row.get("name"));
        if (name == null) {
            name = string(text.get("name"));
        }

        String icon = null;
        if (kind.equals("heroes")) {
            icon = url(map(row.get("head")));
        } else {
            var media = map(row.get("media"));
            String asset = string(content.get("iconAssetId"));
            if (asset != null) {
                icon = url(map(media.get(asset)));
            }
        }

        UUID revision = uuid(row.get("revisionId"));
        if (revision == null) {
            revision = uuid(map(row.get("revision")).get("id"));
        }
        return new Reference(uuid(row.get("id")), string(row.get("code")),
                name == null ? string(row.get("code")) : name, icon, integer(content.get("tier")),
                string(content.get("color")), string(content.get("branchCode")), revision);
    }

    private static @Nullable String url(Map<String, Object> asset) {
        return string(map(asset.get("currentVersion")).get("url"));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> map(@Nullable Object value) {
        return value instanceof Map<?, ?> ? (Map<String, Object>) value : Map.of();
    }

    private static List<Map<String, Object>> maps(@Nullable Object value) {
        return value instanceof List<?> list
                ? list.stream().filter(Map.class::isInstance).map(WikiCatalogClient::map).toList()
                : List.of();
    }

    private static @Nullable UUID uuid(@Nullable Object value) {
        return value instanceof String text && !text.isBlank() ? UUID.fromString(text) : null;
    }

    private static @Nullable String string(@Nullable Object value) {
        return value instanceof String text ? text : null;
    }

    private static long number(@Nullable Object value) {
        return value instanceof Number number ? number.longValue() : 0;
    }

    private static @Nullable Integer integer(@Nullable Object value) {
        return value instanceof Number number ? number.intValue() : null;
    }
}
