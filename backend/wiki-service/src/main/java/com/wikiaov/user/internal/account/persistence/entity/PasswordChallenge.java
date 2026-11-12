package com.wikiaov.user.internal.account.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Persistable;

/** Email code that must be confirmed before a new password is sent to the identity provider. */
@Entity
@Table(name = "password_change_challenge", schema = "user_profile")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PasswordChallenge implements Persistable<UUID> {
    public enum Status {
        PENDING,
        APPLYING,
        USED,
        SUPERSEDED,
        FAILED
    }

    @Id
    private UUID id;
    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String issuer;
    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String subject;
    @Column(name = "code_hash", nullable = false, updatable = false)
    private byte[] codeHash;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;
    @Column(name = "failed_attempts", nullable = false)
    private short failedAttempts;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "expires_at", nullable = false, updatable = false)
    private Instant expiresAt;
    @Column(name = "used_at")
    private @Nullable Instant usedAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Transient
    private boolean persisted;

    public PasswordChallenge(UUID id, String issuer, String subject, byte[] codeHash, Instant createdAt,
            Instant expiresAt) {
        this.id = id;
        this.issuer = issuer;
        this.subject = subject;
        this.codeHash = codeHash.clone();
        this.status = Status.PENDING;
        this.createdAt = createdAt;
        this.expiresAt = expiresAt;
        this.updatedAt = createdAt;
    }

    public boolean belongsTo(String issuer, String subject) {
        return this.issuer.equals(issuer) && this.subject.equals(subject);
    }

    public byte[] getCodeHash() {
        return codeHash.clone();
    }

    public void recordFailedAttempt(Instant now) {
        failedAttempts++;
        updatedAt = now;
    }

    public void moveTo(Status next, Instant now) {
        status = next;
        usedAt = next == Status.USED ? now : null;
        updatedAt = now;
    }

    @Override
    public boolean isNew() {
        return !persisted;
    }

    @PostLoad
    @PostPersist
    void markPersisted() {
        persisted = true;
    }
}
