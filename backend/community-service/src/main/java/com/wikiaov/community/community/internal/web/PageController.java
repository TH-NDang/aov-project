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
import com.wikiaov.community.community.internal.domain.PostContent;
import com.wikiaov.community.community.internal.membership.application.PageMemberships;
import com.wikiaov.community.community.internal.pages.application.PageProfiles;
import com.wikiaov.community.community.internal.social.application.PageBroadcasts;
import com.wikiaov.community.community.internal.social.application.PageCommunity;
import com.wikiaov.community.community.internal.social.application.PageNotifications;
import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PageController implements PageApi {
    private final PageProfiles profiles;
    private final PageMemberships memberships;
    private final PageCommunity social;
    private final PageNotifications notifications;
    private final PageBroadcasts broadcasts;
    private final HttpServletRequest request;

    public PageController(PageProfiles profiles, PageMemberships memberships, PageCommunity social,
            PageNotifications notifications, PageBroadcasts broadcasts,
            HttpServletRequest request) {
        this.profiles = profiles;
        this.memberships = memberships;
        this.social = social;
        this.notifications = notifications;
        this.broadcasts = broadcasts;
        this.request = request;
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/pages", version = "1")
    public PageSlice<Profile> pages(@RequestParam(required = false) String kind,
            @RequestParam(defaultValue = "") String q, @RequestParam(required = false) String personRole,
            @RequestParam(required = false) UUID organizationId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        QueryParameters.requireOnly(request, Set.of("kind", "q", "personRole", "organizationId", "page", "size"));
        return profiles.list(kind, q, personRole, organizationId, page, size, false);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/pages/{id}", version = "1")
    public Profile page(@PathVariable UUID id) {
        QueryParameters.requireOnly(request, Set.of());
        return profiles.read(id, false);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/pages/by-code/{code}", version = "1")
    public Profile byCode(@PathVariable String code) {
        QueryParameters.requireOnly(request, Set.of());
        return profiles.byCode(code);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/admin/pages", version = "1")
    public PageSlice<Profile> adminPages(@RequestParam(required = false) String kind,
            @RequestParam(defaultValue = "") String q, @RequestParam(required = false) String personRole,
            @RequestParam(defaultValue = "") String country, @RequestParam(defaultValue = "") List<UUID> entityIds,
            @RequestParam(defaultValue = "RECENT") String sort, @RequestParam(required = false) UUID relatedPageId,
            @RequestParam(required = false) UUID organizationId, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        QueryParameters.requireOnly(request,
                Set.of("kind", "q", "personRole", "country", "sort", "relatedPageId", "organizationId", "page",
                        "size"),
                Set.of("entityIds"));
        var filter = new PageProfiles.DirectoryFilter(kind, q, personRole, country, entityIds, sort, relatedPageId,
                organizationId);
        return profiles.adminDirectory(filter, page, size);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/pages/by-entity/{kind}/{id}", version = "1")
    public Profile byEntity(@PathVariable String kind, @PathVariable UUID id) {
        QueryParameters.requireOnly(request, Set.of());
        return profiles.byEntity(kind, id);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/admin/pages/{id}", version = "1")
    public Profile adminPage(@PathVariable UUID id) {
        return profiles.read(id, true);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/admin/pages/{id}/teams", version = "1")
    public List<TeamAffiliation> adminTeams(@PathVariable UUID id) {
        QueryParameters.requireOnly(request, Set.of());
        return profiles.teams(id, true);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/pages/{id}/teams", version = "1")
    public List<TeamAffiliation> teams(@PathVariable UUID id) {
        QueryParameters.requireOnly(request, Set.of());
        return profiles.teams(id, false);
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/admin/pages", version = "1")
    public Profile create(@RequestBody CreatePage body) {
        return profiles.create(body.kind(), body.code(), body.entityId(), body.content());
    }

    @Override
    @PutMapping(path = ApiPaths.ROOT + "/admin/pages/{id}", version = "1")
    public Profile save(@PathVariable UUID id, @RequestBody SavePage body) {
        return profiles.save(id, body.version(), body.content());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/admin/pages/{id}/publish", version = "1")
    public Profile publish(@PathVariable UUID id, @RequestBody Version body) {
        return profiles.publish(id, body.version());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/admin/pages/{id}/withdraw", version = "1")
    public Profile withdraw(@PathVariable UUID id, @RequestBody Version body) {
        return profiles.withdraw(id, body.version());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/admin/pages/{id}/delete", version = "1")
    public void delete(@PathVariable UUID id, @RequestBody Version body) {
        profiles.delete(id, body.version());
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me", version = "1")
    public Map<String, Object> me() {
        var actor = CommunityActor.require();
        return Map.of("name", actor.name(), "capabilities", actor.capabilities());
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/pages/{id}/profile", version = "1")
    public Profile managedProfile(@PathVariable UUID id) {
        return profiles.managed(id);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/pages/{id}/feed", version = "1")
    public PageSlice<Post> feed(@PathVariable UUID id, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return social.feed(id, page, size);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/pages", version = "1")
    public List<Profile> managed() {
        return profiles.managed();
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/pages/{id}", version = "1")
    public Map<String, Object> pageMe(@PathVariable UUID id) {
        return profiles.me(id);
    }

    @Override
    @PutMapping(path = ApiPaths.ROOT + "/me/pages/{id}/presentation", version = "1")
    public Profile presentation(@PathVariable UUID id, @RequestBody PresentationWrite body) {
        return profiles.presentation(id, body.version(), body.content());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/pages/{id}/claims", version = "1")
    public Claim claim(@PathVariable UUID id, @RequestBody Proof body) {
        return memberships.request(id, body.evidence());
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/claims", version = "1")
    public List<Claim> myClaims() {
        return memberships.mine();
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/admin/page-claims", version = "1")
    public PageSlice<Claim> claims(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return memberships.pending(page, size);
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/admin/page-claims/{id}/decision", version = "1")
    public Claim decision(@PathVariable UUID id, @RequestBody Decision body) {
        return memberships.decide(id, body.version(), body.approve(), body.resolution());
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/pages/{id}/members", version = "1")
    public List<Member> members(@PathVariable UUID id) {
        return memberships.members(id);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/admin/pages/{id}/handover", version = "1")
    public Handover handover(@PathVariable UUID id) {
        return memberships.handover(id);
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/admin/pages/{id}/handover", version = "1")
    public Map<String, Object> issueHandover(@PathVariable UUID id) {
        return memberships.issueHandover(id);
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/admin/pages/{id}/handover/cancel", version = "1")
    public void cancelHandover(@PathVariable UUID id) {
        memberships.cancelHandover(id);
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/pages/{id}/invitations", version = "1")
    public Map<String, Object> invite(@PathVariable UUID id, @RequestBody Invite body) {
        return memberships.invite(id, body.role());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/invitations/accept", version = "1")
    public Map<String, UUID> accept(@RequestBody Token body) {
        return Map.of("pageId", memberships.accept(body.token()));
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/pages/{id}/members/{memberId}/revoke", version = "1")
    public void revoke(@PathVariable UUID id, @PathVariable UUID memberId) {
        memberships.revoke(id, memberId);
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/pages/{id}/members/{memberId}/transfer", version = "1")
    public void transfer(@PathVariable UUID id, @PathVariable UUID memberId) {
        memberships.transfer(id, memberId);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/pages/{id}/posts", version = "1")
    public PageSlice<Post> posts(@PathVariable UUID id, @RequestParam(required = false) String kind,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size) {
        QueryParameters.requireOnly(request, Set.of("kind", "page", "size"));
        return social.posts(id, kind, page, size, false);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/pages/{id}/posts", version = "1")
    public PageSlice<Post> managePosts(@PathVariable UUID id, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return social.posts(id, null, page, size, true);
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/pages/{id}/posts", version = "1")
    public Post writePost(@PathVariable UUID id, @RequestBody PostWrite body) {
        return social.write(id, null, null, content(body), body.asPage(), body.publish());
    }

    @Override
    @PutMapping(path = ApiPaths.ROOT + "/me/pages/{id}/posts/{postId}", version = "1")
    public Post updatePost(@PathVariable UUID id, @PathVariable UUID postId, @RequestBody PostWrite body) {
        return social.write(id, postId, body.version(), content(body), body.asPage(), body.publish());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/pages/{id}/posts/{postId}/pin", version = "1")
    public Post pinPost(@PathVariable UUID id, @PathVariable UUID postId, @RequestBody Pin body) {
        return social.pin(id, postId, body.pinned());
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/posts", version = "1")
    public PageSlice<FeedPost> latestPosts(@RequestParam(required = false) String kind,
            @RequestParam(required = false) String q, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        QueryParameters.requireOnly(request, Set.of("kind", "q", "page", "size"));
        return social.latest(kind, q, page, size);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/feed", version = "1")
    public PageSlice<FeedPost> timeline(@RequestParam(defaultValue = "false") boolean following,
            @RequestParam(required = false) String kind, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        QueryParameters.requireOnly(request, Set.of("following", "kind", "page", "size"));
        return social.timeline(following, kind, page, size);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/live", version = "1")
    public PageSlice<Profile> live(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return broadcasts.active(page, size);
    }

    @Override
    @PutMapping(path = ApiPaths.ROOT + "/me/pages/{id}/live", version = "1")
    public Live startLive(@PathVariable UUID id, @RequestBody LiveWrite body) {
        return broadcasts.start(id, body.url(), body.title());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/pages/{id}/live/end", version = "1")
    public void endLive(@PathVariable UUID id) {
        broadcasts.end(id);
    }

    @Override
    @PutMapping(path = ApiPaths.ROOT + "/admin/pages/{id}/live", version = "1")
    public Live startLiveAsEditor(@PathVariable UUID id, @RequestBody LiveWrite body) {
        return broadcasts.startAsEditor(id, body.url(), body.title());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/admin/pages/{id}/live/end", version = "1")
    public void endLiveAsEditor(@PathVariable UUID id) {
        broadcasts.endAsEditor(id);
    }

    private static PostContent content(PostWrite body) {
        return new PostContent(body.kind(), body.title(), body.body(),
                body.videoUrl(), body.imageUrls());
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/follows", version = "1")
    public PageSlice<Profile> follows(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return profiles.followed(page, size);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/suggestions", version = "1")
    public PageSlice<Profile> suggestions(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "5") int size) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return profiles.suggestions(page, size);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/posts/{id}/comments", version = "1")
    public PageSlice<Comment> comments(@PathVariable UUID id, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return social.comments(id, page, size);
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/posts/{id}/comments", version = "1")
    public Comment comment(@PathVariable UUID id, @RequestBody CommentWrite body) {
        return social.comment(id, body.body(), body.asPage());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/posts/{id}/like", version = "1")
    public Liking like(@PathVariable UUID id, @RequestBody Like body) {
        return social.like(id, body.liked());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/pages/{id}/follow", version = "1")
    public void follow(@PathVariable UUID id, @RequestBody Follow body) {
        social.follow(id, body.following());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/pages/{id}/reports", version = "1")
    public void report(@PathVariable UUID id, @RequestBody ReportWrite body) {
        social.report(id, body.postId(), body.commentId(), body.reason());
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/pages/{id}/moderate", version = "1")
    public void moderate(@PathVariable UUID id, @RequestBody Moderation body) {
        social.hide(id, body.postId(), body.commentId(), body.hidden());
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/admin/community-reports", version = "1")
    public PageSlice<Report> reports(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return social.reports(page, size);
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/admin/community-reports/{id}/resolve", version = "1")
    public void resolve(@PathVariable UUID id, @RequestBody Resolution body) {
        social.resolve(id, body.resolution(), body.hide());
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/notifications", version = "1")
    public PageSlice<Notification> notifications(@RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "24") int size) {
        QueryParameters.requireOnly(request, Set.of("page", "size"));
        return notifications.inbox(page, size);
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/notifications/{id}/read", version = "1")
    public void readNotification(@PathVariable UUID id) {
        notifications.read(id);
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/me/notifications/unread", version = "1")
    public UnreadCount unreadNotifications() {
        return notifications.unread();
    }

    @Override
    @PostMapping(path = ApiPaths.ROOT + "/me/notifications/read-all", version = "1")
    public void readAllNotifications() {
        notifications.readAll();
    }
}
