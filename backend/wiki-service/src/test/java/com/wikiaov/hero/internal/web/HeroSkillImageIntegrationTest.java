package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.DockerBacked;
import com.wikiaov.TestcontainersConfiguration;
import com.wikiaov.hero.internal.skills.infrastructure.HeroSkillImageUsages;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssetState;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.media.MediaSemanticType;
import java.util.LinkedHashMap;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.annotation.DirtiesContext.ClassMode;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@Import(TestcontainersConfiguration.class)
@DirtiesContext(classMode = ClassMode.AFTER_CLASS)
@DockerBacked
class HeroSkillImageIntegrationTest {
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
