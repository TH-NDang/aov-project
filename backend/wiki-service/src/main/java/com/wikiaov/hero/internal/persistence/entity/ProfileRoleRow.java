package com.wikiaov.hero.internal.persistence.entity;

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
public class ProfileRoleRow {
    @Id
    private UUID profileRevisionId;

    @Id
    private String roleCode;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID profileRevisionId;
        public String roleCode;
    }
}
