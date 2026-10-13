package com.wikiaov.user.internal.persistence.entity;

import com.wikiaov.user.internal.domain.ProfileInput;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.data.domain.Persistable;

@Entity
@Table(name = "profile", schema = "user_profile")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Profile implements Persistable<UUID> {
    @Id
    private UUID id;
    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String issuer;
    @Column(nullable = false, updatable = false, columnDefinition = "text")
    private String subject;
    @Column(name = "display_name", nullable = false, length = 80)
    private String displayName;
    @Column(nullable = false, length = 1000)
    private String biography;
    @Column(nullable = false, length = 35)
    private String locale;
    @Column(name = "time_zone", nullable = false, length = 64)
    private String timeZone;
    @Column(name = "avatar_asset_id")
    private @Nullable UUID avatarAssetId;
    @Version
    @Column(nullable = false)
    private long version = 1;
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    @Transient
    private boolean newEntity = true;

    public static Profile create(String issuer, String subject, ProfileInput input, Instant now) {
        Profile profile = new Profile();
        profile.id = UUID.randomUUID();
        profile.issuer = issuer;
        profile.subject = subject;
        profile.createdAt = now;
        profile.update(input, now);
        return profile;
    }

    public void update(ProfileInput input, Instant now) {
        displayName = input.displayName();
        biography = input.biography();
        locale = input.locale();
        timeZone = input.timeZone();
        avatarAssetId = input.avatarAssetId();
        // Every accepted save must dirty the entity, even when a test clock is fixed.
        updatedAt = updatedAt != null && !now.isAfter(updatedAt) ? updatedAt.plusNanos(1000) : now;
    }

    @Override
    public boolean isNew() {
        return newEntity;
    }

    @PostLoad
    @PostPersist
    private void markPersisted() {
        newEntity = false;
    }
}
