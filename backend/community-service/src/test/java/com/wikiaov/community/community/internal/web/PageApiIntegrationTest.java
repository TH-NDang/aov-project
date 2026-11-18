package com.wikiaov.community.community.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.wikiaov.community.testsupport.ApiCalls;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

@CommunityApplicationTest
class PageApiIntegrationTest {
    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @Autowired
    JdbcTemplate jdbc;
    @MockitoBean
    JwtDecoder decoder;
    static final String ROOT = "/api/community/v1";

    @Test
    void adminDirectoryFiltersByIdentityAndCountryAndRanksByActivity() throws Exception {
        String marker = "listing" + UUID.randomUUID().toString().substring(0, 8);
        var busy = new HashMap<String, Object>();
        busy.put("name", marker + " Busy");
        busy.put("country", "XK");
        busy.put("personRoles", List.of("COACH"));
        busy.put("history", List.of(Map.of("title", "First stint"), Map.of("title", "Second stint")));
        var quiet = new HashMap<String, Object>();
        quiet.put("name", marker + " Quiet");
        quiet.put("country", "XY");
        quiet.put("personRoles", List.of("COACH"));
        send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "PERSON", "code", marker + "-quiet", "content", quiet));
        send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "PERSON", "code", marker + "-busy", "content", busy));

        var ranked = send(get(ROOT + "/admin/pages").param("q", marker).param("sort", "ACTIVITY"), "editor", true,
                null);
        assertThat(ranked.path("items").get(0).path("code").asText()).isEqualTo(marker + "-busy");
        var named = send(get(ROOT + "/admin/pages").param("q", marker).param("sort", "NAME"), "editor", true, null);
        assertThat(named.path("items").get(0).path("code").asText()).isEqualTo(marker + "-busy");
        var country = send(get(ROOT + "/admin/pages").param("q", marker).param("country", "XY"), "editor", true, null);
        assertThat(country.path("totalElements").asInt()).isEqualTo(1);

        var team = send(post(ROOT + "/admin/pages"), "editor", true, Map.of("kind", "TEAM", "code", marker + "-team",
                "content", Map.of("name", marker + " Team")));
        String identity = team.path("entityId").asText();
        var byIdentity = send(get(ROOT + "/admin/pages").param("entityIds", identity), "editor", true, null);
        assertThat(byIdentity.path("totalElements").asInt()).isEqualTo(1);
        assertThat(byIdentity.path("items").get(0).path("id").asText()).isEqualTo(team.path("id").asText());

        mvc.perform(as(get(ROOT + "/admin/pages").param("sort", "NOPE"), "editor", true))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void teamAffiliationsFollowRosterEditsWithoutLeakingDraftsOrChangingPersonalHistory() throws Exception {
        var person = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "PLAYER", "code", "member-" + UUID.randomUUID(), "content",
                        Map.of("name", "Canonical player", "sources",
                                List.of(Map.of("label", "Source", "url", "https://example.com")),
                                "history", List.of(Map.of("title", "Existing career milestone")))));
        String personId = person.path("id").asText();
        var content = new HashMap<String, Object>();
        content.put("name", "Linked team");
        content.put("sources", List.of(Map.of("label", "Source", "url", "https://example.com")));
        content.put("roster",
                List.of(Map.of("pageId", personId, "name", "Stale name", "role", "Jungle", "status", "Active")));
        var team = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "TEAM", "code", "linked-team-" + UUID.randomUUID(), "content", content));
        String teamId = team.path("id").asText();
        assertThat(team.path("content").path("roster").get(0).path("name").asText()).isEqualTo("Canonical player");
        mvc.perform(as(get(ROOT + "/admin/pages/" + personId + "/teams"), "editor", true))
                .andExpect(jsonPath("$[0].teamPageId").value(teamId))
                .andExpect(jsonPath("$[0].member.role").value("Jungle"));
        mvc.perform(get(ROOT + "/pages/" + personId + "/teams")).andExpect(status().isNotFound());
        mvc.perform(get(ROOT + "/admin/pages/" + personId + "/teams")).andExpect(status().isUnauthorized());
        send(post(ROOT + "/admin/pages/" + personId + "/publish"), "editor", true, Map.of("version", 0));
        mvc.perform(get(ROOT + "/pages/" + personId + "/teams")).andExpect(jsonPath("$.length()").value(0));
        var published = send(post(ROOT + "/admin/pages/" + teamId + "/publish"), "editor", true, Map.of("version", 0));

        content.put("roster",
                List.of(Map.of("pageId", personId, "name", "Stale name", "role", "Support", "status", "Substitute")));
        var saved = send(put(ROOT + "/admin/pages/" + teamId), "editor", true,
                Map.of("version", published.path("version").asLong(), "content", content));
        mvc.perform(as(get(ROOT + "/admin/pages/" + personId + "/teams"), "editor", true))
                .andExpect(jsonPath("$[0].member.role").value("Support"));
        mvc.perform(get(ROOT + "/pages/" + personId + "/teams"))
                .andExpect(jsonPath("$[0].member.role").value("Jungle"));
        mvc.perform(as(get(ROOT + "/admin/pages/" + personId), "editor", true))
                .andExpect(jsonPath("$.content.history[0].title").value("Existing career milestone"))
                .andExpect(jsonPath("$.version").value(1));
        send(post(ROOT + "/admin/pages/" + teamId + "/publish"), "editor", true,
                Map.of("version", saved.path("version").asLong()));
        mvc.perform(get(ROOT + "/pages/" + personId + "/teams"))
                .andExpect(jsonPath("$[0].member.role").value("Support"));
    }

    @Test
    void rosterEntriesKeepTheirLaneAndStandingBesideTheirWording() throws Exception {
        var content = new HashMap<String, Object>();
        content.put("name", "Coded team");
        content.put("roster", List.of(
                Map.of("name", "Jungler", "role", "Đi rừng · Đội trưởng", "status", "Chính thức · AOG 2026",
                        "lane", "JUNGLE", "standing", "ACTIVE", "captain", true),
                Map.of("name", "Coach", "role", "Huấn luyện viên", "standing", "STAFF"),
                Map.of("name", "Trialist", "role", "Đường giữa", "status", "Thử việc")));

        var roster = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "TEAM", "code", "coded-" + UUID.randomUUID(), "content", content)).path("content")
                .path("roster");

        assertThat(roster.get(0).path("lane").asText()).isEqualTo("JUNGLE");
        assertThat(roster.get(0).path("standing").asText()).isEqualTo("ACTIVE");
        assertThat(roster.get(0).path("role").asText()).isEqualTo("Đi rừng · Đội trưởng");
        assertThat(roster.get(0).path("captain").asBoolean()).isTrue();
        assertThat(roster.get(1).path("standing").asText()).isEqualTo("STAFF");
        assertThat(roster.get(1).path("captain").asBoolean()).isFalse();
        assertThat(roster.get(2).path("lane").isNull()).isTrue();
        assertThat(roster.get(2).path("standing").isNull()).isTrue();
    }

    @Test
    void aStaffMemberWhoPlaysALaneIsRejected() throws Exception {
        var content = Map.of("name", "Confused team", "roster", List.of(
                Map.of("name", "Coach", "role", "Huấn luyện viên", "lane", "MID", "standing", "STAFF")));

        mvc.perform(as(post(ROOT + "/admin/pages"), "editor", true).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(
                        Map.of("kind", "TEAM", "code", "confused-" + UUID.randomUUID(), "content", content))))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("PAGE_INVALID_CONTENT"));
    }

    @Test
    void linkedDraftPeopleCannotBeDeletedAndRostersRejectNonPersonProfiles() throws Exception {
        var person = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "PERSON", "code", "coach-" + UUID.randomUUID(), "content",
                        Map.of("name", "Coach", "personRoles", List.of("COACH"))));
        String personId = person.path("id").asText();
        var content = new HashMap<String, Object>();
        content.put("name", "Roster team");
        content.put("roster", List.of(Map.of("pageId", personId, "name", "Coach", "role", "Coach")));
        var team = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "TEAM", "code", "roster-team-" + UUID.randomUUID(), "content", content));
        String teamId = team.path("id").asText();
        mvc.perform(as(post(ROOT + "/admin/pages/" + personId + "/delete"), "editor", true)
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isConflict());
        content.put("roster", List.of(Map.of("pageId", teamId, "name", "Wrong kind", "role", "Coach")));
        mvc.perform(as(put(ROOT + "/admin/pages/" + teamId), "editor", true).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", 0, "content", content))))
                .andExpect(status().isUnprocessableEntity());
        content.put("roster", List.of());
        send(put(ROOT + "/admin/pages/" + teamId), "editor", true, Map.of("version", 0, "content", content));
        mvc.perform(as(get(ROOT + "/admin/pages/" + personId + "/teams"), "editor", true))
                .andExpect(jsonPath("$.length()").value(0));
        send(post(ROOT + "/admin/pages/" + personId + "/delete"), "editor", true, Map.of("version", 0));
    }

    @Test
    void personnelRolesShareOneProfileAndPublicFiltersUseOnlyPublishedRoles() throws Exception {
        String code = "person-" + UUID.randomUUID();
        var content = new HashMap<String, Object>();
        content.put("name", "Example Coach and Caster");
        content.put("personRoles", List.of("COACH", "CASTER"));
        content.put("sources", List.of(Map.of("label", "Event", "url", "https://example.com/event")));
        var created = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "PERSON", "code", code, "content", content));
        String id = created.path("id").asText();
        assertThat(created.path("entityId").isNull()).isTrue();
        for (String group : List.of("COACHING", "BROADCAST")) {
            mvc.perform(as(get(ROOT + "/admin/pages").param("personRole", group).param("q", code), "editor", true))
                    .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.items[0].id").value(id));
            mvc.perform(get(ROOT + "/pages").param("personRole", group).param("q", code))
                    .andExpect(jsonPath("$.totalElements").value(0));
        }
        var published = send(post(ROOT + "/admin/pages/" + id + "/publish"), "editor", true, Map.of("version", 0));
        content.put("personRoles", List.of("HOST"));
        send(put(ROOT + "/admin/pages/" + id), "editor", true,
                Map.of("version", published.path("version").asLong(), "content", content));
        mvc.perform(get(ROOT + "/pages").param("personRole", "COACHING").param("q", code))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get(ROOT + "/pages").param("personRole", "HOST").param("q", code))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(as(get(ROOT + "/admin/pages").param("personRole", "HOST").param("q", code), "editor", true))
                .andExpect(jsonPath("$.items[0].id").value(id));
        mvc.perform(as(get(ROOT + "/admin/pages").param("personRole", "COACHING").param("q", code), "editor", true))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(ROOT + "/pages").param("personRole", "OWNER"))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void playersCanAlsoHaveBroadcastRolesWithoutAnotherProfile() throws Exception {
        String code = "player-talent-" + UUID.randomUUID();
        var created = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "PLAYER", "code", code, "content",
                        Map.of("name", "Guest player", "personRoles", List.of("GUEST_ANALYST"))));
        assertThat(created.path("entityId").asText()).isNotBlank();
        for (String filter : List.of("kind=PLAYER", "personRole=BROADCAST")) {
            mvc.perform(as(get(ROOT + "/admin/pages?" + filter).param("q", code), "editor", true))
                    .andExpect(jsonPath("$.totalElements").value(1))
                    .andExpect(jsonPath("$.items[0].id").value(created.path("id").asText()));
        }
    }

    @Test
    void personnelValidationRejectsMissingUnknownDuplicateAndOrganizationRoles() throws Exception {
        for (var roles : List.of(List.of(), List.of("UNKNOWN"), List.of("COACH", "COACH"))) {
            mvc.perform(as(post(ROOT + "/admin/pages"), "editor", true).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("kind", "PERSON", "code", "invalid-" + UUID.randomUUID(),
                            "content", Map.of("name", "Invalid roles", "personRoles", roles)))))
                    .andExpect(status().isUnprocessableEntity());
        }
        mvc.perform(as(post(ROOT + "/admin/pages"), "editor", true).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("kind", "ORGANIZATION", "code", "invalid-" + UUID.randomUUID(),
                        "content", Map.of("name", "Organization", "personRoles", List.of("COACH"))))))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(as(post(ROOT + "/admin/pages"), "editor", true).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("kind", "PERSON", "code", "invalid-" + UUID.randomUUID(),
                        "entityId", UUID.randomUUID(), "content",
                        Map.of("name", "Coach", "personRoles", List.of("COACH"))))))
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void claimsDoNotExposeDraftsOrGrantUnrelatedAccountsPageAuthority() throws Exception {
        var content = new HashMap<String, Object>();
        content.put("name", "Example Team");
        content.put("sources", List.of(Map.of("label", "Official", "url", "https://example.com/team")));
        var created = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "TEAM", "code", "team-" + UUID.randomUUID(), "content", content));
        String id = created.path("id").asText();
        assertThat(created.path("entityId").asText()).isNotBlank();
        mvc.perform(get(ROOT + "/pages/" + id)).andExpect(status().isNotFound());
        mvc.perform(get(ROOT + "/me/claims")).andExpect(status().isUnauthorized());
        var published = send(post(ROOT + "/admin/pages/" + id + "/publish"), "editor", true,
                Map.of("version", created.path("version").asLong()));
        var claim = send(post(ROOT + "/me/pages/" + id + "/claims"), "representative", false,
                Map.of("evidence", "Private verification evidence"));
        mvc.perform(as(get(ROOT + "/admin/page-claims"), "representative", false)).andExpect(status().isForbidden());
        var decision = Map.of("version", 0, "approve", true, "resolution", "Verified through official channel");
        mvc.perform(
                as(post(ROOT + "/admin/page-claims/" + claim.path("id").asText() + "/decision"), "representative", true)
                        .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(decision)))
                .andExpect(status().isUnprocessableEntity());
        send(post(ROOT + "/admin/page-claims/" + claim.path("id").asText() + "/decision"), "reviewer", true, decision);
        mvc.perform(get(ROOT + "/pages/" + id)).andExpect(jsonPath("$.represented").value(true))
                .andExpect(jsonPath("$.evidence").doesNotExist());
        content.put("name", "Unpublished change");
        var draft = send(put(ROOT + "/admin/pages/" + id), "editor", true,
                Map.of("version", published.path("version").asLong(), "content", content));
        var presented = send(put(ROOT + "/me/pages/" + id + "/presentation"), "representative", false,
                Map.of("version", draft.path("version").asLong(), "content",
                        Map.of("biography", "Official introduction", "links", List.of())));
        assertThat(presented.path("content").path("name").asText()).isEqualTo("Example Team");
        mvc.perform(
                as(post(ROOT + "/me/pages/" + id + "/posts"), "outsider", false).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Impersonation\",\"asPage\":true,\"publish\":true}"))
                .andExpect(status().isForbidden());
        send(post(ROOT + "/me/pages/" + id + "/follow"), "fan", false, Map.of("following", true));
        var posted = send(post(ROOT + "/me/pages/" + id + "/posts"), "representative", false,
                Map.of("body", "Official news", "asPage", true, "publish", true));
        mvc.perform(as(get(ROOT + "/me/notifications"), "fan", false)).andExpect(jsonPath("$.totalElements").value(1));
        send(post(ROOT + "/me/posts/" + posted.path("id").asText() + "/comments"), "fan", false,
                Map.of("body", "Hello", "asPage", false));
        var invitation = send(post(ROOT + "/me/pages/" + id + "/invitations"), "representative", false,
                Map.of("role", "EDITOR"));
        send(post(ROOT + "/me/invitations/accept"), "delegate", false,
                Map.of("token", invitation.path("token").asText()));
        mvc.perform(as(post(ROOT + "/me/invitations/accept"), "other", false).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("token", invitation.path("token").asText()))))
                .andExpect(status().isUnprocessableEntity());
        var memberList = send(get(ROOT + "/me/pages/" + id + "/members"), "representative", false, null);
        String ownerId = "";
        for (var member : memberList) {
            if (member.path("role").asText().equals("OWNER")) {
                ownerId = member.path("id").asText();
            }
        }
        send(post(ROOT + "/me/pages/" + id + "/members/" + ownerId + "/revoke"), "reviewer", true, null);
        mvc.perform(get(ROOT + "/pages/" + id)).andExpect(status().isOk())
                .andExpect(jsonPath("$.represented").value(false));
        mvc.perform(
                as(post(ROOT + "/me/pages/" + id + "/posts"), "delegate", false).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"No longer authorized\",\"asPage\":true,\"publish\":true}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void personalDraftsStayPrivateAndModeratedPostsCannotBeRepublishedByTheAuthor() throws Exception {
        var page = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "ORGANIZATION", "code", "org-" + UUID.randomUUID(),
                        "content", Map.of("name", "Test organization", "sources",
                                List.of(Map.of("label", "Official", "url", "https://example.com")))));
        String id = page.path("id").asText();
        send(post(ROOT + "/admin/pages/" + id + "/publish"), "editor", true, Map.of("version", 0));
        var draft = send(post(ROOT + "/me/pages/" + id + "/posts"), "author", false,
                Map.of("body", "Private draft", "asPage", false, "publish", false));
        mvc.perform(get(ROOT + "/pages/" + id + "/posts")).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(as(get(ROOT + "/me/pages/" + id + "/feed"), "other", false))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(as(get(ROOT + "/me/pages/" + id + "/feed"), "author", false))
                .andExpect(jsonPath("$.items[0].own").value(true));
        String postId = draft.path("id").asText();
        var published = send(put(ROOT + "/me/pages/" + id + "/posts/" + postId), "author", false,
                Map.of("version", draft.path("version").asLong(), "body", "Published text", "asPage", false, "publish",
                        true));
        mvc.perform(
                as(post(ROOT + "/me/pages/" + id + "/moderate"), "other", false).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("postId", postId, "hidden", true))))
                .andExpect(status().isForbidden());
        send(post(ROOT + "/me/pages/" + id + "/moderate"), "moderator", true, Map.of("postId", postId, "hidden", true));
        mvc.perform(get(ROOT + "/pages/" + id + "/posts")).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(as(put(ROOT + "/me/pages/" + id + "/posts/" + postId), "author", false)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", published.path("version").asLong() + 1, "body",
                        "Bypass", "asPage", false, "publish", true))))
                .andExpect(status().isUnprocessableEntity());
        send(post(ROOT + "/me/pages/" + id + "/moderate"), "moderator", true,
                Map.of("postId", postId, "hidden", false));
        mvc.perform(get(ROOT + "/pages/" + id + "/posts")).andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void publishedPageImagesRemainProtectedAfterChangingTheDraft() throws Exception {
        String asset = UUID.randomUUID().toString();
        var content = new HashMap<String, Object>();
        content.put("name", "Image owner");
        content.put("avatarUrl", "https://cdn.example/assets/" + asset + "/" + UUID.randomUUID() + ".png");
        content.put("sources", List.of(Map.of("label", "Official", "url", "https://example.com")));
        var page = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "ORGANIZATION", "code", "image-" + UUID.randomUUID(), "content", content));
        String id = page.path("id").asText();
        var published = send(post(ROOT + "/admin/pages/" + id + "/publish"), "editor", true, Map.of("version", 0));
        content.put("avatarUrl", "");
        send(put(ROOT + "/admin/pages/" + id), "editor", true,
                Map.of("version", published.path("version").asLong(), "content", content));
        mvc.perform(as(get(ROOT + "/admin/media-assets/" + asset + "/usage"), "editor", true))
                .andExpect(jsonPath("$.references").value(1));
        mvc.perform(as(post(ROOT + "/admin/media-assets/" + asset + "/retire"), "editor", true))
                .andExpect(status().isConflict());
    }

    @Test
    void aPageLargerThanTheListLimitIsAnInvalidQueryParameter() throws Exception {
        mvc.perform(get(ROOT + "/pages").param("size", "101")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"))
                .andExpect(jsonPath("$.errors[0].path").value("size"));
    }

    @Test
    void anUnknownQueryParameterOfAPublicPageReadIsAnInvalidQueryParameter() throws Exception {
        mvc.perform(get(ROOT + "/pages?unexpected=true")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
        mvc.perform(get(ROOT + "/pages/by-code/anything?unexpected=true")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_QUERY_PARAMETER"));
    }

    @Test
    void onlyUntouchedDraftsCanBeDeletedAndOfficialLinksAreKept() throws Exception {
        String code = "draft-organizer-" + UUID.randomUUID();
        var content = new HashMap<String, Object>();
        content.put("name", "Draft organizer");
        content.put("links",
                List.of(Map.of("label", "YouTube", "url", "https://www.youtube.com/@example", "official", true)));
        content.put("sources", List.of(Map.of("label", "Official", "url", "https://example.com")));
        var draft = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "ORGANIZATION", "code", code, "content", content));
        String id = draft.path("id").asText();
        assertThat(draft.path("content").path("links").get(0).path("official").asBoolean()).isTrue();

        mvc.perform(as(post(ROOT + "/admin/pages/" + id + "/delete"), "editor", true)
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":99}"))
                .andExpect(status().isConflict());
        mvc.perform(as(post(ROOT + "/admin/pages/" + id + "/delete"), "fan", false)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + draft.path("version").asLong() + "}"))
                .andExpect(status().isForbidden());
        send(post(ROOT + "/admin/pages/" + id + "/delete"), "editor", true,
                Map.of("version", draft.path("version").asLong()));
        mvc.perform(as(get(ROOT + "/admin/pages/" + id), "editor", true)).andExpect(status().isNotFound());

        var reused = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "ORGANIZATION", "code", code, "content", content));
        String reusedId = reused.path("id").asText();
        var published = send(post(ROOT + "/admin/pages/" + reusedId + "/publish"), "publisher", true,
                Map.of("version", reused.path("version").asLong()));
        var withdrawn = send(post(ROOT + "/admin/pages/" + reusedId + "/withdraw"), "publisher", true,
                Map.of("version", published.path("version").asLong()));
        mvc.perform(as(post(ROOT + "/admin/pages/" + reusedId + "/delete"), "editor", true)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + withdrawn.path("version").asLong() + "}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PAGE_CONFLICT"));
    }

    @Test
    void ownerlessPagesAreHandedOverWithAOneTimeCode() throws Exception {
        var content = Map.of("name", "Official channel", "sources",
                List.of(Map.of("label", "Official", "url", "https://example.com")));
        var draft = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "ORGANIZATION", "code", "channel-" + UUID.randomUUID(), "content", content));
        String id = draft.path("id").asText();
        String handover = ROOT + "/admin/pages/" + id + "/handover";

        mvc.perform(as(post(handover), "publisher", true)).andExpect(status().isConflict());
        send(post(ROOT + "/admin/pages/" + id + "/publish"), "publisher", true,
                Map.of("version", draft.path("version").asLong()));
        mvc.perform(as(post(handover), "fan", false)).andExpect(status().isForbidden());
        mvc.perform(as(get(handover), "publisher", true)).andExpect(jsonPath("$.pending").value(false));

        var replaced = send(post(handover), "publisher", true, null);
        var issued = send(post(handover), "publisher", true, null);
        assertThat(issued.path("id").isMissingNode()).isTrue();
        mvc.perform(as(get(handover), "publisher", true)).andExpect(jsonPath("$.pending").value(true))
                .andExpect(jsonPath("$.expiresAt").isNotEmpty());
        accept(replaced.path("token").asText(), "channel-owner").andExpect(status().isUnprocessableEntity());
        accept(issued.path("token").asText(), "channel-owner").andExpect(status().isOk())
                .andExpect(jsonPath("$.pageId").value(id));

        mvc.perform(get(ROOT + "/pages/" + id)).andExpect(jsonPath("$.represented").value(true));
        mvc.perform(as(get(ROOT + "/me/pages/" + id + "/members"), "channel-owner", false))
                .andExpect(jsonPath("$[0].role").value("OWNER")).andExpect(jsonPath("$[0].self").value(true));
        mvc.perform(as(get(ROOT + "/me/notifications"), "channel-owner", false))
                .andExpect(jsonPath("$.totalElements").value(1));
        accept(issued.path("token").asText(), "someone-else").andExpect(status().isUnprocessableEntity());
        mvc.perform(as(post(handover), "publisher", true)).andExpect(status().isConflict());
        mvc.perform(as(get(handover), "publisher", true)).andExpect(jsonPath("$.pending").value(false));

        var other = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "ORGANIZATION", "code", "channel-" + UUID.randomUUID(), "content", content));
        String otherHandover = ROOT + "/admin/pages/" + other.path("id").asText() + "/handover";
        send(post(ROOT + "/admin/pages/" + other.path("id").asText() + "/publish"), "publisher", true,
                Map.of("version", other.path("version").asLong()));
        var cancelled = send(post(otherHandover), "publisher", true, null);
        send(post(otherHandover + "/cancel"), "publisher", true, null);
        mvc.perform(as(get(otherHandover), "publisher", true)).andExpect(jsonPath("$.pending").value(false));
        accept(cancelled.path("token").asText(), "channel-owner").andExpect(status().isUnprocessableEntity());
    }

    @Test
    void publishedPostsCountOneLikePerAccount() throws Exception {
        var page = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "ORGANIZATION", "code", "likes-" + UUID.randomUUID(), "content", Map.of("name",
                        "Liked organization", "sources",
                        List.of(Map.of("label", "Official", "url", "https://e.com")))));
        String id = page.path("id").asText();
        send(post(ROOT + "/admin/pages/" + id + "/publish"), "editor", true, Map.of("version", 0));
        var story = send(post(ROOT + "/me/pages/" + id + "/posts"), "author", false,
                Map.of("body", "Match day", "asPage", false, "publish", true));
        var draft = send(post(ROOT + "/me/pages/" + id + "/posts"), "author", false,
                Map.of("body", "Not yet", "asPage", false, "publish", false));
        String like = ROOT + "/me/posts/" + story.path("id").asText() + "/like";
        assertThat(story.path("likes").asLong()).isZero();

        mvc.perform(post(like).contentType(MediaType.APPLICATION_JSON).content("{\"liked\":true}"))
                .andExpect(status().isUnauthorized());
        send(post(like), "fan", false, Map.of("liked", true));
        assertThat(send(post(like), "fan", false, Map.of("liked", true)).path("likes").asLong()).isEqualTo(1);
        assertThat(send(post(like), "other-fan", false, Map.of("liked", true)).path("likes").asLong()).isEqualTo(2);
        mvc.perform(get(ROOT + "/pages/" + id + "/posts")).andExpect(jsonPath("$.items[0].likes").value(2))
                .andExpect(jsonPath("$.items[0].liked").value(false));
        mvc.perform(as(get(ROOT + "/me/pages/" + id + "/feed"), "fan", false))
                .andExpect(jsonPath("$.items[?(@.body == 'Match day')].liked").value(true));
        mvc.perform(as(get(ROOT + "/me/pages/" + id + "/feed"), "stranger", false))
                .andExpect(jsonPath("$.items[0].liked").value(false));

        var unliked = send(post(like), "fan", false, Map.of("liked", false));
        assertThat(unliked.path("liked").asBoolean()).isFalse();
        assertThat(unliked.path("likes").asLong()).isEqualTo(1);
        assertThat(send(post(like), "fan", false, Map.of("liked", false)).path("likes").asLong()).isEqualTo(1);
        mvc.perform(as(post(ROOT + "/me/posts/" + draft.path("id").asText() + "/like"), "fan", false)
                .contentType(MediaType.APPLICATION_JSON).content("{\"liked\":true}")).andExpect(status().isNotFound());
        send(post(ROOT + "/me/pages/" + id + "/moderate"), "moderator", true,
                Map.of("postId", story.path("id").asText(), "hidden", true));
        mvc.perform(as(post(like), "late-fan", false).contentType(MediaType.APPLICATION_JSON)
                .content("{\"liked\":true}")).andExpect(status().isNotFound());
    }

    @Test
    void anonymousReadersFollowTheCrossPageFeedWhileFollowsAndSuggestionsNeedAnAccount() throws Exception {
        String followed = publishedOrganization("Followed organization");
        String other = publishedOrganization("Other organization");
        var news = send(post(ROOT + "/me/pages/" + followed + "/posts"), "feed-writer", false,
                Map.of("body", "Followed news", "asPage", false, "publish", true));
        send(post(ROOT + "/me/pages/" + other + "/posts"), "feed-writer", false,
                Map.of("body", "Other news", "asPage", false, "publish", true));
        send(post(ROOT + "/me/pages/" + other + "/posts"), "feed-writer", false,
                Map.of("body", "Draft news", "asPage", false, "publish", false));
        String newsId = news.path("id").asText();
        send(post(ROOT + "/me/posts/" + newsId + "/comments"), "feed-reader", false,
                Map.of("body", "First", "asPage", false));
        send(post(ROOT + "/me/posts/" + newsId + "/like"), "feed-reader", false, Map.of("liked", true));

        mvc.perform(get(ROOT + "/posts?size=100")).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].post.body").value("Other news"))
                .andExpect(jsonPath("$.items[?(@.post.body == 'Followed news')].post.comments").value(1))
                .andExpect(jsonPath("$.items[?(@.post.body == 'Followed news')].post.likes").value(1))
                .andExpect(jsonPath("$.items[?(@.post.body == 'Followed news')].post.liked").value(false))
                .andExpect(jsonPath("$.items[?(@.post.body == 'Followed news')].page.name")
                        .value("Followed organization"))
                .andExpect(jsonPath("$.items[?(@.post.body == 'Draft news')]").isEmpty());
        mvc.perform(get(ROOT + "/pages/" + followed + "/posts")).andExpect(jsonPath("$.items[0].comments").value(1));
        mvc.perform(get(ROOT + "/posts?following=true")).andExpect(status().isBadRequest());
        for (var path : List.of("/me/feed", "/me/follows", "/me/suggestions", "/me/notifications/unread")) {
            mvc.perform(get(ROOT + path)).andExpect(status().isUnauthorized());
        }

        send(post(ROOT + "/me/pages/" + followed + "/follow"), "feed-reader", false, Map.of("following", true));
        var following = send(get(ROOT + "/me/feed?following=true&size=100"), "feed-reader", false, null);
        assertThat(following.path("items")).extracting(item -> item.path("post").path("body").asText())
                .containsExactly("Followed news");
        assertThat(following.path("items").get(0).path("post").path("liked").asBoolean()).isTrue();
        var everything = send(get(ROOT + "/me/feed?size=100"), "feed-writer", false, null);
        assertThat(everything.path("items")).extracting(item -> item.path("post").path("body").asText())
                .contains("Followed news", "Other news").doesNotContain("Draft news");
        mvc.perform(as(get(ROOT + "/me/follows"), "feed-reader", false))
                .andExpect(jsonPath("$.totalElements").value(1)).andExpect(jsonPath("$.items[0].id").value(followed));
        var suggestions = send(get(ROOT + "/me/suggestions?size=100"), "feed-reader", false, null);
        assertThat(suggestions.path("items")).extracting(item -> item.path("id").asText()).contains(other)
                .doesNotContain(followed);

        var current = send(get(ROOT + "/admin/pages/" + other), "editor", true, null);
        send(post(ROOT + "/admin/pages/" + other + "/withdraw"), "publisher", true,
                Map.of("version", current.path("version").asLong()));
        mvc.perform(get(ROOT + "/posts?size=100")).andExpect(jsonPath("$.items[?(@.post.body == 'Other news')]")
                .isEmpty());

        mvc.perform(as(get(ROOT + "/me/notifications/unread"), "feed-writer", false))
                .andExpect(jsonPath("$.unread").value(1));
        send(post(ROOT + "/me/notifications/read-all"), "feed-writer", false, null);
        mvc.perform(as(get(ROOT + "/me/notifications/unread"), "feed-writer", false))
                .andExpect(jsonPath("$.unread").value(0));
        mvc.perform(as(get(ROOT + "/me/notifications"), "feed-writer", false))
                .andExpect(jsonPath("$.items[0].read").value(true));
    }

    private String publishedOrganization(String name) throws Exception {
        var page = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "ORGANIZATION", "code", "feed-" + UUID.randomUUID(), "content", Map.of("name", name,
                        "sources", List.of(Map.of("label", "Official", "url", "https://example.com")))));
        String id = page.path("id").asText();
        send(post(ROOT + "/admin/pages/" + id + "/publish"), "editor", true,
                Map.of("version", page.path("version").asLong()));
        return id;
    }

    @Test
    void postsCarryKindsImagesAndOnePinPerPage() throws Exception {
        String owner = "kinds-owner-" + UUID.randomUUID();
        String id = ownedOrganization("Kinds " + UUID.randomUUID(), owner);
        String posts = ROOT + "/me/pages/" + id + "/posts";
        String word = "kw" + UUID.randomUUID().toString().substring(0, 8);
        String asset = UUID.randomUUID().toString();
        String image = "https://cdn.example/assets/" + asset + "/" + UUID.randomUUID() + ".png";

        perform(post(posts), owner, Map.of("kind", "NEWS", "body", "No title", "asPage", true, "publish", true))
                .andExpect(status().isUnprocessableEntity());
        perform(post(posts), owner, Map.of("kind", "VIDEO", "body", "", "asPage", true, "publish", true))
                .andExpect(status().isUnprocessableEntity());
        perform(post(posts), owner, Map.of("kind", "PODCAST", "body", "Unknown", "asPage", true, "publish", true))
                .andExpect(status().isUnprocessableEntity());
        perform(post(posts), owner, Map.of("body", "Too many", "imageUrls", Collections.nCopies(5, image), "asPage",
                true, "publish", true)).andExpect(status().isUnprocessableEntity());

        var news = send(post(posts), owner, false,
                Map.of("kind", "NEWS", "title", "Lịch " + word, "body", "Tuần 3", "asPage", true, "publish", true));
        var video = send(post(posts), owner, false, Map.of("kind", "VIDEO", "body", "", "videoUrl",
                "https://www.youtube.com/watch?v=example", "imageUrls", List.of(image), "asPage", true, "publish",
                true));
        assertThat(news.path("kind").asText()).isEqualTo("NEWS");
        assertThat(video.path("imageUrls").get(0).asText()).isEqualTo(image);
        mvc.perform(as(get(ROOT + "/admin/media-assets/" + asset + "/usage"), "editor", true))
                .andExpect(jsonPath("$.references").value(1));

        mvc.perform(get(ROOT + "/posts?kind=VIDEO&size=100"))
                .andExpect(jsonPath("$.items[?(@.post.kind != 'VIDEO')]").isEmpty());
        mvc.perform(get(ROOT + "/posts?q=" + word)).andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].post.id").value(news.path("id").asText()));
        mvc.perform(get(ROOT + "/posts?q=%25")).andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(ROOT + "/posts?kind=PODCAST")).andExpect(status().isUnprocessableEntity());

        String pin = posts + "/%s/pin";
        send(post(pin.formatted(news.path("id").asText())), owner, false, Map.of("pinned", true));
        mvc.perform(get(ROOT + "/pages/" + id + "/posts"))
                .andExpect(jsonPath("$.items[0].id").value(news.path("id").asText()))
                .andExpect(jsonPath("$.items[0].pinned").value(true));
        send(post(pin.formatted(video.path("id").asText())), owner, false, Map.of("pinned", true));
        mvc.perform(get(ROOT + "/pages/" + id + "/posts"))
                .andExpect(jsonPath("$.items[0].id").value(video.path("id").asText()))
                .andExpect(jsonPath("$.items[?(@.pinned == true)].id").value(video.path("id").asText()));
        perform(post(pin.formatted(news.path("id").asText())), "outsider-" + UUID.randomUUID(), Map.of("pinned", true))
                .andExpect(status().isForbidden());
        var personal = send(post(posts), "fan-" + UUID.randomUUID(), false,
                Map.of("body", "Fan post", "asPage", false, "publish", true));
        perform(post(pin.formatted(personal.path("id").asText())), owner, Map.of("pinned", true))
                .andExpect(status().isUnprocessableEntity());

        send(post(ROOT + "/me/pages/" + id + "/moderate"), "moderator", true,
                Map.of("postId", video.path("id").asText(), "hidden", true));
        mvc.perform(get(ROOT + "/pages/" + id + "/posts"))
                .andExpect(jsonPath("$.items[?(@.pinned == true)]").isEmpty());
    }

    @Test
    void liveBroadcastsNotifyFollowersOnceAndEditorsCanEndThem() throws Exception {
        String owner = "live-owner-" + UUID.randomUUID();
        String fan = "live-fan-" + UUID.randomUUID();
        String id = ownedOrganization("Live " + UUID.randomUUID(), owner);
        String live = ROOT + "/me/pages/" + id + "/live";
        send(post(ROOT + "/me/pages/" + id + "/follow"), fan, false, Map.of("following", true));

        perform(put(live), fan, Map.of("url", "https://www.youtube.com/live/abc", "title", "Tuần 3"))
                .andExpect(status().isForbidden());
        perform(put(live), owner, Map.of("url", "ftp://example.com/live", "title", "Tuần 3"))
                .andExpect(status().isUnprocessableEntity());
        send(put(live), owner, false, Map.of("url", "https://www.youtube.com/live/abc", "title", "Tuần 3"));
        var started = send(get(ROOT + "/pages/" + id), fan, false, null).path("live");
        assertThat(started.path("title").asText()).isEqualTo("Tuần 3");
        mvc.perform(get(ROOT + "/live?size=100"))
                .andExpect(jsonPath("$.items[?(@.id == '" + id + "')].live.url")
                        .value("https://www.youtube.com/live/abc"));

        send(put(live), owner, false, Map.of("url", "https://www.youtube.com/live/def", "title", "Tuần 3 · hiệp 2"));
        var updated = send(get(ROOT + "/pages/" + id), fan, false, null).path("live");
        assertThat(updated.path("url").asText()).isEqualTo("https://www.youtube.com/live/def");
        assertThat(updated.path("startedAt").asText()).isEqualTo(started.path("startedAt").asText());
        mvc.perform(as(get(ROOT + "/me/notifications"), fan, false)).andExpect(jsonPath("$.totalElements").value(1));

        perform(post(ROOT + "/admin/pages/" + id + "/live/end"), "not-editor-" + UUID.randomUUID(), null)
                .andExpect(status().isForbidden());
        send(post(ROOT + "/admin/pages/" + id + "/live/end"), "editor", true, null);
        mvc.perform(get(ROOT + "/pages/" + id)).andExpect(jsonPath("$.live").isEmpty());
        mvc.perform(get(ROOT + "/live?size=100")).andExpect(jsonPath("$.items[?(@.id == '" + id + "')]").isEmpty());

        send(put(ROOT + "/admin/pages/" + id + "/live"), "editor", true,
                Map.of("url", "https://www.facebook.com/live/xyz", "title", "Chung kết"));
        mvc.perform(as(get(ROOT + "/me/notifications"), fan, false)).andExpect(jsonPath("$.totalElements").value(2));
    }

    @Test
    void notificationsCarryAKindAndItsParametersWhileOlderSentencesStayReadable() throws Exception {
        String owner = "kind-owner-" + UUID.randomUUID();
        String fan = "kind-fan-" + UUID.randomUUID();
        String name = "Kinds " + UUID.randomUUID();
        String id = ownedOrganization(name, owner);
        send(post(ROOT + "/me/pages/" + id + "/follow"), fan, false, Map.of("following", true));
        jdbc.update("""
                INSERT INTO community.notification(id, actor, page_id, message, created_at)
                VALUES (?, ?, ?, 'Bài viết của bạn có bình luận mới.', now() - interval '1 day')
                """, UUID.randomUUID(), ApiCalls.ISSUER + "\n" + fan, UUID.fromString(id));

        var news = send(post(ROOT + "/me/pages/" + id + "/posts"), owner, false,
                Map.of("body", "Official news", "asPage", true, "publish", true));
        send(put(ROOT + "/me/pages/" + id + "/live"), owner, false,
                Map.of("url", "https://www.youtube.com/live/abc", "title", "Week 3"));
        send(post(ROOT + "/me/posts/" + news.path("id").asText() + "/comments"), fan, false,
                Map.of("body", "Hello", "asPage", false));

        var heard = send(get(ROOT + "/me/notifications"), fan, false, null).path("items");
        assertThat(heard).extracting(item -> item.path("kind").isNull() ? null : item.path("kind").asText())
                .containsExactly("PAGE_LIVE_STARTED", "PAGE_POST_PUBLISHED", null);
        assertThat(heard.get(0).path("parameters").path("pageName").asText()).isEqualTo(name);
        assertThat(heard.get(0).path("parameters").path("title").asText()).isEqualTo("Week 3");
        assertThat(heard.get(0).has("message")).isFalse();
        assertThat(heard.get(1).path("parameters").path("pageName").asText()).isEqualTo(name);
        assertThat(heard.get(2).path("message").asText()).isEqualTo("Bài viết của bạn có bình luận mới.");
        assertThat(heard.get(2).path("parameters").isEmpty()).isTrue();
        var owned = send(get(ROOT + "/me/notifications"), owner, false, null).path("items");
        assertThat(owned).extracting(item -> item.path("kind").asText())
                .containsExactly("POST_COMMENTED", "PAGE_OWNERSHIP_RECEIVED");
        assertThat(owned.get(0).path("parameters").isEmpty()).isTrue();
    }

    @Test
    void achievementsPublishTheirRankBesideTheirWording() throws Exception {
        var content = new HashMap<String, Object>();
        content.put("name", "Ranked team");
        content.put("sources", List.of(Map.of("label", "Source", "url", "https://example.com")));
        content.put("achievements", List.of(
                Map.of("title", "Winter 2026", "placement", "Champion", "place", 1),
                Map.of("title", "Summer 2026", "placement", "Hạng 5-8", "place", 5, "placeTo", 8),
                Map.of("title", "Winter 2026", "placement", "MVP", "award", true),
                Map.of("title", "Spring 2026", "placement", "Á quân")));
        var team = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "TEAM", "code", "ranked-" + UUID.randomUUID(), "content", content));
        String id = team.path("id").asText();
        send(post(ROOT + "/admin/pages/" + id + "/publish"), "editor", true,
                Map.of("version", team.path("version").asLong()));

        var achievements = send(get(ROOT + "/pages/" + id), "reader", false, null).path("content")
                .path("achievements");
        assertThat(achievements.get(0).path("place").asInt()).isEqualTo(1);
        assertThat(achievements.get(0).path("placement").asText()).isEqualTo("Champion");
        assertThat(achievements.get(1).path("place").asInt()).isEqualTo(5);
        assertThat(achievements.get(1).path("placeTo").asInt()).isEqualTo(8);
        assertThat(achievements.get(2).path("award").asBoolean()).isTrue();
        assertThat(achievements.get(2).path("place").isNull()).isTrue();
        assertThat(achievements.get(3).path("place").isNull()).isTrue();
        assertThat(achievements.get(3).path("award").isNull()).isTrue();
    }

    @Test
    void achievementRanksThatCannotHappenAreRejected() throws Exception {
        var impossible = List.<Map<String, Object>>of(
                Map.of("title", "Cup", "placement", "Zeroth", "place", 0),
                Map.of("title", "Cup", "placement", "Hạng 5", "place", 5, "placeTo", 5),
                Map.of("title", "Cup", "placement", "Hạng 5-8", "placeTo", 8),
                Map.of("title", "Cup", "placement", "MVP", "place", 1, "award", true));

        for (var achievement : impossible) {
            var content = Map.of("name", "Impossible team", "achievements", List.of(achievement));
            mvc.perform(as(post(ROOT + "/admin/pages"), "editor", true).contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(
                            Map.of("kind", "TEAM", "code", "impossible-" + UUID.randomUUID(), "content", content))))
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.code").value("PAGE_INVALID_CONTENT"));
        }
    }

    /** A published organization whose owner received the page through a handover code. */
    private String ownedOrganization(String name, String owner) throws Exception {
        String id = publishedOrganization(name);
        var issued = send(post(ROOT + "/admin/pages/" + id + "/handover"), "publisher", true, null);
        accept(issued.path("token").asText(), owner).andExpect(status().isOk());
        return id;
    }

    private ResultActions perform(MockHttpServletRequestBuilder request,
            String actor, Object body) throws Exception {
        as(request, actor, false);
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        return mvc.perform(request);
    }

    private ResultActions accept(String token, String actor) throws Exception {
        return mvc.perform(as(post(ROOT + "/me/invitations/accept"), actor, false)
                .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(Map.of("token", token))));
    }

    private MockHttpServletRequestBuilder as(MockHttpServletRequestBuilder request, String actor, boolean admin) {
        var roles = admin
                ? List.of(new SimpleGrantedAuthority("tournament:read"), new SimpleGrantedAuthority("tournament:write"),
                        new SimpleGrantedAuthority("tournament:publish"))
                : List.<SimpleGrantedAuthority>of();
        return request
                .with(jwt().jwt(token -> token.subject(actor).issuer("https://identity.example").claim("name", actor))
                        .authorities(roles.toArray(GrantedAuthority[]::new)));
    }

    @Test
    void competitionPlanPublishesAnImmutableSnapshotAndMaterializesIdempotently() throws Exception {
        String suffix = UUID.randomUUID().toString();
        var first = send(post(ROOT + "/admin/teams"), "editor", true,
                Map.of("content", Map.of("code", "first-" + suffix, "name", "First")));
        var second = send(post(ROOT + "/admin/teams"), "editor", true,
                Map.of("content", Map.of("code", "second-" + suffix, "name", "Second")));
        String a = first.path("id").asText(), b = second.path("id").asText();
        var organizationContent = new HashMap<String, Object>();
        organizationContent.put("name", "Original organizer");
        organizationContent.put("avatarUrl", "https://example.com/organizer.png");
        organizationContent.put("sources", List.of(Map.of("label", "Official", "url", "https://example.com")));
        var organization = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "ORGANIZATION", "code", "organizer-" + suffix, "content", organizationContent));
        String organizationId = organization.path("id").asText();
        var teamPage = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "TEAM", "code", "team-page-" + suffix, "entityId", a,
                        "content", Map.of("name", "First")));
        var tournament = send(post(ROOT + "/admin/tournaments"), "editor", true,
                Map.of("content", Map.of("code", "season-" + suffix, "name", "Test season", "region", "VN")));
        String id = tournament.path("id").asText();
        var content = new HashMap<String, Object>();
        content.put("sourceUrl", "https://example.com/rules");
        content.put("entrants",
                List.of(Map.of("teamId", a, "status", "REGISTERED"), Map.of("teamId", b, "status", "REGISTERED")));
        content.put("stages", List.of(Map.of("code", "GROUP", "name", "Group", "format", "ROUND_ROBIN", "bestOf", 5,
                "legs", 1, "winPoints", 1, "lossPoints", 0, "advance", 1)));
        content.put("organizerPageId", teamPage.path("id").asText());
        mvc.perform(as(put(ROOT + "/admin/competitions/" + id), "editor", true)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", 0, "content", content))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TOURNAMENT_INVALID_CONTENT"));
        content.put("organizerPageId", organizationId);
        content.put("organizer", "Spoofed organizer name");
        var saved = send(put(ROOT + "/admin/competitions/" + id), "editor", true,
                Map.of("version", 0, "content", content));
        assertThat(saved.path("content").path("plan").path("organizer").asText()).isEqualTo("Original organizer");
        mvc.perform(as(get(ROOT + "/admin/competitions").param("organizerPageId", organizationId), "editor", true))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].id").value(id))
                .andExpect(jsonPath("$.items[0].tournament.name").value("Test season"))
                .andExpect(jsonPath("$.items[0].entrants").value(2))
                .andExpect(jsonPath("$.items[0].publishedAt").isEmpty());
        mvc.perform(as(get(ROOT + "/admin/competitions").param("organizerPageId", organizationId)
                .param("page", "1").param("size", "1"), "editor", true))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items").isEmpty());
        mvc.perform(as(get(ROOT + "/admin/competitions").param("organizerPageId", UUID.randomUUID().toString()),
                "editor", true))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(ROOT + "/admin/competitions").param("organizerPageId", organizationId))
                .andExpect(status().isUnauthorized());
        mvc.perform(as(get(ROOT + "/admin/competitions").param("organizerPageId", organizationId), "fan", false))
                .andExpect(status().isForbidden());
        mvc.perform(get(ROOT + "/competitions").param("organizerPageId", organizationId))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(as(post(ROOT + "/admin/competitions/" + id + "/publish"), "publisher", true)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", saved.path("version").asLong()))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TOURNAMENT_INVALID_CONTENT"));
        var publicOrganization = send(post(ROOT + "/admin/pages/" + organizationId + "/publish"), "publisher", true,
                Map.of("version", organization.path("version").asLong()));
        organizationContent.put("name", "Private organizer draft");
        var draftOrganization = send(put(ROOT + "/admin/pages/" + organizationId), "editor", true,
                Map.of("version", publicOrganization.path("version").asLong(), "content", organizationContent));
        mvc.perform(get(ROOT + "/competitions/" + id)).andExpect(status().isNotFound());
        var published = send(post(ROOT + "/admin/competitions/" + id + "/publish"), "publisher", true,
                Map.of("version", saved.path("version").asLong()));
        mvc.perform(get(ROOT + "/competitions/" + id))
                .andExpect(jsonPath("$.content.plan.organizer").value("Original organizer"))
                .andExpect(jsonPath("$.content.organizer.name").value("Original organizer"))
                .andExpect(jsonPath("$.content.organizer.logoUrl").value("https://example.com/organizer.png"));
        send(post(ROOT + "/admin/pages/" + organizationId + "/publish"), "publisher", true,
                Map.of("version", draftOrganization.path("version").asLong()));
        mvc.perform(get(ROOT + "/competitions/" + id))
                .andExpect(jsonPath("$.content.organizer.name").value("Original organizer"));
        mvc.perform(as(get(ROOT + "/admin/competitions/" + id), "editor", true))
                .andExpect(jsonPath("$.content.organizer.name").value("Private organizer draft"));
        mvc.perform(get(ROOT + "/competitions?teamId=" + a))
                .andExpect(jsonPath("$.items[0].content.plan.entrants.length()").value(2));
        content.put("notes", "Private draft");
        var preview = send(post(ROOT + "/admin/competitions/preview"), "editor", true,
                Map.of("content", content, "stageCode", "GROUP", "opponent", 3));
        content.put("matches", preview);
        var nextOrganization = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "ORGANIZATION", "code", "next-organizer-" + suffix,
                        "content", Map.of("name", "Next organizer")));
        String nextOrganizationId = nextOrganization.path("id").asText();
        content.put("organizerPageId", nextOrganizationId);
        var draft = send(put(ROOT + "/admin/competitions/" + id), "editor", true,
                Map.of("version", published.path("version").asLong(), "content", content));
        mvc.perform(as(get(ROOT + "/admin/competitions").param("organizerPageId", organizationId), "editor", true))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(as(get(ROOT + "/admin/competitions").param("organizerPageId", nextOrganizationId), "editor", true))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].publishedAt").isNotEmpty());
        mvc.perform(get(ROOT + "/competitions").param("organizerPageId", organizationId))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(get(ROOT + "/competitions").param("organizerPageId", nextOrganizationId))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(ROOT + "/competitions/" + id)).andExpect(jsonPath("$.content.plan.matches.length()").value(0));
        var materialized = send(post(ROOT + "/admin/competitions/" + id + "/materialize"), "editor", true,
                Map.of("version", draft.path("version").asLong()));
        var again = send(post(ROOT + "/admin/competitions/" + id + "/materialize"), "editor", true,
                Map.of("version", materialized.path("version").asLong()));
        assertThat(again.path("content").path("plan").path("matches").get(0).path("seriesId").asText())
                .isEqualTo(materialized.path("content").path("plan").path("matches").get(0).path("seriesId").asText());
        mvc.perform(
                as(post(ROOT + "/admin/teams/" + a + "/delete"), "editor", true).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":0}"))
                .andExpect(status().isConflict());
        mvc.perform(as(post(ROOT + "/admin/competitions/" + id + "/publish"), "fan", false)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", again.path("version").asLong()))))
                .andExpect(status().isForbidden());
        send(post(ROOT + "/admin/competitions/" + id + "/withdraw"), "publisher", true,
                Map.of("version", again.path("version").asLong()));
        mvc.perform(get(ROOT + "/competitions/" + id)).andExpect(status().isNotFound());
    }

    @Test
    void generatedMatchesCarryTheirTitleIntoTheirSeriesAndKeepItWhenRenamed() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String a = send(post(ROOT + "/admin/teams"), "editor", true,
                Map.of("content", Map.of("code", "titled-a-" + suffix, "name", "First"))).path("id").asText();
        String b = send(post(ROOT + "/admin/teams"), "editor", true,
                Map.of("content", Map.of("code", "titled-b-" + suffix, "name", "Second"))).path("id").asText();
        String id = send(post(ROOT + "/admin/tournaments"), "editor", true,
                Map.of("content", Map.of("code", "titled-" + suffix, "name", "Titled season", "region", "VN")))
                .path("id").asText();
        var content = new HashMap<String, Object>();
        content.put("sourceUrl", "https://example.com/rules");
        content.put("entrants", List.of(Map.of("teamId", a), Map.of("teamId", b)));
        content.put("stages", List.of(Map.of("code", "GROUP", "name", "Group", "format", "ROUND_ROBIN", "bestOf", 3,
                "legs", 1, "winPoints", 1, "lossPoints", 0, "advance", 1)));

        var preview = send(post(ROOT + "/admin/competitions/preview"), "editor", true,
                Map.of("content", content, "stageCode", "GROUP", "opponent", 3));
        assertThat(preview.get(0).path("label").isNull()).isTrue();
        assertThat(preview.get(0).path("title").path("kind").asText()).isEqualTo("ROUND_ROBIN");
        assertThat(preview.get(0).path("title").path("leg").asInt()).isEqualTo(1);
        assertThat(preview.get(0).path("title").path("round").asInt()).isEqualTo(1);
        content.put("matches", preview);
        var saved = send(put(ROOT + "/admin/competitions/" + id), "editor", true,
                Map.of("version", 0, "content", content));
        var materialized = send(post(ROOT + "/admin/competitions/" + id + "/materialize"), "editor", true,
                Map.of("version", saved.path("version").asLong()));
        var match = materialized.path("content").path("plan").path("matches").get(0);
        String seriesId = match.path("seriesId").asText();
        var created = send(get(ROOT + "/admin/series/" + seriesId), "editor", true, null).path("content");
        assertThat(created.path("name").isNull()).isTrue();
        assertThat(created.path("title").path("kind").asText()).isEqualTo("ROUND_ROBIN");

        ((ObjectNode) match).put("label", "Opening match");
        content.put("matches", List.of(match));
        send(put(ROOT + "/admin/competitions/" + id), "editor", true,
                Map.of("version", materialized.path("version").asLong(), "content", content));
        var named = send(get(ROOT + "/admin/series/" + seriesId), "editor", true, null).path("content");
        assertThat(named.path("name").asText()).isEqualTo("Opening match");
        assertThat(named.path("title").path("kind").asText()).isEqualTo("ROUND_ROBIN");
    }

    @Test
    void matchTitlesWithoutAKindOrWithNumbersOutOfRangeAreRejected() throws Exception {
        String suffix = UUID.randomUUID().toString();
        String a = send(post(ROOT + "/admin/teams"), "editor", true,
                Map.of("content", Map.of("code", "untitled-a-" + suffix, "name", "First"))).path("id").asText();
        String b = send(post(ROOT + "/admin/teams"), "editor", true,
                Map.of("content", Map.of("code", "untitled-b-" + suffix, "name", "Second"))).path("id").asText();
        String id = send(post(ROOT + "/admin/tournaments"), "editor", true,
                Map.of("content", Map.of("code", "untitled-" + suffix, "name", "Untitled season", "region", "VN")))
                .path("id").asText();

        for (var title : List.<Map<String, Object>>of(Map.of("round", 1), Map.of("kind", "LOWER_ROUND", "round", 0),
                Map.of("kind", "ROUND_ROBIN", "leg", 1, "round", 100))) {
            var content = new HashMap<String, Object>();
            content.put("sourceUrl", "https://example.com/rules");
            content.put("entrants", List.of(Map.of("teamId", a), Map.of("teamId", b)));
            content.put("stages", List.of(Map.of("code", "GROUP", "name", "Group", "format", "ROUND_ROBIN",
                    "bestOf", 3, "legs", 1, "winPoints", 1, "lossPoints", 0, "advance", 1)));
            content.put("matches", List.of(Map.of("key", "M1", "stageCode", "GROUP", "round", 1, "bestOf", 3,
                    "a", Map.of("type", "TEAM", "teamId", a), "b", Map.of("type", "TEAM", "teamId", b),
                    "title", title)));
            mvc.perform(as(put(ROOT + "/admin/competitions/" + id), "editor", true)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(json.writeValueAsString(Map.of("version", 0, "content", content))))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("TOURNAMENT_INVALID_CONTENT"));
        }
    }

    @Test
    void circuitReferencesResolveNamesAndKeepPublicSeasonsIsolatedFromDrafts() throws Exception {
        String suffix = UUID.randomUUID().toString();
        var circuitContent = new HashMap<String, Object>();
        circuitContent.put("name", "Original circuit");
        circuitContent.put("sources", List.of(Map.of("label", "Rules", "url", "https://example.com")));
        var circuit = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "CIRCUIT", "code", "circuit-" + suffix, "content", circuitContent));
        String circuitId = circuit.path("id").asText();
        assertThat(circuit.path("entityId").isNull()).isTrue();
        mvc.perform(
                as(get(ROOT + "/admin/pages").param("kind", "CIRCUIT").param("q", "Original circuit"), "editor", true))
                .andExpect(jsonPath("$.items[0].id").value(circuitId));
        var tournament = send(post(ROOT + "/admin/tournaments"), "editor", true,
                Map.of("content",
                        Map.of("code", "circuit-season-" + suffix, "name", "Circuit season", "region", "VN")));
        String id = tournament.path("id").asText();
        var a = send(post(ROOT + "/admin/teams"), "editor", true,
                Map.of("content", Map.of("code", "circuit-a-" + suffix, "name", "First")));
        var b = send(post(ROOT + "/admin/teams"), "editor", true,
                Map.of("content", Map.of("code", "circuit-b-" + suffix, "name", "Second")));
        var plan = new HashMap<String, Object>();
        plan.put("circuit", "Spoofed name");
        plan.put("sourceUrl", "https://example.com/rules");
        plan.put("entrants", List.of(Map.of("teamId", a.path("id").asText()), Map.of("teamId", b.path("id").asText())));
        plan.put("stages", List.of(Map.of("code", "GROUP", "name", "Group", "format", "ROUND_ROBIN", "bestOf", 5,
                "legs", 1, "winPoints", 1, "lossPoints", 0, "advance", 1)));
        plan.put("circuitPageId", publishedOrganization("Wrong kind"));
        mvc.perform(as(put(ROOT + "/admin/competitions/" + id), "editor", true).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", 0, "content", plan))))
                .andExpect(status().isBadRequest());
        plan.put("circuitPageId", circuitId);
        var saved = send(put(ROOT + "/admin/competitions/" + id), "editor", true,
                Map.of("version", 0, "content", plan));
        assertThat(saved.path("content").path("plan").path("circuit").asText()).isEqualTo("Original circuit");
        mvc.perform(as(get(ROOT + "/admin/competitions").param("circuitPageId", circuitId), "editor", true))
                .andExpect(jsonPath("$.totalElements").value(1));
        mvc.perform(as(post(ROOT + "/admin/pages/" + circuitId + "/delete"), "editor", true)
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isConflict());
        mvc.perform(as(post(ROOT + "/admin/competitions/" + id + "/publish"), "publisher", true)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", saved.path("version").asLong()))))
                .andExpect(status().isBadRequest());
        var publicCircuit = send(post(ROOT + "/admin/pages/" + circuitId + "/publish"), "publisher", true,
                Map.of("version", circuit.path("version").asLong()));
        circuitContent.put("name", "Private circuit draft");
        send(put(ROOT + "/admin/pages/" + circuitId), "editor", true,
                Map.of("version", publicCircuit.path("version").asLong(), "content", circuitContent));
        var published = send(post(ROOT + "/admin/competitions/" + id + "/publish"), "publisher", true,
                Map.of("version", saved.path("version").asLong()));
        mvc.perform(get(ROOT + "/competitions").param("circuitPageId", circuitId))
                .andExpect(jsonPath("$.totalElements").value(1))
                .andExpect(jsonPath("$.items[0].content.circuit.name").value("Original circuit"));
        plan.remove("circuitPageId");
        send(put(ROOT + "/admin/competitions/" + id), "editor", true,
                Map.of("version", published.path("version").asLong(), "content", plan));
        mvc.perform(as(get(ROOT + "/admin/competitions").param("circuitPageId", circuitId), "editor", true))
                .andExpect(jsonPath("$.totalElements").value(0));
        mvc.perform(get(ROOT + "/competitions").param("circuitPageId", circuitId))
                .andExpect(jsonPath("$.totalElements").value(1));
    }

    @Test
    void circuitPagesAllowEditorialContentAndSuggestionsButRejectCommunityActions() throws Exception {
        String code = "circuit-info-" + UUID.randomUUID();
        var content = Map.of("name", "Circuit information", "biography", "An editorial competition circuit.",
                "sources", List.of(Map.of("label", "Rules", "url", "https://example.com")));
        var page = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "CIRCUIT", "code", code, "content", content));
        String id = page.path("id").asText();
        send(post(ROOT + "/admin/pages/" + id + "/publish"), "publisher", true, Map.of("version", 0));
        mvc.perform(get(ROOT + "/pages/by-code/" + code))
                .andExpect(jsonPath("$.content.biography").value("An editorial competition circuit."))
                .andExpect(jsonPath("$.represented").value(false))
                .andExpect(jsonPath("$.followers").value(0));

        for (var action : List.of(
                Map.entry("/me/pages/" + id + "/claims", Map.of("evidence", "Official channel")),
                Map.entry("/me/pages/" + id + "/follow", Map.of("following", true)),
                Map.entry("/me/pages/" + id + "/posts", Map.of("body", "Fan post", "asPage", false, "publish", true)),
                Map.entry("/me/pages/" + id + "/invitations", Map.of("role", "EDITOR")),
                Map.entry("/admin/pages/" + id + "/handover", Map.of()))) {
            mvc.perform(as(post(ROOT + action.getKey()), "publisher", true)
                    .contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(action.getValue())))
                    .andExpect(status().isForbidden())
                    .andExpect(jsonPath("$.code").value("PAGE_ACTION_FORBIDDEN"));
        }
        mvc.perform(get(ROOT + "/pages/" + id + "/posts")).andExpect(status().isForbidden());
        mvc.perform(as(get(ROOT + "/me/suggestions").param("size", "100"), "fan", false))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[?(@.kind == 'CIRCUIT')]").isEmpty());
        send(post(ROOT + "/me/pages/" + id + "/follow"), "fan", false, Map.of("following", false));
        send(post(ROOT + "/me/pages/" + id + "/reports"), "fan", false,
                Map.of("reason", "Please check the circuit introduction against https://example.com"));
        var current = send(get(ROOT + "/admin/pages/" + id), "editor", true, null);
        send(put(ROOT + "/admin/pages/" + id), "editor", true,
                Map.of("version", current.path("version").asLong(), "content", content));
    }

    @Test
    void circuitChannelReferencesRequireOrganizationsAndPreservePublishedSelections() throws Exception {
        var source = List.of(Map.of("label", "Official source", "url", "https://example.com"));
        var organization = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "ORGANIZATION", "code", "channel-org-" + UUID.randomUUID(), "content",
                        Map.of("name", "Channel organization", "sources", source)));
        String organizationId = organization.path("id").asText();
        var content = new HashMap<String, Object>();
        content.put("name", "Circuit with shared channels");
        content.put("sources", source);
        content.put("channelOrganizationId", organizationId);
        var circuit = send(post(ROOT + "/admin/pages"), "editor", true,
                Map.of("kind", "CIRCUIT", "code", "shared-channels-" + UUID.randomUUID(), "content", content));
        String id = circuit.path("id").asText();
        assertThat(circuit.path("content").path("channelOrganizationId").asText()).isEqualTo(organizationId);
        assertThat(circuit.path("content").path("links").size()).isZero();
        mvc.perform(as(post(ROOT + "/admin/pages/" + organizationId + "/delete"), "editor", true)
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isConflict());
        mvc.perform(as(post(ROOT + "/admin/pages/" + id + "/publish"), "publisher", true)
                .contentType(MediaType.APPLICATION_JSON).content("{\"version\":0}"))
                .andExpect(status().isConflict());

        content.put("channelOrganizationId", id);
        mvc.perform(as(put(ROOT + "/admin/pages/" + id), "editor", true).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", 0, "content", content))))
                .andExpect(status().isUnprocessableEntity());
        content.put("channelOrganizationId", UUID.randomUUID().toString());
        mvc.perform(as(put(ROOT + "/admin/pages/" + id), "editor", true).contentType(MediaType.APPLICATION_JSON)
                .content(json.writeValueAsString(Map.of("version", 0, "content", content))))
                .andExpect(status().isUnprocessableEntity());
        content.put("channelOrganizationId", organizationId);
        mvc.perform(
                as(put(ROOT + "/admin/pages/" + organizationId), "editor", true).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("version", 0, "content", content))))
                .andExpect(status().isUnprocessableEntity());

        send(post(ROOT + "/admin/pages/" + organizationId + "/publish"), "publisher", true, Map.of("version", 0));
        var published = send(post(ROOT + "/admin/pages/" + id + "/publish"), "publisher", true, Map.of("version", 0));
        content.remove("channelOrganizationId");
        var saved = send(put(ROOT + "/admin/pages/" + id), "editor", true,
                Map.of("version", published.path("version").asLong(), "content", content));
        mvc.perform(get(ROOT + "/pages/" + id))
                .andExpect(jsonPath("$.content.channelOrganizationId").value(organizationId));
        send(post(ROOT + "/admin/pages/" + id + "/publish"), "publisher", true,
                Map.of("version", saved.path("version").asLong()));
        mvc.perform(get(ROOT + "/pages/" + id))
                .andExpect(jsonPath("$.content.channelOrganizationId").isEmpty());
    }

    private JsonNode send(MockHttpServletRequestBuilder request, String actor, boolean admin,
            Object body) throws Exception {
        as(request, actor, admin);
        if (body != null) {
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        }
        var result = mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(result.isEmpty() ? "null" : result);
    }
}
