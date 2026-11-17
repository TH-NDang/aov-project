package com.wikiaov.community.community.internal.membership.persistence;

import com.wikiaov.community.community.internal.domain.PageContent.Role;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "community", name = "page_invitation")
public class PageInvitation {
    @Version
    private long version;
    @Id
    private UUID id;
    private UUID pageId;
    private String tokenHash;
    @Enumerated(EnumType.STRING)
    private Role role;
    private Instant expiresAt;
    private Instant acceptedAt;

    public PageInvitation() {
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

    public String getTokenHash() {
        return tokenHash;
    }

    public void setTokenHash(String value) {
        this.tokenHash = value;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role value) {
        this.role = value;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant value) {
        this.expiresAt = value;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public void setAcceptedAt(Instant value) {
        this.acceptedAt = value;
    }

}
