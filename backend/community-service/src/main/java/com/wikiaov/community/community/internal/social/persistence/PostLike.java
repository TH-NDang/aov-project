package com.wikiaov.community.community.internal.social.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Read model for likes; rows are written by {@link PostLikeRepository#like} so repeats never fail. */
@Entity
@Table(schema = "community", name = "post_like")
public class PostLike {
    @Id
    private UUID id;
    private UUID postId;
    private String actor;
    private Instant createdAt;

    protected PostLike() {
    }

    public UUID getId() {
        return id;
    }

    public UUID getPostId() {
        return postId;
    }

    public String getActor() {
        return actor;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
