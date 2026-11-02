package com.wikiaov.community.community.internal.social.persistence;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "community", name = "comment")
public class CommunityComment {
    @Id
    private UUID id;
    private UUID postId;
    private String actor;
    private String authorName;
    private boolean asPage;
    private String body;
    private boolean hidden;
    private Instant createdAt;

    public CommunityComment() {
        this.id = UUID.randomUUID();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID value) {
        this.id = value;
    }

    public UUID getPostId() {
        return postId;
    }

    public void setPostId(UUID value) {
        this.postId = value;
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

    public boolean getHidden() {
        return hidden;
    }

    public void setHidden(boolean value) {
        this.hidden = value;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant value) {
        this.createdAt = value;
    }

}
