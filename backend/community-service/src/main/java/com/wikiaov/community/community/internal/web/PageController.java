package com.wikiaov.community.community.internal.web;

import com.wikiaov.community.community.internal.application.PageViews.*;
import com.wikiaov.community.community.internal.membership.application.PageMemberships;
import com.wikiaov.community.community.internal.pages.application.PageProfiles;
import com.wikiaov.community.community.internal.social.application.*;
import com.wikiaov.community.platform.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class PageController implements PageApi {
    private final PageProfiles profiles;
    private final PageMemberships memberships;
    private final PageCommunity social;
    private final PageNotifications notifications;
    private final jakarta.servlet.http.HttpServletRequest request;

    private void parameters(String... allowed) {
        var names = Set.of(allowed);
        for (var key : request.getParameterMap().keySet())
            if (!names.contains(key))
                throw com.wikiaov.community.community.internal.domain.PageRules
                        .invalid("Unsupported query parameter: " + key);
    }

    @GetMapping(value = ApiPaths.ROOT + "/pages/by-entity/{kind}/{id}", version = "1")
    public Profile byEntity(@PathVariable String kind, @PathVariable UUID id) {
        return profiles.byEntity(kind, id);
    }

    @GetMapping(value = ApiPaths.ROOT + "/me/pages/{id}/profile", version = "1")
    public Profile managedProfile(@PathVariable UUID id) {
        return profiles.managed(id);
    }

    @GetMapping(value = ApiPaths.ROOT + "/me/pages/{id}/feed", version = "1")
    public Slice<Post> feed(@PathVariable UUID id, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return social.feed(id, page, size);
    }

    public PageController(PageProfiles profiles, PageMemberships memberships, PageCommunity social,
            PageNotifications notifications, jakarta.servlet.http.HttpServletRequest request) {
        this.profiles = profiles;
        this.memberships = memberships;
        this.social = social;
        this.notifications = notifications;
        this.request = request;
    }

    @Override
    public Slice<Profile> pages(String kind, String q, int page, int size) {
        parameters("kind", "q", "page", "size");
        return profiles.list(kind, q, page, size, false);
    }

    @Override
    public Profile page(UUID id) {
        return profiles.read(id, false);
    }

    @Override
    public Profile byCode(String code) {
        return profiles.byCode(code);
    }

    @Override
    public Slice<Profile> adminPages(String kind, String q, int page, int size) {
        return profiles.list(kind, q, page, size, true);
    }

    @Override
    public Profile adminPage(UUID id) {
        return profiles.read(id, true);
    }

    @Override
    public Profile create(CreatePage body) {
        return profiles.create(body.kind(), body.code(), body.entityId(), body.content());
    }

    @Override
    public Profile save(UUID id, SavePage body) {
        return profiles.save(id, body.version(), body.content());
    }

    @Override
    public Profile publish(UUID id, Version body) {
        return profiles.publish(id, body.version(), true);
    }

    @Override
    public Profile withdraw(UUID id, Version body) {
        return profiles.publish(id, body.version(), false);
    }

    @Override
    public void delete(UUID id, Version body) {
        profiles.delete(id, body.version());
    }

    @Override
    public Map<String, Object> me() {
        var actor = CommunityActor.require();
        return Map.of("name", actor.name(), "capabilities", actor.capabilities());
    }

    @Override
    public List<Profile> managed() {
        return profiles.managed();
    }

    @Override
    public Map<String, Object> pageMe(UUID id) {
        return profiles.me(id);
    }

    @Override
    public Profile presentation(UUID id, PresentationWrite body) {
        return profiles.presentation(id, body.version(), body.content());
    }

    @Override
    public Claim claim(UUID id, Proof body) {
        return memberships.request(id, body.evidence());
    }

    @Override
    public List<Claim> myClaims() {
        return memberships.mine();
    }

    @Override
    public Slice<Claim> claims(int page, int size) {
        return memberships.pending(page, size);
    }

    @Override
    public Claim decision(UUID id, Decision body) {
        return memberships.decide(id, body.version(), body.approve(), body.resolution());
    }

    @Override
    public List<Member> members(UUID id) {
        return memberships.members(id);
    }

    @Override
    public Handover handover(UUID id) {
        return memberships.handover(id);
    }

    @Override
    public Map<String, Object> issueHandover(UUID id) {
        return memberships.issueHandover(id);
    }

    @Override
    public void cancelHandover(UUID id) {
        memberships.cancelHandover(id);
    }

    @Override
    public Map<String, Object> invite(UUID id, Invite body) {
        return memberships.invite(id, body.role());
    }

    @Override
    public Map<String, UUID> accept(Token body) {
        return Map.of("pageId", memberships.accept(body.token()));
    }

    @Override
    public void revoke(UUID id, UUID memberId) {
        memberships.revoke(id, memberId);
    }

    @Override
    public void transfer(UUID id, UUID memberId) {
        memberships.transfer(id, memberId);
    }

    @Override
    public Slice<Post> posts(UUID id, int page, int size) {
        parameters("page", "size");
        return social.posts(id, page, size, false);
    }

    @Override
    public Slice<Post> managePosts(UUID id, int page, int size) {
        return social.posts(id, page, size, true);
    }

    @Override
    public Post writePost(UUID id, PostWrite body) {
        return social.write(id, null, null, body.body(), body.asPage(), body.publish());
    }

    @Override
    public Post updatePost(UUID id, UUID postId, PostWrite body) {
        return social.write(id, postId, body.version(), body.body(), body.asPage(), body.publish());
    }

    @Override
    public Slice<FeedPost> latestPosts(int page, int size) {
        parameters("page", "size");
        return social.latest(page, size);
    }

    @Override
    public Slice<FeedPost> timeline(boolean following, int page, int size) {
        parameters("following", "page", "size");
        return social.timeline(following, page, size);
    }

    @Override
    public Slice<Profile> follows(int page, int size) {
        parameters("page", "size");
        return profiles.followed(page, size);
    }

    @Override
    public Slice<Profile> suggestions(int page, int size) {
        parameters("page", "size");
        return profiles.suggestions(page, size);
    }

    @Override
    public Slice<Comment> comments(UUID id, int page, int size) {
        parameters("page", "size");
        return social.comments(id, page, size);
    }

    @Override
    public Comment comment(UUID id, CommentWrite body) {
        return social.comment(id, body.body(), body.asPage());
    }

    @Override
    public Liking like(UUID id, Like body) {
        return social.like(id, body.liked());
    }

    @Override
    public void follow(UUID id, Follow body) {
        social.follow(id, body.following());
    }

    @Override
    public void report(UUID id, ReportWrite body) {
        social.report(id, body.postId(), body.commentId(), body.reason());
    }

    @Override
    public void moderate(UUID id, Moderation body) {
        social.hide(id, body.postId(), body.commentId(), body.hidden());
    }

    @Override
    public Slice<Report> reports(int page, int size) {
        return social.reports(page, size);
    }

    @Override
    public void resolve(UUID id, Resolution body) {
        social.resolve(id, body.resolution(), body.hide());
    }

    @Override
    public Slice<Notification> notifications(int page, int size) {
        return notifications.inbox(page, size);
    }

    @Override
    public void readNotification(UUID id) {
        notifications.read(id);
    }

    @Override
    public UnreadCount unreadNotifications() {
        return notifications.unread();
    }

    @Override
    public void readAllNotifications() {
        notifications.readAll();
    }
}
