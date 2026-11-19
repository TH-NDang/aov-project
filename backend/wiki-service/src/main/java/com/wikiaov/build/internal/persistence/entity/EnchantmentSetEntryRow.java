package com.wikiaov.build.internal.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
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

/** The enchantment in one slot of a set; slots 1-3 are the primary branch. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "build", name = "enchantment_set_entry")
@IdClass(EnchantmentSetEntryRow.Key.class)
public class EnchantmentSetEntryRow extends AssignedIdentifierEntity<EnchantmentSetEntryRow.Key> {
    @Id
    private UUID setId;

    @Id
    private int slot;

    private UUID enchantmentId;

    @Override
    public Key getId() {
        return new Key(setId, slot);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID setId;
        public int slot;
    }
}
