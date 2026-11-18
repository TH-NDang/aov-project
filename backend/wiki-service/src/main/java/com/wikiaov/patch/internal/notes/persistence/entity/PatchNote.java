package com.wikiaov.patch.internal.notes.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "patch", name = "variant_note")
public class PatchNote {
    @Id
    private UUID id;
    private UUID variantId;
    private String locale;
    private String body;
    private long version;
}
