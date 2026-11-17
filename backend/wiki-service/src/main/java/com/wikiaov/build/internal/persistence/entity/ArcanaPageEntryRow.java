package com.wikiaov.build.internal.persistence.entity;

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

/** One kind of arcana on a page and how many of it. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "build", name = "arcana_page_entry")
@IdClass(ArcanaPageEntryRow.Key.class)
public class ArcanaPageEntryRow extends AssignedIdentifierEntity<ArcanaPageEntryRow.Key> {
    @Id
    private UUID pageId;

    @Id
    private UUID arcanaId;

    private int quantity;

    @Override
    public Key getId() {
        return new Key(pageId, arcanaId);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID pageId;
        public UUID arcanaId;
    }
}
