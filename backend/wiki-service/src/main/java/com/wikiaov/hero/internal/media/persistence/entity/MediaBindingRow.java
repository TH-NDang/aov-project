package com.wikiaov.hero.internal.media.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

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
public class MediaBindingRow extends AssignedIdentifierEntity<MediaBindingRow.Key> {
    @Id
    private UUID mediaBindingRevisionId;

    @Id
    private String mediaRole;

    private UUID assetId;

    @Override
    public Key getId() {
        return new Key(mediaBindingRevisionId, mediaRole);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID mediaBindingRevisionId;
        public String mediaRole;
    }
}
