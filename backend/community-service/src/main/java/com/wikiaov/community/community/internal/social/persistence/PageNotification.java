package com.wikiaov.community.community.internal.social.persistence;

import com.wikiaov.community.community.internal.domain.NotificationKind;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import org.jspecify.annotations.Nullable;

/**
 * One line of an account's inbox. New rows carry a kind and its parameters; rows written before kinds existed keep
 * the sentence they were sent with in {@code message} and have no kind.
 */
@Entity
@Table(schema = "community", name = "notification")
public class PageNotification {
    @Id
    private UUID id;
    private String actor;
    private UUID pageId;
    @Enumerated(EnumType.STRING)
    private @Nullable NotificationKind kind;
    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, String> parameters = Map.of();
    private @Nullable String message;
    private @Nullable Instant readAt;
    private Instant createdAt;

    protected PageNotification() {
    }

    public static PageNotification of(String actor, UUID pageId, NotificationKind kind,
            Map<String, String> parameters, Instant createdAt) {
        var row = new PageNotification();
        row.id = UUID.randomUUID();
        row.actor = actor;
        row.pageId = pageId;
        row.kind = kind;
        row.parameters = Map.copyOf(parameters);
        row.createdAt = createdAt;
        return row;
    }

    public UUID getId() {
        return id;
    }

    public String getActor() {
        return actor;
    }

    public UUID getPageId() {
        return pageId;
    }

    public @Nullable NotificationKind getKind() {
        return kind;
    }

    public Map<String, String> getParameters() {
        return parameters;
    }

    public @Nullable String getMessage() {
        return message;
    }

    public @Nullable Instant getReadAt() {
        return readAt;
    }

    public void setReadAt(Instant value) {
        this.readAt = value;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
