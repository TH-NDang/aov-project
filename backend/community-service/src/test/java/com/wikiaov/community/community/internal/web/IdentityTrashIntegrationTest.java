package com.wikiaov.community.community.internal.web;

import static com.wikiaov.community.testsupport.ApiCalls.ADMIN;
import static com.wikiaov.community.testsupport.ApiCalls.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.wikiaov.community.testsupport.ApiCalls;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Teams and players going to the trash beside their pages and the plans that name them, through the HTTP API (spec 04,
 * identities in the trash).
 */
@CommunityApplicationTest
class IdentityTrashIntegrationTest {
    private static final String EDITOR = "editor";
    private static final String[] CAPABILITIES = {"tournament:read", "tournament:write", "tournament:publish"};

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @MockitoBean
    JwtDecoder decoder;

    private ApiCalls api;
    private String suffix;

    @BeforeEach
    void names() {
        api = new ApiCalls(mvc, json);
        suffix = UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    void anUntouchedTeamDraftGoesToTheTrashWithItsTeam() throws Exception {
        var page = teamPage("Draft team", List.of());

        trash("teams", identity(page));

        assertThat(listings(page)).containsOnly(0);
    }

    @Test
    void aTeamDraftInTheTrashCanStillBeRead() throws Exception {
        var page = teamPage("Readable team", List.of());
        trash("teams", identity(page));

        var read = api.send(as(get(ADMIN + "/pages/" + id(page)), EDITOR, CAPABILITIES), null, 200);

        assertThat(read.path("id").asString()).isEqualTo(id(page));
    }

    @Test
    void aTeamDraftInTheTrashCannotBePublished() throws Exception {
        var page = teamPage("Unpublishable team", List.of());
        trash("teams", identity(page));

        var refused = api.send(as(post(ADMIN + "/pages/" + id(page) + "/publish"), EDITOR, CAPABILITIES),
                Map.of("version", page.path("version").asLong()), 409);

        assertThat(refused.path("code").asString()).isEqualTo("TOURNAMENT_RECORD_DELETED");
    }

    @Test
    void aTeamDraftComesBackWhenItsTeamIsRestored() throws Exception {
        var page = teamPage("Restored team", List.of());
        var trashed = trash("teams", identity(page));

        api.send(as(post(ADMIN + "/teams/" + identity(page) + "/restore"), EDITOR, CAPABILITIES),
                Map.of("version", trashed.path("version").asLong()), 200);

        assertThat(listings(page)).containsOnly(1);
    }

    @Test
    void aPublishedPageKeepsItsTeamOutOfTheTrash() throws Exception {
        var page = teamPage("Published team", List.of());
        api.send(as(post(ADMIN + "/pages/" + id(page) + "/publish"), EDITOR, CAPABILITIES),
                Map.of("version", page.path("version").asLong()), 200);

        var impact = impact("teams", identity(page));

        assertThat(impact.path("canDelete").asBoolean()).isFalse();
        assertThat(impact.path("usages").get(0).path("type").asString()).isEqualTo("COMPETITION_PAGE");
    }

    @Test
    void aPlayerNamedInTheRosterOfATeamOutsideTheTrashStaysOutOfIt() throws Exception {
        var player = playerPage("Rostered player");
        teamPage("Holding team", List.of(member(player)));

        var impact = impact("players", identity(player));

        assertThat(impact.path("canDelete").asBoolean()).isFalse();
        assertThat(impact.path("usages").get(0).path("type").asString()).isEqualTo("COMPETITION_PAGE");
    }

    @Test
    void aTeamInTheTrashNoLongerKeepsItsMembersOutOfIt() throws Exception {
        var player = playerPage("Released player");
        var team = teamPage("Trashed team", List.of(member(player)));
        trash("teams", identity(team));

        var impact = impact("players", identity(player));

        assertThat(impact.path("canDelete").asBoolean()).isTrue();
    }

    @Test
    void aTeamInTheTrashIsLeftOutOfTheTeamsOfItsMembers() throws Exception {
        var player = playerPage("Affiliated player");
        var team = teamPage("Former team", List.of(member(player)));
        trash("teams", identity(team));

        var teams = api.send(as(get(ADMIN + "/pages/" + id(player) + "/teams"), EDITOR, CAPABILITIES), null, 200);

        assertThat(teams.size()).isZero();
    }

    @Test
    void aPlanOfATournamentOutsideTheTrashKeepsItsEntrantsOutOfIt() throws Exception {
        String team = registryTeam();
        tournamentWithPlan(Map.of("entrants", List.of(Map.of("teamId", team, "status", "REGISTERED"))));

        var impact = impact("teams", team);

        assertThat(impact.path("canDelete").asBoolean()).isFalse();
        assertThat(impact.path("usages").get(0).path("type").asString()).isEqualTo("COMPETITION_PAGE");
    }

    @Test
    void aPlanOfATournamentInTheTrashNoLongerKeepsItsEntrantsOutOfIt() throws Exception {
        String team = registryTeam();
        String tournament = tournamentWithPlan(
                Map.of("entrants", List.of(Map.of("teamId", team, "status", "REGISTERED"))));
        trash("tournaments", tournament);

        var impact = impact("teams", team);

        assertThat(impact.path("canDelete").asBoolean()).isTrue();
    }

    @Test
    void aPlanInTheTrashStillKeepsItsOrganizerPageFromBeingDeletedForGood() throws Exception {
        var organizer = api.send(as(post(ADMIN + "/pages"), EDITOR, CAPABILITIES), Map.of("kind", "ORGANIZATION",
                "code", "organizer-" + suffix, "content", Map.of("name", "Organizer " + suffix)), 200);
        String tournament = tournamentWithPlan(Map.of("organizerPageId", id(organizer)));
        trash("tournaments", tournament);

        var refused = api.send(as(post(ADMIN + "/pages/" + id(organizer) + "/delete"), EDITOR, CAPABILITIES),
                Map.of("version", organizer.path("version").asLong()), 409);

        assertThat(refused.path("detail").asString()).isEqualTo("A competition uses this page.");
    }

    /** A team page with its own new identity; it has a source so that it can be published. */
    private JsonNode teamPage(String name, List<Map<String, Object>> roster) throws Exception {
        var content = new HashMap<String, Object>();
        content.put("name", name + " " + suffix);
        content.put("sources", List.of(Map.of("label", "Source", "url", "https://example.com")));
        content.put("roster", roster);
        return api.send(as(post(ADMIN + "/pages"), EDITOR, CAPABILITIES),
                Map.of("kind", "TEAM", "code", "team-" + UUID.randomUUID(), "content", content), 200);
    }

    private JsonNode playerPage(String name) throws Exception {
        return api.send(as(post(ADMIN + "/pages"), EDITOR, CAPABILITIES), Map.of("kind", "PLAYER", "code",
                "player-" + UUID.randomUUID(), "content", Map.of("name", name + " " + suffix)), 200);
    }

    private static Map<String, Object> member(JsonNode player) {
        return Map.of("pageId", id(player), "name", player.path("content").path("name").asString(), "role", "Mid");
    }

    private String registryTeam() throws Exception {
        return api.send(as(post(ADMIN + "/teams"), EDITOR, CAPABILITIES),
                Map.of("content", Map.of("code", "entrant-" + UUID.randomUUID(), "name", "Entrant " + suffix)), 200)
                .path("id").asString();
    }

    private String tournamentWithPlan(Map<String, Object> plan) throws Exception {
        String tournament = api.send(as(post(ADMIN + "/tournaments"), EDITOR, CAPABILITIES), Map.of("content",
                Map.of("code", "season-" + UUID.randomUUID(), "name", "Season " + suffix, "region", "VN")), 200)
                .path("id").asString();
        api.send(as(put(ADMIN + "/competitions/" + tournament), EDITOR, CAPABILITIES),
                Map.of("version", 0, "content", plan), 200);
        return tournament;
    }

    private JsonNode impact(String kind, String id) throws Exception {
        return api.send(as(get(ADMIN + "/" + kind + "/" + id + "/deletion-impact"), EDITOR, CAPABILITIES), null, 200);
    }

    private JsonNode trash(String kind, String id) throws Exception {
        long version = impact(kind, id).path("version").asLong();
        return api.send(as(post(ADMIN + "/" + kind + "/" + id + "/delete"), EDITOR, CAPABILITIES),
                Map.of("version", version), 200);
    }

    /** How many times the page shows in the Admin directory: by name, by activity and by its identity. */
    private List<Integer> listings(JsonNode page) throws Exception {
        String name = page.path("content").path("name").asString();
        return List.of(
                total(get(ADMIN + "/pages").param("q", name)),
                total(get(ADMIN + "/pages").param("q", name).param("sort", "ACTIVE")),
                total(get(ADMIN + "/pages").param("entityIds", identity(page))));
    }

    private int total(MockHttpServletRequestBuilder request) throws Exception {
        return api.send(as(request, EDITOR, CAPABILITIES), null, 200).path("totalElements").asInt();
    }

    private static String id(JsonNode page) {
        return page.path("id").asString();
    }

    private static String identity(JsonNode page) {
        return page.path("entityId").asString();
    }
}
