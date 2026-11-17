package com.wikiaov.community.community.internal.pages.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "community", name = "page_audit")
public class PageAudit {
    @Id
    private UUID id;
    private UUID pageId;
    private String actor;
    private String action;
    private Instant occurredAt;

    public PageAudit() {
        this.id = UUID.randomUUID();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID value) {
        this.id = value;
    }

    public UUID getPageId() {
        return pageId;
    }

    public void setPageId(UUID value) {
        this.pageId = value;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String value) {
        this.actor = value;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String value) {
        this.action = value;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(Instant value) {
        this.occurredAt = value;
    }

}
