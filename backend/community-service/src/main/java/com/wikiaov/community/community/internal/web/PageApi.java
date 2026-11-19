package com.wikiaov.community.community.internal.web;

import com.wikiaov.community.community.internal.application.PageViews.Claim;
import com.wikiaov.community.community.internal.application.PageViews.Comment;
import com.wikiaov.community.community.internal.application.PageViews.FeedPost;
import com.wikiaov.community.community.internal.application.PageViews.Handover;
import com.wikiaov.community.community.internal.application.PageViews.Liking;
import com.wikiaov.community.community.internal.application.PageViews.Live;
import com.wikiaov.community.community.internal.application.PageViews.Member;
import com.wikiaov.community.community.internal.application.PageViews.Notification;
import com.wikiaov.community.community.internal.application.PageViews.Post;
import com.wikiaov.community.community.internal.application.PageViews.Profile;
import com.wikiaov.community.community.internal.application.PageViews.Report;
import com.wikiaov.community.community.internal.application.PageViews.TeamAffiliation;
import com.wikiaov.community.community.internal.application.PageViews.UnreadCount;
import com.wikiaov.community.community.internal.domain.PageContent;
import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Tag(name = "pages")
public interface PageApi {

    record CreatePage(
            PageContent.Kind kind,
            String code,
            UUID entityId,
            PageContent content
    ) {
    }

    record SavePage(
            Long version,
            PageContent content
    ) {
    }

    record Version(
            Long version
    ) {
    }

    record PresentationWrite(
            Long version,
            PageContent.Presentation content
    ) {
    }

    record Proof(
            String evidence
    ) {
    }

    record Decision(
            Long version,
            boolean approve,
            String resolution
    ) {
    }

    record Invite(
            PageContent.Role role
    ) {
    }

    record Token(
            String token
    ) {
    }

    record PostWrite(
            Long version,
            String kind,
            String title,
            String body,
            String videoUrl,
            List<String> imageUrls,
            boolean asPage,
            boolean publish
    ) {
    }

    record Pin(
            boolean pinned
    ) {
    }

    record LiveWrite(
            String url,
            String title
    ) {
    }

    record CommentWrite(
            String body,
            boolean asPage
    ) {
    }

    record Follow(
            boolean following
    ) {
    }

    record Like(
            boolean liked
    ) {
    }

    record ReportWrite(
            UUID postId,
            UUID commentId,
            String reason
    ) {
    }

    record Moderation(
            UUID postId,
            UUID commentId,
            boolean hidden
    ) {
    }

    record Resolution(
            String resolution,
            boolean hide
    ) {
    }

    @Operation(operationId = "pageApi_pages", summary = "List published pages")
    PageSlice<Profile> pages(String kind, String q, String personRole, @Min(0) int page,
            @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_page", summary = "Read a published page")
    Profile page(UUID id);

    @Operation(operationId = "pageApi_byCode", summary = "Read a published page by its code")
    Profile byCode(String code);

    @Operation(operationId = "pageApi_adminPages", summary = "List pages for editors")
    PageSlice<Profile> adminPages(String kind, String q, String personRole, String country, List<UUID> entityIds,
            String sort, UUID relatedPageId, @Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_byEntity", summary = "Read the published page of a team or player")
    Profile byEntity(String kind, UUID id);

    @Operation(operationId = "pageApi_adminPage", summary = "Read a page draft")
    Profile adminPage(UUID id);

    @Operation(operationId = "pageApi_adminTeams", summary = "List the teams of a person, drafts included")
    List<TeamAffiliation> adminTeams(UUID id);

    @Operation(operationId = "pageApi_teams", summary = "List the published teams of a person")
    List<TeamAffiliation> teams(UUID id);

    @Operation(operationId = "pageApi_create", summary = "Create a page")
    Profile create(CreatePage body);

    @Operation(operationId = "pageApi_save", summary = "Save a page draft")
    Profile save(UUID id, SavePage body);

    @Operation(operationId = "pageApi_publish", summary = "Publish a page")
    Profile publish(UUID id, Version body);

    @Operation(operationId = "pageApi_withdraw", summary = "Withdraw a page")
    Profile withdraw(UUID id, Version body);

    /** Deletes a never-published draft without representatives or activity; see spec 04, draft deletion. */
    @Operation(operationId = "pageApi_delete", summary = "Delete a page draft")
    void delete(UUID id, Version body);

    @Operation(operationId = "pageApi_handover", summary = "Read the owner handover of a page")
    Handover handover(UUID id);

    /** Returns the owner handover code once; only its hash is stored. See spec 04, page handover. */
    @Operation(operationId = "pageApi_issueHandover", summary = "Issue an owner handover code")
    Map<String, Object> issueHandover(UUID id);

    @Operation(operationId = "pageApi_cancelHandover", summary = "Cancel the owner handover")
    void cancelHandover(UUID id);

    @Operation(operationId = "pageApi_me", summary = "Read the signed-in account")
    Map<String, Object> me();

    @Operation(operationId = "pageApi_managed", summary = "List the pages the account manages")
    List<Profile> managed();

    @Operation(operationId = "pageApi_managedProfile", summary = "Read a page the account manages")
    Profile managedProfile(UUID id);

    @Operation(operationId = "pageApi_feed", summary = "List the posts of a managed page as its feed")
    PageSlice<Post> feed(UUID id, @Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_pageMe", summary = "Read the account's role on a page")
    Map<String, Object> pageMe(UUID id);

    @Operation(operationId = "pageApi_presentation", summary = "Save the presentation of a page")
    Profile presentation(UUID id, PresentationWrite body);

    @Operation(operationId = "pageApi_claim", summary = "Claim a page")
    Claim claim(UUID id, Proof body);

    @Operation(operationId = "pageApi_myClaims", summary = "List the account's claims")
    List<Claim> myClaims();

    @Operation(operationId = "pageApi_claims", summary = "List pending claims")
    PageSlice<Claim> claims(@Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_decision", summary = "Decide a claim")
    Claim decision(UUID id, Decision body);

    @Operation(operationId = "pageApi_members", summary = "List the representatives of a page")
    List<Member> members(UUID id);

    @Operation(operationId = "pageApi_invite", summary = "Invite a representative")
    Map<String, Object> invite(UUID id, Invite body);

    @Operation(operationId = "pageApi_accept", summary = "Accept an invitation or handover")
    Map<String, UUID> accept(Token body);

    @Operation(operationId = "pageApi_revoke", summary = "Revoke a representative")
    void revoke(UUID id, UUID memberId);

    @Operation(operationId = "pageApi_transfer", summary = "Transfer page ownership")
    void transfer(UUID id, UUID memberId);

    @Operation(operationId = "pageApi_posts", summary = "List the published posts of a page")
    PageSlice<Post> posts(UUID id, String kind, @Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_managePosts", summary = "List the posts of a managed page")
    PageSlice<Post> managePosts(UUID id, @Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_writePost", summary = "Write a post")
    Post writePost(UUID id, PostWrite body);

    @Operation(operationId = "pageApi_updatePost", summary = "Change a post")
    Post updatePost(UUID id, UUID postId, PostWrite body);

    @Operation(operationId = "pageApi_pinPost", summary = "Pin or unpin a post")
    Post pinPost(UUID id, UUID postId, Pin body);

    @Operation(operationId = "pageApi_latestPosts", summary = "List the latest posts")
    PageSlice<FeedPost> latestPosts(String kind, String q, @Min(0) int page,
            @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_timeline", summary = "Read the account's feed")
    PageSlice<FeedPost> timeline(boolean following, String kind, @Min(0) int page,
            @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    /** Pages broadcasting now; see spec 04, live status. */
    @Operation(operationId = "pageApi_live", summary = "List pages broadcasting now")
    PageSlice<Profile> live(@Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_startLive", summary = "Start or update a broadcast")
    Live startLive(UUID id, LiveWrite body);

    @Operation(operationId = "pageApi_endLive", summary = "End a broadcast")
    void endLive(UUID id);

    @Operation(operationId = "pageApi_startLiveAsEditor", summary = "Start or update a broadcast as an editor")
    Live startLiveAsEditor(UUID id, LiveWrite body);

    @Operation(operationId = "pageApi_endLiveAsEditor", summary = "End a broadcast as an editor")
    void endLiveAsEditor(UUID id);

    @Operation(operationId = "pageApi_follows", summary = "List the pages the account follows")
    PageSlice<Profile> follows(@Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_suggestions", summary = "Suggest pages to follow")
    PageSlice<Profile> suggestions(@Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_comments", summary = "List the comments of a post")
    PageSlice<Comment> comments(UUID id, @Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_comment", summary = "Comment on a post")
    Comment comment(UUID id, CommentWrite body);

    @Operation(operationId = "pageApi_like", summary = "Like or unlike a post")
    Liking like(UUID id, Like body);

    @Operation(operationId = "pageApi_follow", summary = "Follow or unfollow a page")
    void follow(UUID id, Follow body);

    @Operation(operationId = "pageApi_report", summary = "Report a post or comment")
    void report(UUID id, ReportWrite body);

    @Operation(operationId = "pageApi_moderate", summary = "Hide or restore a post or comment")
    void moderate(UUID id, Moderation body);

    @Operation(operationId = "pageApi_reports", summary = "List community reports")
    PageSlice<Report> reports(@Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_resolve", summary = "Resolve a community report")
    void resolve(UUID id, Resolution body);

    @Operation(operationId = "pageApi_notifications", summary = "List the account's notifications")
    PageSlice<Notification> notifications(@Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size);

    @Operation(operationId = "pageApi_readNotification", summary = "Mark a notification as read")
    void readNotification(UUID id);

    @Operation(operationId = "pageApi_unreadNotifications", summary = "Count unread notifications")
    UnreadCount unreadNotifications();

    @Operation(operationId = "pageApi_readAllNotifications", summary = "Mark every notification as read")
    void readAllNotifications();
}
