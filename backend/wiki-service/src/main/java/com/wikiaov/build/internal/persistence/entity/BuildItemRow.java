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

/** The item in one slot of a build, with the game's blue diamond mark. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "build", name = "build_item")
@IdClass(BuildItemRow.Key.class)
public class BuildItemRow extends AssignedIdentifierEntity<BuildItemRow.Key> {
    @Id
    private UUID buildId;

    @Id
    private int slot;

    private UUID itemId;

    @Override
    public Key getId() {
        return new Key(buildId, slot);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID buildId;
        public int slot;
    }
}
