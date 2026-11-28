package com.wikiaov.community.tournament.internal.web;

import static com.wikiaov.community.testsupport.ApiCalls.ADMIN;
import static com.wikiaov.community.testsupport.ApiCalls.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.wikiaov.community.testsupport.ApiCalls;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import com.wikiaov.community.testsupport.CompetitionFixture;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** The owner's hand checks of a tournament's data, which only Admin reads (spec 04, tournament data verification). */
@CommunityApplicationTest
class ContentVerificationIntegrationTest {
    private static final String[] OWNER = {"tournament:read", "tournament:write", "tournament:publish"};
    private static final String[] EDITOR = {"tournament:read", "tournament:write"};

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @MockitoBean
    JwtDecoder decoder;

    private ApiCalls api;

    @BeforeEach
    void calls() {
        api = new ApiCalls(mvc, json);
    }

    @Test
    void aCheckNamesThePartTheVersionAndWhoCheckedIt() throws Exception {
        var competition = CompetitionFixture.draft(api);

        var check = verify(competition.id(), "INFO", "fp1:aaa", "Thông tin giải", "Đối chiếu với Liquipedia", 200);

        assertThat(check.path("part").asString()).isEqualTo("INFO");
        assertThat(check.path("contentToken").asString()).isEqualTo("fp1:aaa");
        assertThat(check.path("label").asString()).isEqualTo("Thông tin giải");
        assertThat(check.path("note").asString()).isEqualTo("Đối chiếu với Liquipedia");
        assertThat(check.path("verifiedByName").asString()).isEqualTo("owner");
        assertThat(check.path("verifiedAt").isMissingNode()).isFalse();
        assertThat(ids(list(competition.id()))).containsExactly(check.path("id").asString());
    }

    @Test
    void checkingTheSameVersionAgainRefreshesItsCheck() throws Exception {
        var competition = CompetitionFixture.draft(api);
        var first = verify(competition.id(), "FORMAT", "fp1:bbb", null, "Lần đầu", 200);

        var again = verify(competition.id(), "FORMAT", "fp1:bbb", null, "  ", 200);

        assertThat(again.path("id").asString()).isEqualTo(first.path("id").asString());
        assertThat(again.path("note").isNull()).isTrue();
        assertThat(list(competition.id())).hasSize(1);
    }

    @Test
    void everyVersionAndPartKeepsItsOwnCheckAndTheSummaryCountsParts() throws Exception {
        var competition = CompetitionFixture.draft(api);
        verify(competition.id(), "INFO", "fp1:old", null, null, 200);
        verify(competition.id(), "INFO", "fp1:new", null, null, 200);
        verify(competition.id(), "TEAM:" + competition.team("BLUE"), "fp1:ccc", null, null, 200);
        verify(competition.id(), "SCHEDULE:GROUP_A", "fp1:ddd", null, null, 200);

        var checks = list(competition.id());

        assertThat(parts(checks)).containsExactly("SCHEDULE:GROUP_A", "TEAM:" + competition.team("BLUE"), "INFO",
                "INFO");
        var summary = summary(competition.id());
        assertThat(summary.path("parts").asLong()).isEqualTo(3);
        assertThat(summary.path("lastVerifiedAt").asString()).isEqualTo(checks.get(0).path("verifiedAt").asString());
        assertThat(summary(CompetitionFixture.draft(api).id())).as("no checks yet").isNull();
    }

    @Test
    void aCheckCanBeTakenBackOnlyFromItsOwnTournament() throws Exception {
        var competition = CompetitionFixture.draft(api);
        var other = CompetitionFixture.draft(api);
        var check = verify(competition.id(), "FINAL", "fp1:eee", null, null, 200);
        String id = check.path("id").asString();

        api.send(as(post(ADMIN + "/competitions/" + other.id() + "/verifications/" + id + "/remove"), "owner",
                OWNER), null, 404);
        api.send(as(post(ADMIN + "/competitions/" + competition.id() + "/verifications/" + id + "/remove"), "owner",
                OWNER), null, 204);

        assertThat(list(competition.id())).isEmpty();
        api.send(as(post(ADMIN + "/competitions/" + competition.id() + "/verifications/" + id + "/remove"), "owner",
                OWNER), null, 404);
    }

    @Test
    void onlySomeoneWhoMayPublishCanCheck() throws Exception {
        var competition = CompetitionFixture.draft(api);
        verify(competition.id(), "INFO", "fp1:fff", null, null, 200);

        api.send(as(post(ADMIN + "/competitions/" + competition.id() + "/verifications"), "editor", EDITOR),
                body("INFO", "fp1:ggg", null, null), 403);
        api.send(as(get(ADMIN + "/competitions/" + competition.id() + "/verifications"), "reader"), null, 403);
        assertThat(api.send(as(get(ADMIN + "/competitions/" + competition.id() + "/verifications"), "editor",
                EDITOR), null, 200)).hasSize(1);
    }

    @Test
    void aCheckOfAnUnknownPartVersionOrTournamentIsRefused() throws Exception {
        var competition = CompetitionFixture.draft(api);

        verify(competition.id(), "ROSTER", "fp1:hhh", null, null, 400);
        verify(competition.id(), "TEAM:saigon-phantom", "fp1:hhh", null, null, 400);
        verify(competition.id(), "SCHEDULE:group a", "fp1:hhh", null, null, 400);
        verify(competition.id(), "INFO", "", null, null, 400);
        verify(competition.id(), "INFO", "fp1 hhh", null, null, 400);
        verify(competition.id(), "INFO", "fp1:" + "a".repeat(130), null, null, 400);
        verify(competition.id(), "INFO", "fp1:hhh", "x".repeat(201), null, 400);
        verify(competition.id(), "INFO", "fp1:hhh", null, "x".repeat(1001), 400);
        verify(UUID.randomUUID().toString(), "INFO", "fp1:hhh", null, null, 404);
        api.send(as(get(ADMIN + "/competitions/" + UUID.randomUUID() + "/verifications"), "owner", OWNER), null,
                404);
        assertThat(list(competition.id())).isEmpty();
    }

    private JsonNode verify(String tournamentId, String part, String token, @Nullable String label,
            @Nullable String note, int status) throws Exception {
        return api.send(as(post(ADMIN + "/competitions/" + tournamentId + "/verifications"), "owner", OWNER),
                body(part, token, label, note), status);
    }

    private List<JsonNode> list(String tournamentId) throws Exception {
        var answer = api.send(as(get(ADMIN + "/competitions/" + tournamentId + "/verifications"), "owner", OWNER),
                null, 200);
        var checks = new ArrayList<JsonNode>();
        answer.forEach(checks::add);
        return checks;
    }

    private @Nullable JsonNode summary(String tournamentId) throws Exception {
        for (var line : api.send(as(get(ADMIN + "/competitions/verifications"), "owner", OWNER), null, 200)) {
            if (line.path("tournamentId").asString().equals(tournamentId)) {
                return line;
            }
        }
        return null;
    }

    private static Map<String, Object> body(String part, String token, @Nullable String label,
            @Nullable String note) {
        var body = new HashMap<String, Object>(Map.of("part", part, "contentToken", token));
        if (label != null) {
            body.put("label", label);
        }
        if (note != null) {
            body.put("note", note);
        }
        return body;
    }

    private static List<String> ids(List<JsonNode> checks) {
        return checks.stream().map(check -> check.path("id").asString()).toList();
    }

    private static List<String> parts(List<JsonNode> checks) {
        return checks.stream().map(check -> check.path("part").asString()).toList();
    }
}
