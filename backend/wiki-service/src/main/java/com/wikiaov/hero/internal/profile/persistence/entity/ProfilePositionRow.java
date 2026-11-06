package com.wikiaov.hero.internal.profile.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(schema = "hero", name = "hero_profile_position")
@IdClass(ProfilePositionRow.Key.class)
public class ProfilePositionRow extends AssignedIdentifierEntity<ProfilePositionRow.Key> {
    @Id
    private UUID profileRevisionId;

    @Id
    private String positionCode;

    @Override
    public Key getId() {
        return new Key(profileRevisionId, positionCode);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID profileRevisionId;
        public String positionCode;
    }
}
