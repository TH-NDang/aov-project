package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.wikiaov.hero.internal.infrastructure.HeroSkillImageUsages;
import com.wikiaov.media.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
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
@Transactional
@EnabledIf("databaseAvailable")
class HeroSkillImageIntegrationTest {
    private static PostgreSQLContainer database;
    private final UUID hero = UUID.randomUUID();
    private final UUID asset = UUID.randomUUID();
    @Autowired
    MockMvc mvc;
    @Autowired
    JdbcTemplate sql;
    @Autowired
    JsonMapper json;
    @Autowired
    HeroSkillImageUsages usages;
    @MockitoBean
    JwtDecoder decoder;
    @MockitoBean
    MediaAssets media;

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
    @BeforeEach
    void fixture() {
        sql.update("insert into hero.hero values (?,?,now(),'test','editor')", hero, "test-" + hero);
        sql.update("insert into hero.hero_skill values (?,'skill-1-1',now())", hero);
        when(media.find(asset)).thenReturn(Optional.of(new MediaAssetReference(asset, MediaSemanticType.HERO_SKILL_ICON,
                MediaAssetState.ACTIVE, new MediaAssetReference.CurrentVersion(UUID.randomUUID(), "image/png", 128, 128,
                        "/skill.png"))));
    }
    @Test
    void preservesUnmatchedIconsWithoutInventingSkillMetadataOrGameplayHistory() throws Exception {
        var editor = jwt().jwt(t -> t.issuer("https://issuer.test").subject("editor"))
                .authorities(new SimpleGrantedAuthority("catalog:read"), new SimpleGrantedAuthority("hero:write"));
        String path = "/api/wiki/v1/admin/heroes/" + hero + "/skill-images";
        var body = new LinkedHashMap<String, Object>();
        body.put("expectedVersion", -1);
        body.put("assetId", asset);
        body.put("sourceFilename", "test-4-3.png");
        body.put("label", "test-4-3.png");
        mvc.perform(get(path)).andExpect(status().isUnauthorized());
        mvc.perform(put(path + "/4/3").with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body)))
                .andExpect(status().isForbidden());
        var created = mvc.perform(put(path + "/4/3").with(editor).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1)).andExpect(jsonPath("$.skillKey").isEmpty()).andReturn();
        var id = json.readTree(created.getResponse().getContentAsString()).get("id").asString();
        mvc.perform(put(path + "/4/3").with(editor).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id)).andExpect(jsonPath("$.version").value(1));
        body.put("label", "Changed label");
        mvc.perform(put(path + "/4/3").with(editor).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isConflict());
        body.put("expectedVersion", 1);
        mvc.perform(put(path + "/4/3").with(editor).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2));
        mvc.perform(get(path + "?unexpected=1").with(editor)).andExpect(status().isBadRequest());
        mvc.perform(get(path).with(editor)).andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(1));
        assertThat(sql.queryForObject("select count(*) from hero.hero_revision where hero_id=?", Long.class, hero))
                .isZero();
        assertThat(sql.queryForObject("select count(*) from hero.hero_skill where hero_id=?", Long.class, hero))
                .isEqualTo(1L);
        assertThat(usages.findUsages(asset)).singleElement().satisfies(usage -> {
            assertThat(usage.ownerId()).isEqualTo(hero);
            assertThat(usage.revisionId()).isNull();
            assertThat(usage.propertyRole()).isEqualTo("SKILL_LIBRARY:4:3");
        });
    }
    @Test
    void validatesExistingSkillIdentityAssetTypeAndSourceBounds() throws Exception {
        var editor = jwt().jwt(t -> t.issuer("https://issuer.test").subject("editor"))
                .authorities(new SimpleGrantedAuthority("catalog:read"), new SimpleGrantedAuthority("hero:write"));
        String path = "/api/wiki/v1/admin/heroes/" + hero + "/skill-images";
        var body = new LinkedHashMap<String, Object>();
        body.put("expectedVersion", -1);
        body.put("assetId", asset);
        body.put("sourceFilename", "test.png");
        body.put("skillKey", "does-not-exist");
        mvc.perform(put(path + "/1/1").with(editor).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isUnprocessableEntity());
        body.put("skillKey", "skill-1-1");
        mvc.perform(put(path + "/1/1").with(editor).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isOk())
                .andExpect(jsonPath("$.skillKey").value("skill-1-1"));
        body.remove("skillKey");
        mvc.perform(put(path + "/-1/1").with(editor).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isUnprocessableEntity());
        body.put("assetId", UUID.randomUUID());
        mvc.perform(put(path + "/2/1").with(editor).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(body))).andExpect(status().isUnprocessableEntity());
    }
}
