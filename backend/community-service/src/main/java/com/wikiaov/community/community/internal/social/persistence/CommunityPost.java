package com.wikiaov.community.community.internal.social.persistence;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "community", name = "post")
public class CommunityPost {
    @Id
    private UUID id;
    @Version
    private long version;
    private UUID pageId;
    private String actor;
    private String authorName;
    private boolean asPage;
    private String body;
    private String status;
    private Instant createdAt;
    private Instant updatedAt;

    public CommunityPost() {
        this.id = UUID.randomUUID();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID value) {
        this.id = value;
    }

    public long getVersion() {
        return version;
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

    public String getAuthorName() {
        return authorName;
    }

    public void setAuthorName(String value) {
        this.authorName = value;
    }

    public boolean getAsPage() {
        return asPage;
    }

    public void setAsPage(boolean value) {
        this.asPage = value;
    }

    public String getBody() {
        return body;
    }

    public void setBody(String value) {
        this.body = value;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String value) {
        this.status = value;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant value) {
        this.createdAt = value;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant value) {
        this.updatedAt = value;
    }

}
