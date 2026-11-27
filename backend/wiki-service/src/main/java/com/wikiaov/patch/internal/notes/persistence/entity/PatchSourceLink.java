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
@Table(schema = "patch", name = "variant_source")
public class PatchSourceLink {
    @Id
    private UUID id;
    private UUID variantId;
    private int position;
    private String url;
    private String label;
    private String locale;
}
