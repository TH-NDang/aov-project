package com.wikiaov.hero.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.DockerBacked;
import com.wikiaov.TestcontainersConfiguration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
@DockerBacked
@Transactional
class HeroStatRulesIntegrationTest {
    private static final String ADMIN = "/api/wiki/v1/admin/hero-stat-rules";
    private static final String PUBLIC = "/api/wiki/v1/hero-stat-rules";

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @Autowired
    JdbcClient jdbc;

    @Test
    void theSharedValuesAndAcademyCapsAreSeededAndReadableWithoutSigningIn() throws Exception {
        var rules = rules(mvc.perform(get(PUBLIC)).andExpect(status().isOk()).andReturn().getResponse()
                .getContentAsString());

        assertThat(rules.get("MOVEMENT_SPEED")).containsEntry("unit", "POINT").containsEntry("baseValue", null)
                .containsEntry("capValue", 800).containsEntry("sourceUrl",
                        "https://hocvien.lienquan.garena.vn/bai-viet/25069");
        assertThat(rules.get("COOLDOWN_REDUCTION")).containsEntry("unit", "PERCENT").containsEntry("baseValue", 0)
                .containsEntry("capValue", 40);
        assertThat(rules.get("BONUS_ATTACK_SPEED")).containsEntry("capValue", 200);
        assertThat(rules.get("CRITICAL_DAMAGE")).containsEntry("baseValue", 200);
        assertThat(rules.get("MAGIC_DEFENSE")).containsEntry("baseValue", 80).containsEntry("percentValue", 0);
        assertThat(columnExists("patch", "stat_default")).isFalse();
        mvc.perform(get(PUBLIC).param("patch", "x")).andExpect(status().isBadRequest());
    }

    @Test
    void theGlossaryExplainsEveryStatTheAttributeScreenShows() throws Exception {
        var terms = jdbc.sql("""
                SELECT e.reference_key, t.description FROM terminology.entry e
                JOIN terminology.translation t ON t.entry_id = e.id AND t.locale = 'vi-VN'
                WHERE e.kind = 'term'
                """).query((row, n) -> Map.entry(row.getString(1), row.getString(2))).list();
        var byKey = new HashMap<String, String>();
        terms.forEach(term -> byKey.put(term.getKey(), term.getValue()));

        assertThat(byKey).containsKeys("mau-toi-da", "cong-vat-ly", "cong-phep", "giap", "giap-phep", "nang-luong",
                "toc-chay", "tam-danh", "xuyen-giap", "xuyen-giap-phep", "toc-danh", "ti-le-chi-mang",
                "sat-thuong-chi-mang", "hut-mau", "hut-mau-phep", "giam-hoi-chieu", "khang-hieu-ung",
                "hoi-mau-moi-5-giay", "hoi-nang-luong-moi-5-giay");
        assertThat(byKey.values()).noneMatch(text -> text.contains("{item:"));
        assertThat(byKey.get("giam-hoi-chieu")).contains("40%");
        assertThat(byKey.get("toc-chay")).contains("800");
        assertThat(byKey.get("xuyen-giap")).contains("<ref=term:giap>giáp</ref>", "Kiếm Muramasa");
        assertThat(jdbc.sql("SELECT count(*) FROM terminology.entry WHERE kind = 'term'").query(Long.class).single())
                .isEqualTo(byKey.size());
    }

    @Test
    void anEditorSetsAndRemovesASharedStatGuardedByItsVersion() throws Exception {
        var added = send(put(ADMIN + "/TENACITY"), rule("PERCENT", 0, null, null, 100, 0), 200);
        assertThat(added).containsEntry("statKey", "TENACITY").containsEntry("capValue", 100)
                .containsEntry("version", 1);

        var grown = send(put(ADMIN + "/TENACITY"), rule("PERCENT", 0, null, 0.5, 100, 1), 200);
        assertThat(grown).containsEntry("growthPerLevel", 0.5).containsEntry("version", 2);
        send(put(ADMIN + "/TENACITY"), rule("PERCENT", 5, null, null, 100, 1), 409);
        assertThat(rules(mvc.perform(get(ADMIN).with(editor())).andExpect(status().isOk()).andReturn()
                .getResponse().getContentAsString()).get("TENACITY")).containsEntry("version", 2);

        mvc.perform(delete(ADMIN + "/TENACITY").param("expectedVersion", "1").with(editor()))
                .andExpect(status().isConflict());
        mvc.perform(delete(ADMIN + "/TENACITY").param("expectedVersion", "2").with(editor()))
                .andExpect(status().isNoContent());
        mvc.perform(delete(ADMIN + "/TENACITY").param("expectedVersion", "2").with(editor()))
                .andExpect(status().isNotFound());
        assertThat(jdbc.sql("SELECT count(*) FROM access.audit_event WHERE aggregate_type = 'HERO_STAT_RULE'")
                .query(Long.class).single()).isGreaterThanOrEqualTo(3);
    }

    @Test
    void aSharedStatRejectsValuesTheGameCannotShow() throws Exception {
        send(put(ADMIN + "/MAX_HEALTH"), rule("POINT", null, null, null, null, 0), 422);
        send(put(ADMIN + "/MAX_HEALTH"), rule("POINT", 3000, 10, null, null, 0), 422);
        send(put(ADMIN + "/MAX_HEALTH"), rule("POINT", -1, null, null, null, 0), 422);
        send(put(ADMIN + "/MAX_HEALTH"), rule("POINT", 3000, null, -5, null, 0), 422);
        send(put(ADMIN + "/MAX_HEALTH"), rule("POINT", 3000, null, null, 0, 0), 422);
        send(put(ADMIN + "/COOLDOWN_REDUCTION"), rule("PERCENT", 50, null, null, 40, 1), 422);
        send(put(ADMIN + "/MAX_HEALTH"), rule("SECOND", 3000, null, null, null, 0), 422);
        var badSource = rule("POINT", 3000, null, null, null, 0);
        badSource.put("sourceUrl", "ftp://example.com/stats");
        send(put(ADMIN + "/MAX_HEALTH"), badSource, 422);
        send(put(ADMIN + "/max_health"), rule("POINT", 3000, null, null, null, 0), 422);
        var withPierce = send(put(ADMIN + "/ARMOR_PIERCE"), rule("POINT", 0, 0, null, null, 1), 200);
        assertThat(withPierce).containsEntry("percentValue", 0).containsEntry("version", 2);
    }

    @Test
    void readingNeedsTheCatalogAndWritingNeedsHeroWrite() throws Exception {
        mvc.perform(get(ADMIN)).andExpect(status().isUnauthorized());
        mvc.perform(get(ADMIN).with(jwt().authorities(new SimpleGrantedAuthority("hero:write"))))
                .andExpect(status().isForbidden());
        mvc.perform(put(ADMIN + "/TENACITY").with(jwt().authorities(new SimpleGrantedAuthority("catalog:read")))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(rule("PERCENT", 0, null, null, 100, 0))))
                .andExpect(status().isForbidden());
        mvc.perform(get(ADMIN).with(jwt().authorities(new SimpleGrantedAuthority("catalog:read"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].statKey").exists());
    }

    private static Map<String, Object> rule(String unit, Number base, Number percent, Number growth, Number cap,
            long expectedVersion) {
        var body = new HashMap<String, Object>();
        body.put("unit", unit);
        body.put("baseValue", base);
        body.put("percentValue", percent);
        body.put("growthPerLevel", growth);
        body.put("capValue", cap);
        body.put("expectedVersion", expectedVersion);
        return body;
    }

    private boolean columnExists(String schema, String table) {
        return jdbc.sql("SELECT to_regclass(:name) IS NOT NULL").param("name", schema + "." + table)
                .query(Boolean.class).single();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Map<String, Object>> rules(String body) throws Exception {
        var result = new HashMap<String, Map<String, Object>>();
        for (var row : (List<Map<String, Object>>) json.readValue(body, List.class)) {
            result.put((String) row.get("statKey"), row);
        }
        return result;
    }

    private static org.springframework.test.web.servlet.request.RequestPostProcessor editor() {
        return jwt().jwt(token -> token.issuer("https://test.example/issuer").subject("editor")).authorities(
                new SimpleGrantedAuthority("catalog:read"), new SimpleGrantedAuthority("hero:write"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> send(MockHttpServletRequestBuilder request, Object body, int expectedStatus)
            throws Exception {
        request.with(editor()).contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        String response = mvc.perform(request).andExpect(status().is(expectedStatus)).andReturn().getResponse()
                .getContentAsString();
        return response.isEmpty() || expectedStatus >= 400 ? Map.of() : json.readValue(response, Map.class);
    }
}
