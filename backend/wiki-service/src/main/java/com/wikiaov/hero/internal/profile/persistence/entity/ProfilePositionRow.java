package com.wikiaov.hero.internal.profile.persistence.entity;

import com.wikiaov.hero.internal.domain.HeroContent.Position;
import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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
    @Enumerated(EnumType.STRING)
    private Position positionCode;

    @Override
    public Key getId() {
        return new Key(profileRevisionId, positionCode);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID profileRevisionId;
        public Position positionCode;
    }
}
