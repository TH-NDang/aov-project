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
@Table(schema = "hero", name = "hero_profile_role")
@IdClass(ProfileRoleRow.Key.class)
public class ProfileRoleRow extends AssignedIdentifierEntity<ProfileRoleRow.Key> {
    @Id
    private UUID profileRevisionId;

    @Id
    private String roleCode;

    @Override
    public Key getId() {
        return new Key(profileRevisionId, roleCode);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID profileRevisionId;
        public String roleCode;
    }
}
