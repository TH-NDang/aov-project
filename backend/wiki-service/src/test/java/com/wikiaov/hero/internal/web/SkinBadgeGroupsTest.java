package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.media.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@EnabledIf("databaseAvailable")
class SkinBadgeGroupsTest {
    private static final String ROOT = "/api/wiki/v1/admin";
    private static final String GROUPS = ROOT + "/skin-badge-groups";
    private static final String BADGES = ROOT + "/skin-badges";
    private static PostgreSQLContainer database;

    static boolean databaseAvailable() {
        return System.getenv("WIKI_TEST_DB_URL") != null || DockerClientFactory.instance().isDockerAvailable();
    }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        String external = System.getenv("WIKI_TEST_DB_URL");
        if (external != null) {
            properties.add("spring.datasource.url", () -> external);
            properties.add("spring.datasource.username", () -> "wiki_test");
            properties.add("spring.datasource.password", () -> "");
        } else {
            database = new PostgreSQLContainer("postgres:17.6");
            database.start();
            properties.add("spring.datasource.url", database::getJdbcUrl);
            properties.add("spring.datasource.username", database::getUsername);
            properties.add("spring.datasource.password", database::getPassword);
        }
    }

    @AfterAll
    static void stop() {
        if (database != null)
            database.stop();
    }

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @Autowired
    JdbcClient jdbc;
    @MockitoBean
    MediaAssets media;

    @BeforeEach
    void setup() {
        jdbc.sql("TRUNCATE hero.skin_badge CASCADE").update();
        jdbc.sql("TRUNCATE hero.skin_badge_group CASCADE").update();
        when(media.find(any(UUID.class))).thenAnswer(invocation -> {
            UUID id = invocation.getArgument(0);
            return Optional.of(new MediaAssetReference(id, MediaSemanticType.SKIN_BADGE, MediaAssetState.ACTIVE,
                    new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/png", 64, 32,
                            "/media/" + id + "/icon.png")));
        });
    }

    @Test
    void groupsKeepLocalizedNamesAndGuardConcurrentUpdatesAndDuplicateCodes() throws Exception {
        var group = group("rank-ss", "RANK", List.of(text("vi-VN", "Bậc SS"), text("en-US", "SS rank")));
        var english = findGroup(group.get("id"), "en-US");
        assertThat(english).containsEntry("displayName", "SS rank").containsEntry("actualLocale", "en-US")
                .containsEntry("fallbackApplied", false);
        var fallback = findGroup(group.get("id"), "th-TH");
        assertThat(fallback).containsEntry("displayName", "Bậc SS").containsEntry("actualLocale", "vi-VN")
                .containsEntry("fallbackApplied", true);
        var translations = List.of(text("vi-VN", "Nhóm SS"), text("en-US", "SS rank"));
        var updated = send(put(GROUPS + "/" + group.get("id")),
                Map.of("expectedVersion", group.get("version"), "kind", "THEME", "translations", translations), 200);
        assertThat(updated).containsEntry("code", "rank-ss").containsEntry("kind", "THEME");
        assertThat(number(updated, "version")).isEqualTo(number(group, "version") + 1);
        assertThat(rows(updated.get("translations"))).hasSize(2);
        send(put(GROUPS + "/" + group.get("id")),
                Map.of("expectedVersion", group.get("version"), "kind", "RANK", "translations", translations), 409);
        send(post(GROUPS), Map.of("code", "rank-ss", "kind", "THEME", "translations", List.of()), 409);
    }

    @Test
    void pagingReturnsCompleteGroupsAndSearchCanMatchGroupOrChildTranslations() throws Exception {
        var lunar = group("lunar", "THEME", List.of(text("vi-VN", "Tân xuân")));
        var rank = group("rank-ss", "RANK", List.of(text("vi-VN", "Bậc SS")));
        badge("lunar-one", lunar.get("id"), "Hoa đào", UUID.randomUUID());
        badge("lunar-two", lunar.get("id"), "Mai vàng", UUID.randomUUID());
        badge("ss-limited", rank.get("id"), "Bậc giới hạn", UUID.randomUUID());
        badge("unassigned", null, "Chưa có nhóm", UUID.randomUUID());

        var first = send(get(GROUPS).param("size", "1"), null, 200);
        assertThat(number(first, "totalElements")).isEqualTo(3);
        var firstGroup = rows(first.get("items")).getFirst();
        assertThat(firstGroup).containsEntry("id", lunar.get("id"));
        assertThat(number(firstGroup, "badgeCount")).isEqualTo(2);
        var second = send(get(GROUPS).param("size", "1").param("page", "1"), null, 200);
        assertThat(rows(second.get("items")).getFirst()).containsEntry("id", rank.get("id"));
        var unassigned = send(get(GROUPS).param("size", "1").param("page", "2"), null, 200);
        assertThat(rows(unassigned.get("items")).getFirst()).containsEntry("id", null)
                .containsEntry("code", "__ungrouped");

        var byGroup = rows(send(get(GROUPS).param("q", "Tân xuân"), null, 200).get("items")).getFirst();
        assertThat(byGroup).containsEntry("matchedByGroup", true);
        assertThat(number(byGroup, "badgeCount")).isEqualTo(2);
        var byChild = rows(send(get(GROUPS).param("q", "Hoa đào"), null, 200).get("items")).getFirst();
        assertThat(byChild).containsEntry("id", lunar.get("id")).containsEntry("matchedByGroup", false);
        assertThat(number(byChild, "badgeCount")).isEqualTo(1);
        var children = send(get(BADGES).param("groupId", lunar.get("id").toString()).param("q", "Hoa đào"), null,
                200);
        assertThat(number(children, "totalElements")).isEqualTo(1);
        assertThat(rows(children.get("items")).getFirst()).containsEntry("code", "lunar-one");
    }

    @Test
    void movingBadgePreservesEveryTranslationIconAndKindAndOldMetadataUpdatesKeepGroup() throws Exception {
        var first = group("rank-s", "RANK", List.of(text("vi-VN", "S")));
        var target = group("summer", "THEME", List.of(text("vi-VN", "Mùa hè")));
        UUID vietnameseIcon = UUID.randomUUID();
        UUID englishIcon = UUID.randomUUID();
        var translations = List.of(iconText("vi-VN", "Nhãn Việt", vietnameseIcon),
                iconText("en-US", "English label", englishIcon));
        var badge = send(post(BADGES), Map.of("code", "limited", "kind", "UNKNOWN", "groupId", first.get("id"),
                "translations", translations), 201);
        var moved = send(put(BADGES + "/" + badge.get("id") + "/group"),
                Map.of("expectedVersion", badge.get("version"), "groupId", target.get("id")), 200);
        assertThat(moved).containsEntry("groupId", target.get("id")).containsEntry("kind", "UNKNOWN")
                .containsEntry("translations", badge.get("translations"));
        assertThat(number(moved, "version")).isEqualTo(number(badge, "version") + 1);
        send(put(BADGES + "/" + badge.get("id") + "/group"),
                Map.of("expectedVersion", badge.get("version"), "groupId", first.get("id")), 409);
        var metadata = send(put(BADGES + "/" + badge.get("id")), Map.of("expectedVersion", moved.get("version"),
                "kind", "EVENT", "translations", translations), 200);
        assertThat(metadata).containsEntry("groupId", target.get("id")).containsEntry("kind", "EVENT")
                .containsEntry("translations", badge.get("translations"));
        assertThat(number(findGroup(first.get("id"), "vi-VN"), "badgeCount")).isZero();
        assertThat(number(findGroup(target.get("id"), "vi-VN"), "badgeCount")).isEqualTo(1);
        var remove = new HashMap<String, Object>();
        remove.put("expectedVersion", metadata.get("version"));
        remove.put("groupId", null);
        var unassigned = send(put(BADGES + "/" + badge.get("id") + "/group"), remove, 200);
        assertThat(unassigned).containsEntry("groupId", null).containsEntry("translations", badge.get("translations"));
        assertThat(number(send(get(BADGES).param("ungrouped", "true"), null, 200), "totalElements")).isEqualTo(1);
    }

    @Test
    void invalidScopeMissingGroupsAndDuplicateLocalesDoNotPartiallyChangeMetadata() throws Exception {
        var group = group("empty", "THEME", List.of());
        assertThat(findGroup(group.get("id"), "en-US")).containsEntry("displayName", "empty")
                .containsEntry("actualLocale", null);
        send(post(GROUPS), Map.of("code", "duplicate-locales", "kind", "THEME", "translations",
                List.of(text("en-US", "One"), text("en-US", "Two"))), 422);
        send(get(GROUPS).param("size", "101"), null, 422);
        send(get(GROUPS).param("q", "x".repeat(101)), null, 422);
        send(get(GROUPS).param("unknown", "1"), null, 400);
        send(get(BADGES).param("groupId", group.get("id").toString()).param("ungrouped", "true"), null, 422);
        send(post(BADGES), Map.of("code", "missing-group", "kind", "UNKNOWN", "groupId", UUID.randomUUID(),
                "translations", List.of()), 404);
        assertThat(number(send(get(BADGES), null, 200), "totalElements")).isZero();
        var badge = badge("untouched", group.get("id"), "Keep", UUID.randomUUID());
        send(put(BADGES + "/" + badge.get("id") + "/group"),
                Map.of("expectedVersion", badge.get("version")), 400);
        send(put(BADGES + "/" + badge.get("id") + "/group"),
                Map.of("expectedVersion", badge.get("version"), "groupId", UUID.randomUUID()), 404);
        var unchanged = rows(send(get(BADGES).param("groupId", group.get("id").toString()), null, 200).get("items"))
                .getFirst();
        assertThat(unchanged).containsEntry("version", badge.get("version"))
                .containsEntry("translations", badge.get("translations"));
    }

    @Test
    void emptyCatalogStillExposesVirtualUnassignedGroupAndReadsNeverWriteRows() throws Exception {
        var result = send(get(GROUPS), null, 200);
        assertThat(rows(result.get("items"))).hasSize(1);
        var virtual = rows(result.get("items")).getFirst();
        assertThat(virtual).containsEntry("id", null).containsEntry("kind", null)
                .containsEntry("code", "__ungrouped");
        assertThat(number(virtual, "badgeCount")).isZero();
        send(get(GROUPS), null, 200);
        assertThat(jdbc.sql("SELECT count(*) FROM hero.skin_badge_group").query(Long.class).single()).isZero();
        assertThat(jdbc.sql("SELECT count(*) FROM hero.skin_badge").query(Long.class).single()).isZero();
        assertThat(rows(send(get(GROUPS).param("q", "missing"), null, 200).get("items"))).isEmpty();
    }

    @Test
    void groupedReadsAndMutationsRequireTheirExistingCatalogAndHeroPermissions() throws Exception {
        mvc.perform(get(GROUPS)).andExpect(status().isUnauthorized());
        mvc.perform(get(GROUPS).with(jwt().authorities(new SimpleGrantedAuthority("hero:write"))))
                .andExpect(status().isForbidden());
        var body = Map.of("code", "forbidden", "kind", "THEME", "translations", List.of());
        mvc.perform(post(GROUPS).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
        var group = group("allowed", "THEME", List.of());
        var badge = badge("editor-only", group.get("id"), "Label", UUID.randomUUID());
        mvc.perform(put(BADGES + "/" + badge.get("id") + "/group")
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        Map.of("expectedVersion", badge.get("version"), "groupId", group.get("id")))))
                .andExpect(status().isForbidden());
    }

    @Test
    void generatedBadgeCodesKeepNameRegionAndMonotonicCollisionSuffix() throws Exception {
        var body = Map.of("kind", "RARITY", "regionCode", "vn", "translations", List.of(text("vi-VN", "SS+")));
        var first = send(post(BADGES), body, 201);
        var second = send(post(BADGES), body, 201);
        assertThat(first).containsEntry("code", "ss-plus-vn-1");
        assertThat(second).containsEntry("code", "ss-plus-vn-2");
        assertThat(first.get("id")).isNotEqualTo(second.get("id"));
        send(post(BADGES), Map.of("kind", "RARITY", "regionCode", "zz", "translations", List.of(text("vi-VN", "SS"))),
                422);
        send(post(BADGES), Map.of("kind", "RARITY", "translations", List.of()), 422);
    }

    private Map<String, Object> group(String code, String kind, List<Map<String, Object>> translations)
            throws Exception {
        return send(post(GROUPS), Map.of("code", code, "kind", kind, "translations", translations), 201);
    }

    private Map<String, Object> badge(String code, Object groupId, String name, UUID icon) throws Exception {
        var input = new HashMap<String, Object>();
        input.put("code", code);
        input.put("kind", "UNKNOWN");
        input.put("groupId", groupId);
        input.put("translations", List.of(iconText("vi-VN", name, icon)));
        return send(post(BADGES), input, 201);
    }

    private Map<String, Object> findGroup(Object id, String locale) throws Exception {
        return rows(send(get(GROUPS).param("locale", locale), null, 200).get("items")).stream()
                .filter(row -> Objects.equals(id, row.get("id"))).findFirst().orElseThrow();
    }

    private Map<String, Object> send(MockHttpServletRequestBuilder request, Object body, int expectedStatus)
            throws Exception {
        request.with(jwt().jwt(token -> token.issuer("https://test.example/issuer").subject("editor")).authorities(
                new SimpleGrantedAuthority("catalog:read"), new SimpleGrantedAuthority("hero:write")));
        if (body != null)
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        String response = mvc.perform(request).andExpect(status().is(expectedStatus)).andReturn().getResponse()
                .getContentAsString();
        return response.isEmpty() ? Map.of() : json.readValue(response, Map.class);
    }

    private static Map<String, Object> text(String locale, String name) {
        return Map.of("locale", locale, "displayName", name);
    }

    private static Map<String, Object> iconText(String locale, String name, UUID id) {
        return Map.of("locale", locale, "displayName", name, "iconAssetId", id);
    }

    private static long number(Map<String, Object> row, String key) {
        return ((Number) row.get(key)).longValue();
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> rows(Object value) {
        return (List<Map<String, Object>>) value;
    }
}
