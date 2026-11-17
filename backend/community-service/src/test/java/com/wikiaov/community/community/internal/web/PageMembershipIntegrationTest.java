package com.wikiaov.community.community.internal.web;

import static com.wikiaov.community.testsupport.ApiCalls.ROOT;
import static com.wikiaov.community.testsupport.ApiCalls.as;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.wikiaov.community.testsupport.ApiCalls;
import com.wikiaov.community.testsupport.CommunityApplicationTest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/** Ownership transfer and report handling of community pages, through the HTTP API (spec 04). */
@CommunityApplicationTest
class PageMembershipIntegrationTest {
    private static final String[] ADMIN = {"tournament:read", "tournament:write", "tournament:publish"};

    @Autowired
    MockMvc mvc;
    @Autowired
    JsonMapper json;
    @MockitoBean
    JwtDecoder decoder;

    private ApiCalls api;
    private String suffix;

    @BeforeEach
    void accounts() {
        api = new ApiCalls(mvc, json);
        suffix = UUID.randomUUID().toString().substring(0, 8);
    }

    @Test
    void theOwnerHandsOwnershipToAnotherMember() throws Exception {
        String page = ownedPage(owner());
        join(page, owner(), editor(), "EDITOR");

        api.send(as(post(members(page) + "/" + memberId(page, owner(), editor()) + "/transfer"), owner()), null, 200);

        assertThat(roleOf(page, editor(), editor())).isEqualTo("OWNER");
        assertThat(roleOf(page, editor(), owner())).isEqualTo("EDITOR");
    }

    @Test
    void onlyTheOwnerCanTransferOwnership() throws Exception {
        String page = ownedPage(owner());
        join(page, owner(), editor(), "EDITOR");

        var refused = api.send(
                as(post(members(page) + "/" + memberId(page, owner(), owner()) + "/transfer"), editor()), null, 403);

        assertThat(refused.path("code").asString()).isEqualTo("PAGE_ACTION_FORBIDDEN");
    }

    @Test
    void theOwnerCannotTransferOwnershipToThemself() throws Exception {
        String page = ownedPage(owner());

        var refused = api.send(
                as(post(members(page) + "/" + memberId(page, owner(), owner()) + "/transfer"), owner()), null, 422);

        assertThat(refused.path("code").asString()).isEqualTo("PAGE_INVALID_CONTENT");
    }

    @Test
    void aReportWaitsForReviewWithTheReportedText() throws Exception {
        String page = ownedPage(owner());
        String postId = postAsPage(page, "Reported text");

        report(page, postId);

        assertThat(openReport(postId).path("reportedContent").asString()).isEqualTo("Reported text");
    }

    @Test
    void aResolvedReportLeavesTheQueue() throws Exception {
        String page = ownedPage(owner());
        String postId = postAsPage(page, "Fine after all");
        report(page, postId);

        resolve(openReport(postId), false);

        assertThat(openReport(postId)).isNull();
    }

    @Test
    void resolvingAReportWithHideTakesThePostDown() throws Exception {
        String page = ownedPage(owner());
        String postId = postAsPage(page, "To be hidden");
        report(page, postId);

        resolve(openReport(postId), true);

        var posts = api.send(get(ROOT + "/pages/" + page + "/posts"), null, 200);
        assertThat(posts.path("items").findValuesAsString("id")).doesNotContain(postId);
    }

    @Test
    void theReporterIsToldTheReportWasHandled() throws Exception {
        String page = ownedPage(owner());
        String postId = postAsPage(page, "Handled");
        report(page, postId);

        resolve(openReport(postId), false);

        var inbox = api.send(as(get(ROOT + "/me/notifications"), reader()), null, 200);
        assertThat(inbox.path("items").findValuesAsString("pageId")).contains(page);
    }

    @Test
    void aReportCannotBeResolvedWithoutAResolution() throws Exception {
        String page = ownedPage(owner());
        String postId = postAsPage(page, "Unresolved");
        report(page, postId);
        String reportId = openReport(postId).path("id").asString();

        var refused = api.send(as(post(ROOT + "/admin/community-reports/" + reportId + "/resolve"), "moderator", ADMIN),
                Map.of("resolution", " ", "hide", false), 422);

        assertThat(refused.path("code").asString()).isEqualTo("PAGE_INVALID_CONTENT");
    }

    private String owner() {
        return "owner-" + suffix;
    }

    private String editor() {
        return "editor-" + suffix;
    }

    private String reader() {
        return "reader-" + suffix;
    }

    /** A published organization page that {@code owner} took over with a handover code. */
    private String ownedPage(String owner) throws Exception {
        var content = Map.of("name", "Organization " + suffix, "sources",
                List.of(Map.of("label", "Official", "url", "https://example.com/" + suffix)));
        var created = api.send(as(post(ROOT + "/admin/pages"), "editor", ADMIN),
                Map.of("kind", "ORGANIZATION", "code", "organization-" + suffix, "content", content), 200);
        String page = created.path("id").asString();
        api.send(as(post(ROOT + "/admin/pages/" + page + "/publish"), "publisher", ADMIN),
                Map.of("version", created.path("version").asLong()), 200);

        var handover = api.send(as(post(ROOT + "/admin/pages/" + page + "/handover"), "publisher", ADMIN), null, 200);
        api.send(as(post(ROOT + "/me/invitations/accept"), owner), Map.of("token", handover.path("token").asString()),
                200);
        return page;
    }

    private void join(String page, String owner, String account, String role) throws Exception {
        var invitation = api.send(as(post(ROOT + "/me/pages/" + page + "/invitations"), owner), Map.of("role", role),
                200);
        api.send(as(post(ROOT + "/me/invitations/accept"), account),
                Map.of("token", invitation.path("token").asString()), 200);
    }

    private String postAsPage(String page, String body) throws Exception {
        var written = api.send(as(post(ROOT + "/me/pages/" + page + "/posts"), owner()),
                Map.of("body", body, "asPage", true, "publish", true), 200);
        return written.path("id").asString();
    }

    private void report(String page, String postId) throws Exception {
        api.send(as(post(ROOT + "/me/pages/" + page + "/reports"), reader()),
                Map.of("postId", postId, "reason", "Spam"), 200);
    }

    private JsonNode openReport(String postId) throws Exception {
        var queue = api.send(as(get(ROOT + "/admin/community-reports").param("size", "100"), "moderator", ADMIN),
                null, 200);
        for (var report : queue.path("items")) {
            if (report.path("postId").asString().equals(postId)) {
                return report;
            }
        }
        return null;
    }

    private void resolve(JsonNode report, boolean hide) throws Exception {
        api.send(as(post(ROOT + "/admin/community-reports/" + report.path("id").asString() + "/resolve"), "moderator",
                ADMIN), Map.of("resolution", "Reviewed", "hide", hide), 200);
    }

    private static String members(String page) {
        return ROOT + "/me/pages/" + page + "/members";
    }

    private String memberId(String page, String viewer, String account) throws Exception {
        return member(page, viewer, account).path("id").asString();
    }

    private String roleOf(String page, String viewer, String account) throws Exception {
        return member(page, viewer, account).path("role").asString();
    }

    /** Members carry a display name only, the account's name claim; tests name accounts after themselves. */
    private JsonNode member(String page, String viewer, String account) throws Exception {
        for (var member : api.send(as(get(members(page)), viewer), null, 200)) {
            if (member.path("name").asString().equals(account)) {
                return member;
            }
        }
        throw new AssertionError(account + " is not a member of " + page);
    }
}
