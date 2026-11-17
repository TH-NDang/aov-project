package com.wikiaov.community.community.internal.social.application;

import com.wikiaov.community.community.internal.application.PageViews.*;
import com.wikiaov.community.community.internal.pages.application.*;
import com.wikiaov.community.community.internal.social.persistence.*;
import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.platform.PageSlice;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PageNotifications {
    private final PageNotificationRepository notifications;
    private final PageFollowRepository follows;

    public PageNotifications(PageNotificationRepository notifications, PageFollowRepository follows) {
        this.notifications = notifications;
        this.follows = follows;
    }

    /** Sends the message to every follower of the page, in batches of 100. */
    public void followers(UUID pageId, String message) {
        int page = 0;
        org.springframework.data.domain.Page<PageFollow> batch;
        do {
            batch = follows.findByPageId(pageId, PageProfiles.paging(page++, 100));
            batch.forEach(row -> send(row.getActor(), pageId, message));
        } while (batch.hasNext());
    }

    public void send(String actor, UUID pageId, String message) {
        var row = new PageNotification();
        row.setActor(actor);
        row.setPageId(pageId);
        row.setMessage(message);
        row.setCreatedAt(Instant.now());
        notifications.save(row);
    }

    @Transactional(readOnly = true)
    public PageSlice<Notification> inbox(int page, int size) {
        return PageSlice.from(notifications
                .findByActorOrderByCreatedAtDesc(CommunityActor.require().key(), PageProfiles.paging(page, size))
                .map(row -> new Notification(row.getId(), row.getPageId(), row.getMessage(), row.getCreatedAt(),
                        row.getReadAt() != null)));
    }

    @Transactional(readOnly = true)
    public UnreadCount unread() {
        return new UnreadCount(notifications.countByActorAndReadAtIsNull(CommunityActor.require().key()));
    }

    public void readAll() {
        notifications.readAll(CommunityActor.require().key(), Instant.now());
    }

    public void read(UUID id) {
        var row = notifications.findById(id).orElseThrow(PageAccess::missing);
        if (!row.getActor().equals(CommunityActor.require().key()))
            throw PageAccess.forbidden();
        row.setReadAt(Instant.now());
    }
}
