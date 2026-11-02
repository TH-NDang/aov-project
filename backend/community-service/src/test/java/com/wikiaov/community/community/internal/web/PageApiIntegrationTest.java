package com.wikiaov.community.community.internal.web;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.*;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.testcontainers.postgresql.PostgreSQLContainer;
import tools.jackson.databind.json.JsonMapper;

@SpringBootTest
@AutoConfigureMockMvc
class PageApiIntegrationTest {
    static final PostgreSQLContainer DATABASE = new PostgreSQLContainer("postgres:17.6");
    static {
        DATABASE.start();
    }

    @DynamicPropertySource
    static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", DATABASE::getJdbcUrl);
        properties.add("spring.datasource.username", DATABASE::getUsername);
        properties.add("spring.datasource.password", DATABASE::getPassword);
    }

    @AfterAll
    static void stop() {
        DATABASE.stop();
    }

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @MockitoBean
    JwtDecoder decoder;
    static final String ROOT = "/api/community/v1";

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
        for (var member : memberList)
            if (member.path("role").asText().equals("OWNER"))
                ownerId = member.path("id").asText();
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
        mvc.perform(get(ROOT + "/pages?unexpected=true")).andExpect(status().isUnprocessableEntity());
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

    private org.springframework.test.web.servlet.ResultActions accept(String token, String actor) throws Exception {
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
                        .authorities(roles.toArray(org.springframework.security.core.GrantedAuthority[]::new)));
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
        var draft = send(put(ROOT + "/admin/competitions/" + id), "editor", true,
                Map.of("version", published.path("version").asLong(), "content", content));
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

    private tools.jackson.databind.JsonNode send(MockHttpServletRequestBuilder request, String actor, boolean admin,
            Object body) throws Exception {
        as(request, actor, admin);
        if (body != null)
            request.contentType(MediaType.APPLICATION_JSON).content(json.writeValueAsString(body));
        var result = mvc.perform(request).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(result.isEmpty() ? "null" : result);
    }
}
