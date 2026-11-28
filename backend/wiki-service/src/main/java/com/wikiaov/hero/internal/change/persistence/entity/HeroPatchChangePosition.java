package com.wikiaov.hero.internal.change.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** Where an editor placed a hero's change set in its patch's list, read by Admin and the public patch page. */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@Table(schema = "hero", name = "hero_patch_change_position")
public class HeroPatchChangePosition extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID changeSetId;
    private int position;
    @Version
    private long lockVersion;
    private Instant updatedAt;
    private String updatedByIssuer;
    private String updatedBySubject;

    public static HeroPatchChangePosition place(UUID changeSetId, int position, Instant at, String issuer,
            String subject) {
        var value = new HeroPatchChangePosition();
        value.changeSetId = changeSetId;
        value.move(position, at, issuer, subject);
        return value;
    }

    public void move(int position, Instant at, String issuer, String subject) {
        this.position = position;
        this.updatedAt = at;
        this.updatedByIssuer = issuer;
        this.updatedBySubject = subject;
    }

    @Override
    public UUID getId() {
        return changeSetId;
    }
}
