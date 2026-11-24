package com.wikiaov.community.tournament.internal.web;

import static com.wikiaov.community.testsupport.ApiCalls.ADMIN;
import static com.wikiaov.community.testsupport.ApiCalls.ROOT;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.community.testsupport.ApiCalls;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** What a text can name, for readers (spec 04, references in texts). */
@CommunityApplicationTest
class PublicReferenceApiIntegrationTest {
    private static final String[] EDITOR = {"tournament:read", "tournament:write", "tournament:publish"};
    private static final List<Map<String, String>> SOURCES = List
            .of(Map.of("label", "Rules", "url", "https://example.com"));

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
    void anUnpublishedPageIsNotNamedUntilItIsPublishedAndNoLongerOnceWithdrawn() throws Exception {
        String code = code("circuit");
        var draft = editor(post(ADMIN + "/pages"), Map.of("kind", "CIRCUIT", "code", code, "content",
                Map.of("name", "Named circuit", "shortName", "NC", "biography", "First.\n\nSecond.", "sources",
                        SOURCES)));
        String id = draft.path("id").asString();
        assertThat(named("", id)).isNull();

        var published = editor(post(ADMIN + "/pages/" + id + "/publish"), Map.of("version", 0));
        var name = named("", id);

        assertThat(name.path("kind").asString()).isEqualTo("CIRCUIT");
        assertThat(name.path("shortName").asString()).isEqualTo("NC");
        assertThat(name.path("path").asString()).isEqualTo("/pages/" + code);
        assertThat(name.has("aliases")).isFalse();
        mvc.perform(get(ROOT + "/references/CIRCUIT/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.summary").value("First."));

        editor(post(ADMIN + "/pages/" + id + "/withdraw"),
                Map.of("version", published.path("version").asLong()));
        assertThat(named("", id)).isNull();
        mvc.perform(get(ROOT + "/references/CIRCUIT/" + id)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TOURNAMENT_RECORD_NOT_FOUND"));
    }

    @Test
    void aPublishedCompetitionNamesItselfItsTeamsItsPlayersAndItsPersonnel() throws Exception {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        String team = record("teams", Map.of("code", code("team"), "name", "Alpha " + suffix, "shortName", "ALP",
                "aliases", List.of("alpha " + suffix + " esports")));
        String other = record("teams", Map.of("code", code("other"), "name", "Beta " + suffix));
        String player = record("players", Map.of("code", code("player"), "nickname", "Nick" + suffix, "fullName",
                "Nguyễn Văn " + suffix, "aliases", List.of("Văn " + suffix, "Nicky")));
        String caster = editor(post(ADMIN + "/pages"), Map.of("kind", "PERSON", "code", code("caster"), "content",
                Map.of("name", "Caster " + suffix, "personRoles", List.of("CASTER")))).path("id").asString();
        var event = new HashMap<String, Object>(Map.of("code", code("cup"), "name", "Cup " + suffix, "region", "VN"));
        event.put("broadcast", List.of(Map.of("pageId", caster, "role", "CASTER")));
        String id = record("tournaments", event);
        record("roster-memberships", Map.of("tournamentId", id, "teamId", team, "playerId", player));
        publish(id, team, other);

        var competition = named("", id);
        var named = named("", team);
        var person = named("/people", player);

        assertThat(competition.path("path").asString()).isEqualTo("/competitions/" + id);
        assertThat(named.path("shortName").asString()).isEqualTo("ALP");
        assertThat(named.path("aliases").get(0).asString()).isEqualTo("alpha " + suffix + " esports");
        assertThat(person.path("name").asString()).isEqualTo("Nick" + suffix);
        assertThat(person.path("aliases")).hasSize(1);
        assertThat(person.path("aliases").get(0).asString()).isEqualTo("Nicky");
        assertThat(person.path("teamIds").get(0).asString()).isEqualTo(team);
        assertThat(named("/people", caster).path("path").asString()).isEqualTo("/people/" + caster);
        mvc.perform(get(ROOT + "/references/PLAYER/" + player))
                .andExpect(jsonPath("$.latest.competition").value("Cup " + suffix))
                .andExpect(jsonPath("$.latest.team.name").value("Alpha " + suffix));
        mvc.perform(get(ROOT + "/references/PERSON/" + caster))
                .andExpect(jsonPath("$.latest.roles[0]").value("CASTER"));
    }

    @Test
    void noAnswerCarriesThePicturesOrRealNamesOfPeople() throws Exception {
        var people = mvc.perform(get(ROOT + "/references/people")).andReturn().getResponse().getContentAsString();

        assertThat(people).doesNotContain("fullName", "photoUrl", "avatarUrl", "imageUrl", "birthDate");
    }

    @Test
    void anUnchangedListIsAnsweredWithNotModifiedAndAPublicationChangesItsTag() throws Exception {
        var first = mvc.perform(get(ROOT + "/references")).andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "max-age=300, public")).andReturn()
                .getResponse().getHeader(HttpHeaders.ETAG);
        mvc.perform(get(ROOT + "/references").header(HttpHeaders.IF_NONE_MATCH, first))
                .andExpect(status().isNotModified());

        var page = editor(post(ADMIN + "/pages"), Map.of("kind", "ORGANIZATION", "code", code("organization"),
                "content", Map.of("name", "Tagged organization", "sources", SOURCES)));
        editor(post(ADMIN + "/pages/" + page.path("id").asString() + "/publish"), Map.of("version", 0));

        mvc.perform(get(ROOT + "/references").header(HttpHeaders.IF_NONE_MATCH, first)).andExpect(status().isOk());
    }

    @Test
    void unknownParametersAndKindsAreRefused() throws Exception {
        mvc.perform(get(ROOT + "/references").param("kind", "TEAM")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
        mvc.perform(get(ROOT + "/references/HERO/" + UUID.randomUUID())).andExpect(status().isBadRequest());
    }

    private void publish(String id, String team, String other) throws Exception {
        var plan = Map.of("sourceUrl", "https://example.com/rules",
                "entrants", List.of(Map.of("teamId", team), Map.of("teamId", other)),
                "stages", List.of(Map.of("code", "GROUP", "name", "Group", "format", "ROUND_ROBIN", "bestOf", 3,
                        "legs", 1, "winPoints", 1, "lossPoints", 0, "advance", 1)));
        var saved = editor(put(ADMIN + "/competitions/" + id), Map.of("version", 0, "content", plan));

        editor(post(ADMIN + "/competitions/" + id + "/publish"),
                Map.of("version", saved.path("version").asLong()));
    }

    /** The entry of a record in a list, or null when the list does not name it. */
    private JsonNode named(String list, String id) throws Exception {
        var answer = json.readTree(mvc.perform(get(ROOT + "/references" + list)).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8));
        for (var item : answer.path("items")) {
            if (item.path("id").asString().equals(id)) {
                return item;
            }
        }
        return null;
    }

    private String record(String collection, Map<String, Object> content) throws Exception {
        return editor(post(ADMIN + "/" + collection), Map.of("content", content)).path("id").asString();
    }

    private JsonNode editor(MockHttpServletRequestBuilder request, Object body) throws Exception {
        return api.send(ApiCalls.as(request, "editor", EDITOR), body, 200);
    }

    private static String code(String prefix) {
        return prefix + "-" + UUID.randomUUID();
    }
}
