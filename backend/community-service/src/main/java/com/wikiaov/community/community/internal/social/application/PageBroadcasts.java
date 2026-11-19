package com.wikiaov.community.community.internal.social.application;

import com.wikiaov.community.community.internal.application.PageChecks;
import com.wikiaov.community.community.internal.application.PageViews.Live;
import com.wikiaov.community.community.internal.application.PageViews.Profile;
import com.wikiaov.community.community.internal.domain.NotificationKind;
import com.wikiaov.community.community.internal.domain.PageAuditAction;
import com.wikiaov.community.community.internal.domain.PageContent;
import com.wikiaov.community.community.internal.domain.PageContent.Role;
import com.wikiaov.community.community.internal.domain.PageRules;
import com.wikiaov.community.community.internal.pages.application.PageAccess;
import com.wikiaov.community.community.internal.pages.application.PageProfiles;
import com.wikiaov.community.community.internal.pages.persistence.PageRecord;
import com.wikiaov.community.community.internal.social.persistence.PageLive;
import com.wikiaov.community.community.internal.social.persistence.PageLiveRepository;
import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.platform.PageSlice;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Live broadcasts announced by a page's managers or by competition editors; see spec 04, live status. */
@Service
@Transactional
public class PageBroadcasts {
    private final PageAccess access;
    private final PageLiveRepository lives;
    private final PageNotifications notifications;
    private final PageProfiles profiles;

    public PageBroadcasts(PageAccess access, PageLiveRepository lives, PageNotifications notifications,
            PageProfiles profiles) {
        this.access = access;
        this.lives = lives;
        this.notifications = notifications;
        this.profiles = profiles;
    }

    public Live start(UUID pageId, String url, String title) {
        var actor = CommunityActor.require();
        PageChecks.live(url, title);
        var page = access.lock(pageId);
        access.require(pageId, actor, Role.OWNER, Role.EDITOR);

        return begin(page, actor, url, title);
    }

    @PreAuthorize("hasAuthority('tournament:write') and hasAuthority('tournament:read')")
    public Live startAsEditor(UUID pageId, String url, String title) {
        var actor = CommunityActor.require();
        PageChecks.live(url, title);
        var page = access.lock(pageId);

        return begin(page, actor, url, title);
    }

    public void end(UUID pageId) {
        var actor = CommunityActor.require();
        access.lock(pageId);
        access.require(pageId, actor, Role.OWNER, Role.EDITOR);

        stop(pageId, actor);
    }

    @PreAuthorize("hasAuthority('tournament:write') and hasAuthority('tournament:read')")
    public void endAsEditor(UUID pageId) {
        var actor = CommunityActor.require();
        access.lock(pageId);

        stop(pageId, actor);
    }

    @Transactional(readOnly = true)
    public PageSlice<Profile> active(int page, int size) {
        var since = Instant.now().minus(PageRules.LIVE_WINDOW);
        return PageSlice.from(lives.active(since, PageContent.Kind.CIRCUIT, PageProfiles.paging(page, size))
                .map(live -> profiles.read(live.getPageId(), false)));
    }

    /** Followers hear about a broadcast once: changing the link or title of a running one sends nothing. */
    private Live begin(PageRecord page, CommunityActor actor, String url, String title) {
        if (page.getPublishedContent() == null) {
            throw PageAccess.missing();
        }
        PageAccess.requireCommunity(page);
        var now = Instant.now();
        var row = lives.findById(page.getId()).orElseGet(() -> {
            var created = new PageLive();
            created.setPageId(page.getId());
            return created;
        });
        boolean starting = row.getStartedAt() == null || !row.getStartedAt().isAfter(now.minus(PageRules.LIVE_WINDOW));

        if (starting) {
            row.setStartedAt(now);
        }
        row.setUrl(url.strip());
        row.setTitle(title.strip());
        lives.saveAndFlush(row);
        access.audit(page.getId(), actor,
                starting ? PageAuditAction.PAGE_LIVE_STARTED : PageAuditAction.PAGE_LIVE_UPDATED);
        if (starting) {
            notifications.followers(page.getId(), NotificationKind.PAGE_LIVE_STARTED, Map.of(NotificationKind.PAGE_NAME,
                    page.getPublishedContent().name(), NotificationKind.TITLE, row.getTitle()));
        }

        return new Live(row.getUrl(), row.getTitle(), row.getStartedAt());
    }

    private void stop(UUID pageId, CommunityActor actor) {
        if (!lives.existsById(pageId)) {
            return;
        }

        lives.deleteById(pageId);
        lives.flush();
        access.audit(pageId, actor, PageAuditAction.PAGE_LIVE_ENDED);
    }
}
