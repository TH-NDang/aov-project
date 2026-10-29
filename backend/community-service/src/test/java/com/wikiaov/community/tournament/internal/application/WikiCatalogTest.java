package com.wikiaov.community.tournament.internal.application;

import static org.assertj.core.api.Assertions.*;

import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;

class WikiCatalogTest {
    private static final UUID SEASON = UUID.randomUUID(), OTHER = UUID.randomUUID(), FIRST = UUID.randomUUID(),
            LATEST = UUID.randomUUID(), RULESET = UUID.randomUUID(), HERO = UUID.randomUUID(),
            REVISION = UUID.randomUUID();
    private HttpServer server;
    private WikiCatalog catalog;
    private final List<String> requested = new ArrayList<>();

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        server.createContext("/api/wiki/v1/", exchange -> {
            String path = exchange.getRequestURI().getPath();
            requested.add(exchange.getRequestURI().toString());
            String response = path.endsWith("regions")
                    ? "[{\"code\":\"VN\",\"available\":true},{\"code\":\"TH\",\"available\":false}]"
                    : path.endsWith("catalog-context")
                            ? context()
                            : path.endsWith("heroes")
                                    ? "{\"items\":[{\"id\":\"" + HERO
                                            + "\",\"code\":\"hero\",\"name\":\"Hero\",\"revisionId\":\"" + REVISION
                                            + "\"}],\"totalElements\":1}"
                                    : "{\"items\":[],\"totalElements\":0}";
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        catalog = new WikiCatalog("http://localhost:" + server.getAddress().getPort());
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    @Test
    void seasonOnlyResolvesLatestPatchAndCapturesReferenceRevision() {
        var result = catalog.read("VN", "vi-VN", SEASON, null, false);
        assertThat(result.resolvedContext().patchVariantId()).isEqualTo(LATEST);
        assertThat(result.resolvedContext().unknown()).isFalse();
        assertThat(result.heroes().getFirst().revisionId()).isEqualTo(REVISION);
        assertThat(requested).filteredOn(value -> !value.contains("catalog-context") && !value.endsWith("/regions"))
                .allMatch(value -> value.contains("seasonId=" + SEASON) && value.contains("patchVariantId=" + LATEST));
        int size = requested.size();
        catalog.read("VN", "vi-VN", SEASON, null, false);
        assertThat(requested).hasSize(size);
        catalog.read("VN", "en-US", SEASON, null, false);
        assertThat(requested.size()).isGreaterThan(size);
    }

    @Test
    void undatedObservationDoesNotInventPatchAndKnownScopeCanOptIntoUndatedEntries() {
        var result = catalog.read("VN", "vi-VN", null, null, false);
        assertThat(result.resolvedContext().unknown()).isTrue();
        assertThat(result.resolvedContext().patchVariantId()).isNull();
        assertThat(requested).allMatch(value -> !value.contains("patchVariantId"));
        requested.clear();
        catalog.read("VN", "vi-VN", SEASON, FIRST, true);
        assertThat(requested).filteredOn(value -> !value.contains("catalog-context") && !value.endsWith("/regions"))
                .allMatch(value -> value.contains("includeUnscoped=true") && value.contains("patchVariantId=" + FIRST));
    }

    @Test
    void mismatchedSeasonPatchIsRejectedBeforeReadingGameplay() {
        assertThatThrownBy(() -> catalog.read("VN", "vi-VN", OTHER, FIRST, false))
                .isInstanceOf(com.wikiaov.community.platform.ApiException.class)
                .hasMessageContaining("does not belong");
        assertThat(requested).hasSize(2);
    }

    @Test
    void unsupportedMarketKeepsManualObservationsWithoutFallingBackToVietnam() {
        var result = catalog.read("TH", "vi-VN", null, null, false);
        assertThat(result.heroes()).isEmpty();
        assertThat(result.resolvedContext().region()).isEqualTo("TH");
        assertThat(result.resolvedContext().unknown()).isTrue();
        assertThat(requested).hasSize(1);
        assertThatThrownBy(() -> catalog.read("TH", "vi-VN", SEASON, FIRST, false))
                .isInstanceOf(com.wikiaov.community.platform.ApiException.class)
                .hasMessageContaining("unavailable for this market");
    }

    private static String context() {
        return "{\"current\":{\"rulesetId\":\"" + RULESET + "\"},\"seasons\":[{\"id\":\"" + SEASON
                + "\",\"name\":\"S4 2026\",\"patches\":[" + patch(FIRST, 2) + "," + patch(LATEST, 3) + "]}]}";
    }

    private static String patch(UUID id, int ordinal) {
        return "{\"id\":\"" + id + "\",\"code\":\"patch-" + ordinal + "\",\"title\":\"Patch " + ordinal
                + "\",\"rulesetId\":\"" + RULESET + "\",\"ordinal\":" + ordinal + "}";
    }
}
