package com.wikiaov.terminology.internal.web;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.terminology.PublicReferenceProvider;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@EnabledIf("databaseAvailable")
class ReferenceSettingsIntegrationTest {
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
    @MockitoBean
    JwtDecoder decoder;
    @MockitoBean
    GameplayContexts contexts;
    @MockitoBean(name = "heroPublicReferences")
    PublicReferenceProvider heroes;
    @MockitoBean(name = "itemPublicReferences")
    PublicReferenceProvider items;
    @MockitoBean(name = "arcanaPublicReferences")
    PublicReferenceProvider arcana;
    @MockitoBean(name = "enchantmentPublicReferences")
    PublicReferenceProvider enchantments;
    @MockitoBean(name = "spellPublicReferences")
    PublicReferenceProvider spells;

    @Test
    void persistsTranslationsChecksVersionsAndSharesOnlyPublishedReferences() throws Exception {
        when(contexts.resolve(eq("VN"), any(Instant.class))).thenReturn(new GameplayContext(UUID.randomUUID(),
                "VN", UUID.randomUUID(), "aov-standard", UUID.randomUUID(), "patch", UUID.randomUUID(), 1,
                Instant.EPOCH));
        var initial = mvc.perform(get("/api/wiki/v1/reference-settings")).andExpect(status().isOk()).andReturn();
        var seed = json.readTree(initial.getResponse().getContentAsString());
        assertThat(seed.get("settings").get("entities").size()).isGreaterThan(0);
        long version = seed.get("version").asLong();
        String hiddenId = UUID.randomUUID().toString();
        var term = Map.of("id", "slow", "kind", "term", "translations", List.of(
                Map.of("locale", "vi-VN", "name", "Làm chậm", "aliases", List.of("Chậm"), "description",
                        "Giảm tốc chạy."),
                Map.of("locale", "en-US", "name", "Slow", "aliases", List.of(), "description",
                        "Reduces movement speed.")),
                "destinations", Map.of("admin", "/terminology?term=slow", "wiki", "/?term=slow"));
        var hidden = Map.of("id", hiddenId, "kind", "hero", "translations", List.of(
                Map.of("locale", "vi-VN", "name", "Hidden draft", "aliases", List.of(), "description",
                        "Private text")));
        String arcanaId = UUID.randomUUID().toString();
        var rune = Map.of("id", arcanaId, "kind", "arcana", "translations", List.of(
                Map.of("locale", "vi-VN", "name", "Ngọc thử", "aliases", List.of(), "description", "Bản dịch ngọc")));
        var settings = Map.of("schemaVersion", 1, "autoRecognize", true, "fallbackLocale", "vi-VN", "entities",
                List.of(term, hidden, rune));
        String body = json.writeValueAsString(Map.of("expectedVersion", version, "settings", settings));
        mvc.perform(put("/api/wiki/v1/admin/reference-settings").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        mvc.perform(put("/api/wiki/v1/admin/reference-settings")
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        var editor = jwt().jwt(t -> t.issuer("https://issuer.test").subject("editor"))
                .authorities(new SimpleGrantedAuthority("catalog:read"), new SimpleGrantedAuthority("hero:write"));
        mvc.perform(put("/api/wiki/v1/admin/reference-settings").with(editor).contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.version").value(version + 1));
        mvc.perform(put("/api/wiki/v1/admin/reference-settings").with(editor).contentType(MediaType.APPLICATION_JSON)
                .content(body)).andExpect(status().isConflict());
        var shared = mvc.perform(get("/api/wiki/v1/reference-settings")).andExpect(status().isOk())
                .andExpect(jsonPath("$.settings.entities[0].destinations.admin").doesNotExist()).andReturn()
                .getResponse().getContentAsString();
        assertThat(shared).contains("Slow", "Làm chậm").doesNotContain("Hidden draft", hiddenId);
        when(heroes.references(any(PublicReferenceProvider.Scope.class), eq("vi-VN"))).thenReturn(List.of(
                new PublicReferenceProvider.Candidate(UUID.randomUUID(), "hero", "Airi", "", "vi-VN", "/head.png")));
        when(items.references(any(PublicReferenceProvider.Scope.class), eq("vi-VN"))).thenReturn(List.of());
        when(arcana.references(any(PublicReferenceProvider.Scope.class), eq("vi-VN")))
                .thenReturn(List.of(new PublicReferenceProvider.Candidate(UUID.fromString(arcanaId), "arcana", "Rune",
                        "", "vi-VN", "/rune.png")));
        var response = mvc.perform(get("/api/wiki/v1/reference-catalog?region=VN&locale=vi-VN"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(response).contains("Airi", "Làm chậm", "Ngọc thử").doesNotContain("Hidden draft", hiddenId);
        mvc.perform(get("/api/wiki/v1/reference-settings?unexpected=true")).andExpect(status().isBadRequest());
    }

    @Test
    @Transactional
    void publicHeroCatalogMergesOnlyAliasesWhileOtherKindsRetainTheirExistingOverlays() throws Exception {
        var context = new GameplayContext(UUID.randomUUID(), "VN", UUID.randomUUID(), "aov-standard",
                UUID.randomUUID(), "patch", UUID.randomUUID(), 1, Instant.EPOCH);
        when(contexts.resolve(eq("VN"), any(Instant.class))).thenReturn(context);
        UUID hero = UUID.randomUUID();
        UUID item = UUID.randomUUID();
        when(heroes.references(any(PublicReferenceProvider.Scope.class), eq("vi-VN")))
                .thenReturn(List.of(new PublicReferenceProvider.Candidate(hero, "hero", "Florentino",
                        "Canonical description", "vi-VN", "/hero.png")));
        when(items.references(any(PublicReferenceProvider.Scope.class), eq("vi-VN")))
                .thenReturn(List.of(new PublicReferenceProvider.Candidate(item, "item", "Canonical item",
                        "Canonical item description", "vi-VN", "/item.png")));
        var initial = mvc.perform(get("/api/wiki/v1/admin/reference-settings")
                .with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        long version = json.readTree(initial).get("version").asLong();
        var heroOverlay = Map.of("id", hero.toString(), "kind", "hero", "translations", List.of(
                Map.of("locale", "vi-VN", "name", "Outdated hero name", "aliases", List.of("Flo", " flo "),
                        "description", "Outdated hero description"),
                Map.of("locale", "th-TH", "name", "Private translation", "aliases", List.of("Hidden alias"),
                        "description", "Private description")),
                "autoMatch", false);
        var itemOverlay = Map.of("id", item.toString(), "kind", "item", "translations", List.of(
                Map.of("locale", "vi-VN", "name", "Custom item name", "aliases", List.of("Item alias"),
                        "description", "Custom item description")));
        var settings = Map.of("schemaVersion", 1, "autoRecognize", true, "fallbackLocale", "vi-VN", "entities",
                List.of(heroOverlay, itemOverlay));
        mvc.perform(put("/api/wiki/v1/admin/reference-settings")
                .with(jwt().jwt(t -> t.issuer("https://issuer.test").subject("editor"))
                        .authorities(new SimpleGrantedAuthority("catalog:read"),
                                new SimpleGrantedAuthority("hero:write")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("expectedVersion", version, "settings", settings))))
                .andExpect(status().isOk());

        var response = mvc.perform(get("/api/wiki/v1/reference-catalog?region=VN&locale=vi-VN"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat(response).contains("Florentino", "Canonical description", "Flo", "Custom item name", "Item alias")
                .doesNotContain("Outdated hero name", "Outdated hero description", "Private translation",
                        "Hidden alias");
        var candidate = json.readTree(response).get("settings").get("entities").valueStream()
                .filter(row -> row.get("id").asString().equals(hero.toString())).findFirst().orElseThrow();
        assertThat(candidate.get("translations").size()).isEqualTo(1);
        assertThat(candidate.get("translations").get(0).get("aliases").size()).isEqualTo(1);
        assertThat(candidate.get("autoMatch").asBoolean()).isFalse();
    }
}
