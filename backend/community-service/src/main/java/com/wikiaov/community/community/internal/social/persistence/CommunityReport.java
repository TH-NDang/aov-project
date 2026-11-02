package com.wikiaov.community.community.internal.social.persistence;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "community", name = "report")
public class CommunityReport {
    @Id
    private UUID id;
    private UUID pageId;
    private UUID postId;
    private UUID commentId;
    private String actor;
    private String reason;
    private boolean resolved;
    private String resolution;
    private Instant createdAt;

    public CommunityReport() {
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

    public UUID getPostId() {
        return postId;
    }

    public void setPostId(UUID value) {
        this.postId = value;
    }

    public UUID getCommentId() {
        return commentId;
    }

    public void setCommentId(UUID value) {
        this.commentId = value;
    }

    public String getActor() {
        return actor;
    }

    public void setActor(String value) {
        this.actor = value;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String value) {
        this.reason = value;
    }

    public boolean getResolved() {
        return resolved;
    }

    public void setResolved(boolean value) {
        this.resolved = value;
    }

    public String getResolution() {
        return resolution;
    }

    public void setResolution(String value) {
        this.resolution = value;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant value) {
        this.createdAt = value;
    }

}
