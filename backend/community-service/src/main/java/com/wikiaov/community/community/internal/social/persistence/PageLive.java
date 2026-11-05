package com.wikiaov.community.community.internal.social.persistence;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** A page's live broadcast, kept apart from the page row so toggling it never changes the draft version. */
@Entity
@Table(schema = "community", name = "page_live")
public class PageLive {
    @Id
    private UUID pageId;
    private String url;
    private String title;
    private Instant startedAt;

    public UUID getPageId() {
        return pageId;
    }

    public void setPageId(UUID value) {
        this.pageId = value;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String value) {
        this.url = value;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String value) {
        this.title = value;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant value) {
        this.startedAt = value;
    }
}
