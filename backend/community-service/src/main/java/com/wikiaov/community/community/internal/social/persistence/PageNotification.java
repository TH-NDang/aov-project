package com.wikiaov.community.community.internal.social.persistence;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "community", name = "notification")
public class PageNotification {
    @Id
    private UUID id;
    private String actor;
    private UUID pageId;
    private String message;
    private Instant readAt;
    private Instant createdAt;

    public PageNotification() {
        this.id = UUID.randomUUID();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID value) {
        this.id = value;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String value) {
        this.actor = value;
    }

    public UUID getPageId() {
        return pageId;
    }

    public void setPageId(UUID value) {
        this.pageId = value;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String value) {
        this.message = value;
    }

    public Instant getReadAt() {
        return readAt;
    }

    public void setReadAt(Instant value) {
        this.readAt = value;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant value) {
        this.createdAt = value;
    }

}
