package com.wikiaov.hero.internal.media.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
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
