package com.wikiaov.gamemode.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.DockerBacked;
import com.wikiaov.SeaweedFsTestConfiguration;
import com.wikiaov.TestcontainersConfiguration;
import java.text.Normalizer;
import java.util.Arrays;
import java.util.UUID;
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
class GameModeIntegrationTest {
    private static final String ADMIN = "/api/wiki/v1/admin/game-modes";

    private static final String PUBLIC = "/api/wiki/v1/game-modes";

    private static final String READER = "/api/wiki/v1/users/me/game-modes";

    private static final String LINEUP_ID = "7f6c1d2e-0000-4000-8000-000000000001";

    private static final String GUIDE = """
            {"edition": "Bách khoa thử", "traits": [
              {"code": "dau-si", "kind": "FACTION", "name": "Đấu sĩ",
               "tiers": [{"count": 2, "effect": "+1000 lá chắn"}, {"count": 4, "effect": "+2000 lá chắn"}]},
              {"code": "giai-dieu-hoc-duong", "kind": "CLASS", "name": "Giai Điệu Học Đường",
               "tiers": [{"count": 3, "effect": "20% tỷ lệ"}]}],
             "units": [
              {"code": "violet", "name": "Violet", "cost": 1, "traitCodes": ["giai-dieu-hoc-duong"], "complete": false},
              {"code": "arduin", "name": "Arduin", "cost": 1, "traitCodes": ["dau-si"], "complete": false},
              {"code": "florentino", "name": "Florentino", "cost": 2,
               "traitCodes": ["dau-si", "giai-dieu-hoc-duong"], "complete": false}],
             "items": [{"code": "thanh-kiem", "name": "Thánh kiếm", "effect": "Tăng 70% ST chí mạng"}],
             "lineups": [{"id": "%s", "code": "hoc-duong", "name": "Học đường", "tier": "A",
               "units": [{"unitCode": "violet", "carry": true, "row": "BACK", "itemCodes": ["thanh-kiem"]},
                         {"unitCode": "florentino", "carry": false, "row": "FRONT", "itemCodes": []}]},
              {"code": "dau-si", "name": "Đấu sĩ", "units": [{"unitCode": "arduin", "carry": true, "itemCodes": []}]}]}
            """.replace("%s", LINEUP_ID);

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    JsonMapper json;

    private String code;

    @BeforeEach
    void cleanUp() {
        jdbc.sql("TRUNCATE gamemode.lineup_like, gamemode.community_lineup, gamemode.auto_chess_revision, "
                + "gamemode.game_mode_revision, gamemode.game_mode").update();
        code = "co-lien-quan";
    }

    @Test
    void draftsStayPrivateUntilPublishedAndEditsNeedTheCurrentVersion() throws Exception {
        JsonNode mode = createMode(code, "Cờ Liên quân");
        String id = mode.get("id").asText();
        String draft = mode.at("/revision/id").asText();
        assertThat(mode.at("/revision/state").asText()).isEqualTo("DRAFT");

        mvc.perform(get(PUBLIC)).andExpect(status().isOk()).andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(get(PUBLIC + "/" + code)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GAME_MODE_NOT_FOUND"));

        send(put(ADMIN + "/" + id + "/drafts/" + draft), content(1, "Mở hữu hạn 14 giờ", "NONE"), editor())
                .andExpect(status().isOk()).andExpect(jsonPath("$.revision.version").value(2));
        send(put(ADMIN + "/" + id + "/drafts/" + draft), content(1, "Tạm đóng", "NONE"), editor())
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GAME_MODE_CONFLICT"));
        send(post(ADMIN + "/" + id + "/drafts/" + draft + "/publish"), "{\"expectedVersion\": 2}", editor())
                .andExpect(status().isForbidden());
        send(post(ADMIN + "/" + id + "/drafts/" + draft + "/publish"), "{\"expectedVersion\": 2}", publisher())
                .andExpect(status().isOk()).andExpect(jsonPath("$.revision.state").value("PUBLISHED"));

        mvc.perform(get(PUBLIC)).andExpect(jsonPath("$.items[0].code").value(code))
                .andExpect(jsonPath("$.items[0].availability.gameLabel").value("Mở hữu hạn 14 giờ"))
                .andExpect(jsonPath("$.items[0].duration.minMinutes").value(20))
                .andExpect(jsonPath("$.items[0].hasGuide").value(false));

        JsonNode second = json.readTree(send(post(ADMIN + "/" + id + "/drafts"), "{}", editor())
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        send(post(ADMIN + "/" + id + "/drafts"), "{}", editor()).andExpect(status().isConflict());
        send(put(ADMIN + "/" + id + "/drafts/" + second.at("/revision/id").asText()),
                content(1, "Tạm đóng", "NONE"), editor()).andExpect(status().isOk());

        mvc.perform(get(PUBLIC + "/" + code)).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.availability.gameLabel").value("Mở hữu hạn 14 giờ"))
                .andExpect(jsonPath("$.contentLocale").value("vi-VN"));
        mvc.perform(get(ADMIN + "/" + id + "/revisions").with(editor())).andExpect(jsonPath("$.length()").value(2));
        send(post(ADMIN), "{\"code\": \"" + code + "\", \"name\": \"Lặp\", \"group\": \"PVP\"}", editor())
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("GAME_MODE_CODE_TAKEN"));
    }

    @Test
    void theGuideNeedsAnAutoChessModeConsistentReferencesAndKeepsLineupIds() throws Exception {
        String id = publishedMode("NONE");
        send(post(ADMIN + "/" + id + "/auto-chess/drafts"), "{\"content\": " + GUIDE + "}", editor())
                .andExpect(status().isUnprocessableContent());

        id = publishedMode("AUTO_CHESS");
        String broken = GUIDE.replace("\"traitCodes\": [\"dau-si\"]", "\"traitCodes\": [\"phap-su\"]");
        send(post(ADMIN + "/" + id + "/auto-chess/drafts"), "{\"content\": " + broken + "}", editor())
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.errors[0].code").value("UNKNOWN_REFERENCE"));

        JsonNode draft = json.readTree(send(post(ADMIN + "/" + id + "/auto-chess/drafts"),
                "{\"content\": " + GUIDE + "}", editor()).andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString());
        String assigned = draft.at("/content/lineups/1/id").asText();
        assertThat(assigned).isNotBlank();
        mvc.perform(get(PUBLIC + "/" + code + "/auto-chess")).andExpect(status().isNotFound());

        send(post(ADMIN + "/" + id + "/auto-chess/drafts/" + draft.at("/revision/id").asText() + "/publish"),
                "{\"expectedVersion\": 1}", publisher()).andExpect(status().isOk());
        mvc.perform(get(PUBLIC + "/" + code + "/auto-chess")).andExpect(status().isOk())
                .andExpect(jsonPath("$.content.units.length()").value(3))
                .andExpect(jsonPath("$.lineupLikes['" + LINEUP_ID + "'].likes").value(0));
        mvc.perform(get(PUBLIC)).andExpect(jsonPath("$.items[0].hasGuide").value(true));

        JsonNode next = json.readTree(send(post(ADMIN + "/" + id + "/auto-chess/drafts"), "{}", editor())
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString());
        assertThat(next.at("/content/lineups/1/id").asText()).isEqualTo(assigned);
        assertThat(next.at("/revision/sourceRevisionId").asText()).isEqualTo(draft.at("/revision/id").asText());
    }

    @Test
    void likesNeedAPersonCountOncePerReaderAndAreIdempotent() throws Exception {
        publishedGuide();
        String like = READER + "/" + code + "/auto-chess/likes/" + LINEUP_ID;

        mvc.perform(put(like)).andExpect(status().isUnauthorized());
        mvc.perform(put(like).with(service())).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("GAME_MODE_FORBIDDEN"));
        mvc.perform(put(like).with(person("reader-a"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.liked").value(true)).andExpect(jsonPath("$.likes").value(1));
        mvc.perform(put(like).with(person("reader-a"))).andExpect(jsonPath("$.likes").value(1));
        mvc.perform(put(like).with(person("reader-b"))).andExpect(jsonPath("$.likes").value(2));
        mvc.perform(delete(like).with(person("reader-a"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.liked").value(false)).andExpect(jsonPath("$.likes").value(1));
        mvc.perform(delete(like).with(person("reader-a"))).andExpect(status().isOk());
        mvc.perform(put(READER + "/" + code + "/auto-chess/likes/" + UUID.randomUUID())
                .with(person("reader-a"))).andExpect(status().isNotFound());

        mvc.perform(get(PUBLIC + "/" + code + "/auto-chess")).andExpect(
                jsonPath("$.lineupLikes['" + LINEUP_ID + "'].likes").value(1));
        mvc.perform(get(READER + "/" + code + "/auto-chess").with(person("reader-b")))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.likedLineupIds[0]").value(LINEUP_ID));
    }

    @Test
    void readersSaveLineupsOthersLikeThemAndModeratorsHideThem() throws Exception {
        String modeId = publishedGuide();
        String lineups = PUBLIC + "/" + code + "/auto-chess/lineups";
        String mine = READER + "/" + code + "/auto-chess";
        String own = mine + "/lineups";
        String body = """
                {"name": "Học đường nhanh", "note": "Lên Violet 2 sao sớm",
                 "units": [{"unitCode": "violet", "carry": true, "row": "BACK", "itemCodes": ["thanh-kiem"]},
                           {"unitCode": "florentino", "carry": false, "row": "FRONT", "itemCodes": []}],
                 "emblems": ["dau-si"]}
                """;

        send(post(own), body.replace("violet", "khong-co"), person("author")).andExpect(
                status().isUnprocessableContent());
        JsonNode saved = json.readTree(send(post(own), body, person("author")).andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString());
        String lineupId = saved.get("id").asText();
        assertThat(saved.get("status").asText()).isEqualTo("VISIBLE");

        mvc.perform(put(mine + "/likes/" + lineupId).with(person("author")))
                .andExpect(status().isUnprocessableContent());
        mvc.perform(put(mine + "/likes/" + lineupId).with(person("fan"))).andExpect(jsonPath("$.likes").value(1));
        send(put(own + "/" + lineupId), body.replace("{\"name\"", "{\"expectedVersion\": 1, \"name\""),
                person("fan")).andExpect(status().isForbidden());

        mvc.perform(get(lineups).param("sort", "popular").param("unit", "violet")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(lineupId)).andExpect(jsonPath("$.items[0].likes").value(1))
                .andExpect(jsonPath("$.items[0].authorSubject").doesNotExist());
        mvc.perform(get(lineups).param("unit", "arduin")).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(lineups).param("sort", "best")).andExpect(status().isBadRequest());
        mvc.perform(get(PUBLIC + "/" + code + "/auto-chess/insights")).andExpect(status().isOk())
                .andExpect(jsonPath("$.lineupCount").value(3)).andExpect(jsonPath("$.communityLineupCount").value(1))
                .andExpect(jsonPath("$.units[0].code").value("florentino"))
                .andExpect(jsonPath("$.units[0].weighted").value(3))
                .andExpect(jsonPath("$.units[1].code").value("violet"));

        String visibility = ADMIN + "/" + modeId + "/auto-chess/community-lineups/" + lineupId + "/visibility";
        send(post(visibility), "{\"expectedVersion\": 1, \"hidden\": true}", publisher())
                .andExpect(status().isUnprocessableContent());
        send(post(visibility), "{\"expectedVersion\": 1, \"hidden\": true, \"reason\": \"Spam\"}", editor())
                .andExpect(status().isForbidden());
        send(post(visibility), "{\"expectedVersion\": 1, \"hidden\": true, \"reason\": \"Spam\"}", publisher())
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("HIDDEN"));

        mvc.perform(get(lineups)).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(put(mine + "/likes/" + lineupId).with(person("other"))).andExpect(status().isNotFound());
        mvc.perform(get(mine).with(person("author"))).andExpect(jsonPath("$.lineups[0].status").value("HIDDEN"));
        mvc.perform(delete(own + "/" + lineupId).param("expectedVersion", "2").with(person("author")))
                .andExpect(status().isNoContent());
        assertThat(jdbc.sql("select count(*) from gamemode.lineup_like where lineup_id = ?::uuid").param(lineupId)
                .query(Long.class).single()).isZero();
    }

    @Test
    void decomposedTextFromAnEditorIsStoredPrecomposed() throws Exception {
        String name = "Chế độ bóng đá";
        String decomposed = Normalizer.normalize(name, Normalizer.Form.NFD);

        JsonNode mode = createMode("che-do-bong-da", decomposed);
        String id = mode.get("id").asText();
        String stored = jdbc.sql("select content ->> 'name' from gamemode.game_mode_revision where mode_id = ?::uuid")
                .param(id).query(String.class).single();

        assertThat(decomposed).isNotEqualTo(name);
        assertThat(mode.at("/content/name").asText()).isEqualTo(name);
        assertThat(stored).isEqualTo(name);
    }

    @Test
    void likesAreRateLimitedPerReader() throws Exception {
        publishedGuide();
        String like = READER + "/" + code + "/auto-chess/likes/" + LINEUP_ID;
        String reader = "busy-" + UUID.randomUUID();
        for (int i = 0; i < 60; i++)
            mvc.perform(put(like).with(person(reader))).andExpect(status().isOk());

        mvc.perform(put(like).with(person(reader))).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("GAME_MODE_RATE_LIMITED"));
        mvc.perform(put(like).with(person("calm-" + UUID.randomUUID()))).andExpect(status().isOk());
    }

    private String publishedGuide() throws Exception {
        String id = publishedMode("AUTO_CHESS");
        JsonNode draft = json.readTree(send(post(ADMIN + "/" + id + "/auto-chess/drafts"),
                "{\"content\": " + GUIDE + "}", editor()).andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString());
        send(post(ADMIN + "/" + id + "/auto-chess/drafts/" + draft.at("/revision/id").asText() + "/publish"),
                "{\"expectedVersion\": 1}", publisher()).andExpect(status().isOk());
        return id;
    }

    private String publishedMode(String guideKind) throws Exception {
        jdbc.sql("TRUNCATE gamemode.lineup_like, gamemode.community_lineup, gamemode.auto_chess_revision, "
                + "gamemode.game_mode_revision, gamemode.game_mode").update();
        JsonNode mode = createMode(code, "Cờ Liên quân");
        String id = mode.get("id").asText();
        String draft = mode.at("/revision/id").asText();
        send(put(ADMIN + "/" + id + "/drafts/" + draft), content(1, null, guideKind), editor())
                .andExpect(status().isOk());
        send(post(ADMIN + "/" + id + "/drafts/" + draft + "/publish"), "{\"expectedVersion\": 2}", publisher())
                .andExpect(status().isOk());
        return id;
    }

    private JsonNode createMode(String modeCode, String name) throws Exception {
        String body = "{\"code\": \"" + modeCode + "\", \"name\": \"" + name + "\", \"group\": \"ENTERTAINMENT\"}";
        return json.readTree(send(post(ADMIN), body, editor()).andExpect(status().isCreated()).andReturn()
                .getResponse().getContentAsString());
    }

    private static String content(long version, String label, String guideKind) {
        return """
                {"expectedVersion": %d, "content": {"name": "Cờ Liên quân", "group": "ENTERTAINMENT", "order": 4,
                 "playersLabel": "8 người", "duration": {"minMinutes": 20, "maxMinutes": 30},
                 "availability": {"status": "LIMITED", "gameLabel": %s}, "guideKind": "%s",
                 "rules": [{"group": "Quy trình cơ bản", "title": "Lối chơi", "body": "- Hạng 1~4 tính là thắng"}]}}
                """.formatted(version, label == null ? "null" : "\"" + label + "\"", guideKind);
    }

    private ResultActions send(MockHttpServletRequestBuilder request, String body, RequestPostProcessor actor)
            throws Exception {
        return mvc.perform(request.contentType(MediaType.APPLICATION_JSON).content(body).with(actor));
    }

    private static RequestPostProcessor editor() {
        return staff("catalog:read", "gamemode:write", "media:write");
    }

    private static RequestPostProcessor publisher() {
        return staff("catalog:read", "gamemode:write", "gamemode:publish");
    }

    private static RequestPostProcessor staff(String... capabilities) {
        return jwt().jwt(token -> token.subject("staff").issuer("https://identity.example"))
                .authorities(Arrays.stream(capabilities).map(SimpleGrantedAuthority::new)
                        .toArray(GrantedAuthority[]::new));
    }

    private static RequestPostProcessor person(String subject) {
        return jwt().jwt(token -> token.subject(subject).issuer("https://identity.example")
                .claim("preferred_username", subject));
    }

    private static RequestPostProcessor service() {
        return jwt().jwt(token -> token.subject("importer").issuer("https://identity.example")
                .claim("client_id", "wiki-importer"));
    }
}
