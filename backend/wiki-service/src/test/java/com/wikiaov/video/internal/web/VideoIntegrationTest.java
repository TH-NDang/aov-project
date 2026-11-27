package com.wikiaov.video.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.DockerBacked;
import com.wikiaov.SeaweedFsTestConfiguration;
import com.wikiaov.TestcontainersConfiguration;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Arrays;
import java.util.UUID;
import java.util.stream.StreamSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, SeaweedFsTestConfiguration.class})
@ActiveProfiles("test")
@DockerBacked
class VideoIntegrationTest {
    private static final String ADMIN = "/api/wiki/v1/admin/videos";
    private static final String PUBLIC = "/api/wiki/v1/videos";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    JsonMapper json;

    private UUID hero;

    @BeforeEach
    void seed() {
        jdbc.sql("TRUNCATE video.subject_video").update();
        hero = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO hero.hero (id, code, created_at, created_by_issuer, created_by_subject)
                VALUES (?, ?, ?, 'test', 'test')
                """).params(hero, "video-hero-" + hero, Timestamp.from(Instant.now())).update();
        jdbc.sql("INSERT INTO hero.hero_skin (hero_id, skin_key, created_at) VALUES (?, 'lan-su', now())")
                .param(hero).update();
        jdbc.sql("INSERT INTO hero.hero_skill (hero_id, skill_key, created_at) VALUES (?, 'skill-1', now())")
                .param(hero).update();
    }

    @Test
    void attachesSeveralVideosToOneHeroAndShowsOnlyPublishedOnes() throws Exception {
        JsonNode basic = create(body("HERO", null, "GUIDE_BASIC", "Cách chơi cơ bản", "https://youtu.be/aaaaaaaaaaa",
                "PUBLISHED"), editor());
        assertThat(basic.get("url").asText()).isEqualTo("https://www.youtube.com/watch?v=aaaaaaaaaaa");
        assertThat(basic.get("providerVideoId").asText()).isEqualTo("aaaaaaaaaaa");
        assertThat(basic.get("displayOrder").asInt()).isZero();

        JsonNode combo = create(body("HERO", null, "GUIDE_ADVANCED", "Combo nâng cao", "https://youtu.be/bbbbbbbbbbb",
                "PUBLISHED"), editor());
        assertThat(combo.get("displayOrder").asInt()).isEqualTo(1);
        create(body("HERO", null, "SKILL_DEMO", "Chiêu 1", "https://youtu.be/ccccccccccc", "PUBLISHED"), editor());
        create(body("SKIN", "lan-su", "SKIN_SHOWCASE", "Trang phục", "https://youtu.be/ddddddddddd", "PUBLISHED"),
                editor());
        create(body("HERO", null, "LORE", "Chưa duyệt", "https://youtu.be/eeeeeeeeeee", "DRAFT"), editor());

        mvc.perform(get(PUBLIC).param("subjectKind", "HERO").param("subjectId", hero.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.items.length()").value(4))
                .andExpect(jsonPath("$.items[?(@.title == 'Chưa duyệt')]").isEmpty())
                .andExpect(jsonPath("$.items[0].status").doesNotExist());
        mvc.perform(get(PUBLIC).param("subjectKind", "SKIN").param("subjectId", hero.toString())
                .param("subjectKey", "lan-su")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].purpose").value("SKIN_SHOWCASE"));
    }

    @Test
    void skillsHaveNoVideosOfTheirOwn() throws Exception {
        send(post(ADMIN), body("SKILL", "skill-1", "SKILL_DEMO", "Chiêu 1", "https://youtu.be/ccccccccccc", "DRAFT"),
                editor()).andExpect(status().isBadRequest());
        mvc.perform(get(PUBLIC).param("subjectKind", "SKILL").param("subjectId", hero.toString())
                .param("subjectKey", "skill-1")).andExpect(status().isBadRequest());
    }

    @Test
    void publicReadRejectsUnknownParametersAndKeysOnKeylessSubjects() throws Exception {
        mvc.perform(get(PUBLIC).param("subjectKind", "HERO").param("subjectId", hero.toString()).param("status", "x"))
                .andExpect(status().isBadRequest());
        mvc.perform(get(PUBLIC).param("subjectKind", "HERO").param("subjectId", hero.toString())
                .param("subjectKey", "lan-su")).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VIDEO_INVALID"));
    }

    @Test
    void theSameVideoIsADuplicateOnlyAtTheSameStartPoint() throws Exception {
        create(body("HERO", null, "GUIDE_BASIC", "Một", "https://youtu.be/aaaaaaaaaaa", "DRAFT"), editor());

        send(post(ADMIN), body("HERO", null, "OTHER", "Hai", "https://www.youtube.com/watch?v=aaaaaaaaaaa", "DRAFT"),
                editor()).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("VIDEO_DUPLICATE"));
        create(body("HERO", null, "GUIDE_ADVANCED", "Phần combo", "https://youtu.be/aaaaaaaaaaa?t=90", "DRAFT"),
                editor());
        create(body("SKIN", "lan-su", "OTHER", "Cùng video, mục khác", "https://youtu.be/aaaaaaaaaaa", "DRAFT"),
                editor());
    }

    @Test
    void rejectsUnknownSubjectsAndBadLinksAndWrongKeys() throws Exception {
        send(post(ADMIN), body("SKIN", "khong-co", "OTHER", "A", "https://youtu.be/aaaaaaaaaaa", "DRAFT"), editor())
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("VIDEO_SUBJECT_NOT_FOUND"));
        send(post(ADMIN), body("HERO", null, "OTHER", "A", "javascript:alert(1)", "DRAFT"), editor())
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("VIDEO_INVALID"));
        send(post(ADMIN), body("SKIN", null, "OTHER", "A", "https://youtu.be/aaaaaaaaaaa", "DRAFT"), editor())
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("VIDEO_INVALID"));
        send(post(ADMIN), body("HERO", "lan-su", "OTHER", "A", "https://youtu.be/aaaaaaaaaaa", "DRAFT"), editor())
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.code").value("VIDEO_INVALID"));
    }

    @Test
    void writingNeedsTheSubjectsCapabilityAndPublishingNeedsMore() throws Exception {
        String draft = body("HERO", null, "OTHER", "A", "https://youtu.be/aaaaaaaaaaa", "DRAFT");
        String published = body("HERO", null, "OTHER", "A", "https://youtu.be/aaaaaaaaaaa", "PUBLISHED");

        send(post(ADMIN), draft, null).andExpect(status().isUnauthorized());
        send(post(ADMIN), draft, actor("catalog:read")).andExpect(status().isForbidden());
        send(post(ADMIN), draft, actor("catalog:read", "item:write")).andExpect(status().isForbidden());
        send(post(ADMIN), published, actor("catalog:read", "hero:write")).andExpect(status().isForbidden());

        JsonNode saved = create(draft, actor("catalog:read", "hero:write"));
        String approve = body("HERO", null, "OTHER", "A", "https://youtu.be/aaaaaaaaaaa", "PUBLISHED",
                saved.get("version").asLong());
        send(put(ADMIN + "/" + saved.get("id").asText()), approve, actor("catalog:read", "hero:write"))
                .andExpect(status().isForbidden());
        send(put(ADMIN + "/" + saved.get("id").asText()), approve, actor("catalog:read", "hero:write", "hero:publish"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.version").value(2));
    }

    @Test
    void updateAndDeleteCheckTheVersion() throws Exception {
        JsonNode saved = create(body("HERO", null, "OTHER", "A", "https://youtu.be/aaaaaaaaaaa", "DRAFT"), editor());
        String id = saved.get("id").asText();

        send(put(ADMIN + "/" + id), body("HERO", null, "LORE", "B", "https://youtu.be/aaaaaaaaaaa", "DRAFT", 99L),
                editor()).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("VIDEO_CONFLICT"));
        send(put(ADMIN + "/" + id), body("HERO", null, "LORE", "B", "https://youtu.be/aaaaaaaaaaa", "DRAFT", 1L),
                editor()).andExpect(status().isOk()).andExpect(jsonPath("$.title").value("B"));

        mvc.perform(delete(ADMIN + "/" + id).param("expectedVersion", "1").with(editor()))
                .andExpect(status().isConflict());
        mvc.perform(delete(ADMIN + "/" + id).param("expectedVersion", "2").with(editor()))
                .andExpect(status().isNoContent());
        mvc.perform(delete(ADMIN + "/" + id).param("expectedVersion", "2").with(editor()))
                .andExpect(status().isNotFound());
    }

    @Test
    void repeatedImportKeepsEditorsDecisions() throws Exception {
        String batch = """
                {"items":[
                  {"subjectKind":"SKIN","subjectId":"%1$s","subjectKey":"lan-su","purpose":"SKIN_SHOWCASE",
                   "title":"Hiệu ứng","url":"https://youtu.be/aaaaaaaaaaa","durationSeconds":47,
                   "publishedOn":"2025-01-23","status":"PUBLISHED"},
                  {"subjectKind":"HERO","subjectId":"%1$s","purpose":"LORE","title":"Cốt truyện",
                   "url":"https://youtu.be/bbbbbbbbbbb","status":"DRAFT"},
                  {"subjectKind":"SKIN","subjectId":"%1$s","subjectKey":"khong-co","purpose":"SKIN_SHOWCASE",
                   "title":"Sai khóa","url":"https://youtu.be/ccccccccccc","status":"DRAFT"},
                  {"subjectKind":"HERO","subjectId":"%1$s","purpose":"LORE","title":"Link hỏng",
                   "url":"nope","status":"DRAFT"},
                  {"subjectKind":"HERO","subjectId":"%1$s","purpose":"LORE","title":"Trùng trong lô",
                   "url":"https://www.youtube.com/watch?v=bbbbbbbbbbb","status":"DRAFT"}
                ]}""".formatted(hero);

        send(post(ADMIN + "/import"), batch, editor()).andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(2)).andExpect(jsonPath("$.skipped").value(1))
                .andExpect(jsonPath("$.rejected.length()").value(2))
                .andExpect(jsonPath("$.rejected[0].index").value(2))
                .andExpect(jsonPath("$.rejected[1].index").value(3));

        JsonNode page = json.readTree(mvc.perform(get(ADMIN).param("subjectKind", "HERO")
                .param("subjectId", hero.toString()).param("status", "DRAFT").with(editor()))
                .andExpect(jsonPath("$.items[0].origin").value("IMPORT"))
                .andReturn().getResponse().getContentAsString());
        JsonNode lore = page.get("items").get(0);
        send(put(ADMIN + "/" + lore.get("id").asText()),
                body("HERO", null, "LORE", "Đã bác", "https://youtu.be/bbbbbbbbbbb", "HIDDEN", 1L), editor())
                .andExpect(status().isOk());

        send(post(ADMIN + "/import"), batch, editor()).andExpect(status().isOk())
                .andExpect(jsonPath("$.created").value(0)).andExpect(jsonPath("$.skipped").value(3));

        mvc.perform(get(ADMIN).param("status", "HIDDEN").param("subjectId", hero.toString()).with(editor()))
                .andExpect(jsonPath("$.items[0].title").value("Đã bác"));
    }

    @Test
    void importNeedsTheCapabilitiesOfEveryRow() throws Exception {
        String batch = """
                {"items":[{"subjectKind":"HERO","subjectId":"%s","purpose":"LORE","title":"A",
                 "url":"https://youtu.be/aaaaaaaaaaa","status":"PUBLISHED"}]}""".formatted(hero);

        send(post(ADMIN + "/import"), batch, actor("catalog:read", "hero:write")).andExpect(status().isForbidden());
        send(post(ADMIN + "/import"), "{\"items\":[]}", editor()).andExpect(status().isUnprocessableEntity());
    }

    @Test
    void listsSubjectsForPickersAndMatching() throws Exception {
        JsonNode subjects = json.readTree(mvc.perform(get(ADMIN + "/subjects").with(editor()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("items");

        assertThat(subjects.findValuesAsString("kind")).contains("HERO", "SKIN").doesNotContain("SKILL");
        var heroRows = StreamSupport.stream(subjects.spliterator(), false)
                .filter(row -> row.get("id").asText().equals(hero.toString())).toList();
        assertThat(heroRows.stream().map(row -> row.get("kind").asText()).toList())
                .containsExactlyInAnyOrder("HERO", "SKIN");
    }

    private JsonNode create(String body, RequestPostProcessor actor) throws Exception {
        return json.readTree(send(post(ADMIN), body, actor).andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString());
    }

    private ResultActions send(
            MockHttpServletRequestBuilder request, String body,
            RequestPostProcessor actor) throws Exception {
        var prepared = request.contentType(MediaType.APPLICATION_JSON).content(body);
        return mvc.perform(actor == null ? prepared : prepared.with(actor));
    }

    private String body(String kind, String key, String purpose, String title, String url, String status) {
        return body(kind, key, purpose, title, url, status, null);
    }

    private String body(String kind, String key, String purpose, String title, String url, String status,
            Long expectedVersion) {
        return """
                {"subjectKind":"%s","subjectId":"%s","subjectKey":%s,"purpose":"%s","title":"%s","url":"%s",
                 "status":"%s","expectedVersion":%s}""".formatted(kind, hero, key == null ? "null" : '"' + key + '"',
                purpose, title, url, status, expectedVersion);
    }

    private RequestPostProcessor editor() {
        return actor("catalog:read", "hero:write", "hero:publish");
    }

    private RequestPostProcessor actor(String... capabilities) {
        return jwt().authorities(Arrays.stream(capabilities).map(SimpleGrantedAuthority::new)
                .toArray(GrantedAuthority[]::new));
    }
}
