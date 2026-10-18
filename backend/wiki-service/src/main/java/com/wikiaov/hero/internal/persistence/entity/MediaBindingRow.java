package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(schema = "hero", name = "hero_media_binding")
@IdClass(MediaBindingRow.Key.class)
public class MediaBindingRow {
    @Id
    private UUID mediaBindingRevisionId;

    @Id
    private String mediaRole;

    private UUID assetId;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID mediaBindingRevisionId;
        public String mediaRole;
    }
}
