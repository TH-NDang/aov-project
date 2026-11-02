package com.wikiaov.community.community.internal.social.application;

import com.wikiaov.community.community.internal.application.PageViews.*;
import com.wikiaov.community.community.internal.pages.application.*;
import com.wikiaov.community.community.internal.social.persistence.*;
import com.wikiaov.community.platform.CommunityActor;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PageNotifications {
    private final PageNotificationRepository notifications;

    public PageNotifications(PageNotificationRepository notifications) {
        this.notifications = notifications;
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
    public Slice<Notification> inbox(int page, int size) {
        return Slice.of(notifications
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
