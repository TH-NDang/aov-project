package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(schema = "hero", name = "hero_skin")
@IdClass(SkinIdentityRow.Key.class)
public class SkinIdentityRow {
    @Id
    private UUID heroId;

    @Id
    private String skinKey;

    private Instant createdAt;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID heroId;
        public String skinKey;
    }
}
