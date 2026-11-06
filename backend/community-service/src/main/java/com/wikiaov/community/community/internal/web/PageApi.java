package com.wikiaov.community.community.internal.web;

import com.wikiaov.community.community.internal.application.PageViews.*;
import com.wikiaov.community.community.internal.domain.PageContent;
import com.wikiaov.community.platform.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RequestMapping(version = "1")
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

    @GetMapping(ApiPaths.ROOT + "/pages")
    Slice<Profile> pages(@RequestParam(required = false) String kind, @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) String personRole,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "24") int size);

    @GetMapping(ApiPaths.ROOT + "/pages/{id}")
    Profile page(@PathVariable UUID id);

    @GetMapping(ApiPaths.ROOT + "/pages/by-code/{code}")
    Profile byCode(@PathVariable String code);

    @GetMapping(ApiPaths.ROOT + "/admin/pages")
    Slice<Profile> adminPages(@RequestParam(required = false) String kind, @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) String personRole,
            @RequestParam(defaultValue = "") String country,
            @RequestParam(defaultValue = "") List<UUID> entityIds,
            @RequestParam(defaultValue = "RECENT") String sort,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "24") int size);

    @GetMapping(ApiPaths.ROOT + "/admin/pages/{id}")
    Profile adminPage(@PathVariable UUID id);

    @GetMapping(ApiPaths.ROOT + "/admin/pages/{id}/teams")
    List<TeamAffiliation> adminTeams(@PathVariable UUID id);

    @GetMapping(ApiPaths.ROOT + "/pages/{id}/teams")
    List<TeamAffiliation> teams(@PathVariable UUID id);

    @PostMapping(ApiPaths.ROOT + "/admin/pages")
    Profile create(@RequestBody CreatePage body);

    @PutMapping(ApiPaths.ROOT + "/admin/pages/{id}")
    Profile save(@PathVariable UUID id, @RequestBody SavePage body);

    @PostMapping(ApiPaths.ROOT + "/admin/pages/{id}/publish")
    Profile publish(@PathVariable UUID id, @RequestBody Version body);

    @PostMapping(ApiPaths.ROOT + "/admin/pages/{id}/withdraw")
    Profile withdraw(@PathVariable UUID id, @RequestBody Version body);

    /** Deletes a never-published draft without representatives or activity; see spec 04, draft deletion. */
    @PostMapping(ApiPaths.ROOT + "/admin/pages/{id}/delete")
    void delete(@PathVariable UUID id, @RequestBody Version body);

    @GetMapping(ApiPaths.ROOT + "/admin/pages/{id}/handover")
    Handover handover(@PathVariable UUID id);

    /** Returns the owner handover code once; only its hash is stored. See spec 04, page handover. */
    @PostMapping(ApiPaths.ROOT + "/admin/pages/{id}/handover")
    Map<String, Object> issueHandover(@PathVariable UUID id);

    @PostMapping(ApiPaths.ROOT + "/admin/pages/{id}/handover/cancel")
    void cancelHandover(@PathVariable UUID id);

    @GetMapping(ApiPaths.ROOT + "/me")
    Map<String, Object> me();

    @GetMapping(ApiPaths.ROOT + "/me/pages")
    List<Profile> managed();

    @GetMapping(ApiPaths.ROOT + "/me/pages/{id}")
    Map<String, Object> pageMe(@PathVariable UUID id);

    @PutMapping(ApiPaths.ROOT + "/me/pages/{id}/presentation")
    Profile presentation(@PathVariable UUID id, @RequestBody PresentationWrite body);

    @PostMapping(ApiPaths.ROOT + "/me/pages/{id}/claims")
    Claim claim(@PathVariable UUID id, @RequestBody Proof body);

    @GetMapping(ApiPaths.ROOT + "/me/claims")
    List<Claim> myClaims();

    @GetMapping(ApiPaths.ROOT + "/admin/page-claims")
    Slice<Claim> claims(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "24") int size);

    @PostMapping(ApiPaths.ROOT + "/admin/page-claims/{id}/decision")
    Claim decision(@PathVariable UUID id, @RequestBody Decision body);

    @GetMapping(ApiPaths.ROOT + "/me/pages/{id}/members")
    List<Member> members(@PathVariable UUID id);

    @PostMapping(ApiPaths.ROOT + "/me/pages/{id}/invitations")
    Map<String, Object> invite(@PathVariable UUID id, @RequestBody Invite body);

    @PostMapping(ApiPaths.ROOT + "/me/invitations/accept")
    Map<String, UUID> accept(@RequestBody Token body);

    @PostMapping(ApiPaths.ROOT + "/me/pages/{id}/members/{memberId}/revoke")
    void revoke(@PathVariable UUID id, @PathVariable UUID memberId);

    @PostMapping(ApiPaths.ROOT + "/me/pages/{id}/members/{memberId}/transfer")
    void transfer(@PathVariable UUID id, @PathVariable UUID memberId);

    @GetMapping(ApiPaths.ROOT + "/pages/{id}/posts")
    Slice<Post> posts(@PathVariable UUID id, @RequestParam(required = false) String kind,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size);

    @GetMapping(ApiPaths.ROOT + "/me/pages/{id}/posts")
    Slice<Post> managePosts(@PathVariable UUID id, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size);

    @PostMapping(ApiPaths.ROOT + "/me/pages/{id}/posts")
    Post writePost(@PathVariable UUID id, @RequestBody PostWrite body);

    @PutMapping(ApiPaths.ROOT + "/me/pages/{id}/posts/{postId}")
    Post updatePost(@PathVariable UUID id, @PathVariable UUID postId, @RequestBody PostWrite body);

    @PostMapping(ApiPaths.ROOT + "/me/pages/{id}/posts/{postId}/pin")
    Post pinPost(@PathVariable UUID id, @PathVariable UUID postId, @RequestBody Pin body);

    @GetMapping(ApiPaths.ROOT + "/posts")
    Slice<FeedPost> latestPosts(@RequestParam(required = false) String kind, @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size);

    @GetMapping(ApiPaths.ROOT + "/me/feed")
    Slice<FeedPost> timeline(@RequestParam(defaultValue = "false") boolean following,
            @RequestParam(required = false) String kind, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size);

    /** Pages broadcasting now; see spec 04, live status. */
    @GetMapping(ApiPaths.ROOT + "/live")
    Slice<Profile> live(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "12") int size);

    @PutMapping(ApiPaths.ROOT + "/me/pages/{id}/live")
    Live startLive(@PathVariable UUID id, @RequestBody LiveWrite body);

    @PostMapping(ApiPaths.ROOT + "/me/pages/{id}/live/end")
    void endLive(@PathVariable UUID id);

    @PutMapping(ApiPaths.ROOT + "/admin/pages/{id}/live")
    Live startLiveAsEditor(@PathVariable UUID id, @RequestBody LiveWrite body);

    @PostMapping(ApiPaths.ROOT + "/admin/pages/{id}/live/end")
    void endLiveAsEditor(@PathVariable UUID id);

    @GetMapping(ApiPaths.ROOT + "/me/follows")
    Slice<Profile> follows(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "24") int size);

    @GetMapping(ApiPaths.ROOT + "/me/suggestions")
    Slice<Profile> suggestions(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size);

    @GetMapping(ApiPaths.ROOT + "/posts/{id}/comments")
    Slice<Comment> comments(@PathVariable UUID id, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size);

    @PostMapping(ApiPaths.ROOT + "/me/posts/{id}/comments")
    Comment comment(@PathVariable UUID id, @RequestBody CommentWrite body);

    @PostMapping(ApiPaths.ROOT + "/me/posts/{id}/like")
    Liking like(@PathVariable UUID id, @RequestBody Like body);

    @PostMapping(ApiPaths.ROOT + "/me/pages/{id}/follow")
    void follow(@PathVariable UUID id, @RequestBody Follow body);

    @PostMapping(ApiPaths.ROOT + "/me/pages/{id}/reports")
    void report(@PathVariable UUID id, @RequestBody ReportWrite body);

    @PostMapping(ApiPaths.ROOT + "/me/pages/{id}/moderate")
    void moderate(@PathVariable UUID id, @RequestBody Moderation body);

    @GetMapping(ApiPaths.ROOT + "/admin/community-reports")
    Slice<Report> reports(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "24") int size);

    @PostMapping(ApiPaths.ROOT + "/admin/community-reports/{id}/resolve")
    void resolve(@PathVariable UUID id, @RequestBody Resolution body);

    @GetMapping(ApiPaths.ROOT + "/me/notifications")
    Slice<Notification> notifications(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size);

    @PostMapping(ApiPaths.ROOT + "/me/notifications/{id}/read")
    void readNotification(@PathVariable UUID id);

    @GetMapping(ApiPaths.ROOT + "/me/notifications/unread")
    UnreadCount unreadNotifications();

    @PostMapping(ApiPaths.ROOT + "/me/notifications/read-all")
    void readAllNotifications();
}
