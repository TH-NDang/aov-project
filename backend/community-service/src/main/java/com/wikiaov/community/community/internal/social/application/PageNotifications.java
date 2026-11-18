package com.wikiaov.community.community.internal.social.application;

import com.wikiaov.community.community.internal.application.PageViews.Notification;
import com.wikiaov.community.community.internal.application.PageViews.UnreadCount;
import com.wikiaov.community.community.internal.domain.NotificationKind;
import com.wikiaov.community.community.internal.pages.application.PageAccess;
import com.wikiaov.community.community.internal.pages.application.PageProfiles;
import com.wikiaov.community.community.internal.social.persistence.PageFollow;
import com.wikiaov.community.community.internal.social.persistence.PageFollowRepository;
import com.wikiaov.community.community.internal.social.persistence.PageNotification;
import com.wikiaov.community.community.internal.social.persistence.PageNotificationRepository;
import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.platform.PageSlice;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PageNotifications {
    /** Followers notified per read, so a popular page never loads every follower at once. */
    private static final int FOLLOWER_BATCH = 100;
    private final PageNotificationRepository notifications;
    private final PageFollowRepository follows;

    public PageNotifications(PageNotificationRepository notifications, PageFollowRepository follows) {
        this.notifications = notifications;
        this.follows = follows;
    }

    /** Sends the notification to every follower of the page, in batches of 100. */
    public void followers(UUID pageId, NotificationKind kind, Map<String, String> parameters) {
        requireParameters(kind, parameters);

        int page = 0;
        Page<PageFollow> batch;
        do {
            batch = follows.findByPageId(pageId, PageProfiles.paging(page++, FOLLOWER_BATCH));
            batch.forEach(row -> save(row.getActor(), pageId, kind, parameters));
        } while (batch.hasNext());
    }

    /** Sends a notification whose kind needs no parameters. */
    public void send(String actor, UUID pageId, NotificationKind kind) {
        requireParameters(kind, Map.of());

        save(actor, pageId, kind, Map.of());
    }

    @Transactional(readOnly = true)
    public PageSlice<Notification> inbox(int page, int size) {
        return PageSlice.from(notifications
                .findByActorOrderByCreatedAtDesc(CommunityActor.require().key(), PageProfiles.paging(page, size))
                .map(row -> new Notification(row.getId(), row.getPageId(), row.getKind(), row.getParameters(),
                        row.getMessage(), row.getCreatedAt(), row.getReadAt() != null)));
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
        if (!row.getActor().equals(CommunityActor.require().key())) {
            throw PageAccess.forbidden();
        }
        row.setReadAt(Instant.now());
    }

    private void save(String actor, UUID pageId, NotificationKind kind, Map<String, String> parameters) {
        notifications.save(PageNotification.of(actor, pageId, kind, parameters, Instant.now()));
    }

    /** A kind is worded from exactly its parameters, so a missing or extra one is a programming error. */
    private static void requireParameters(NotificationKind kind, Map<String, String> parameters) {
        if (!kind.parameters().equals(parameters.keySet())) {
            throw new IllegalStateException("Notification " + kind + " needs the parameters " + kind.parameters()
                    + " but got " + parameters.keySet() + ".");
        }
    }
}
