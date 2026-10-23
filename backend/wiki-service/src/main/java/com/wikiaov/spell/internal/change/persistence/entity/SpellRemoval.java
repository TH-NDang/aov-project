package com.wikiaov.spell.internal.change.persistence.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "spell", name = "spell_removal")
public class SpellRemoval {
    @Id
    private UUID id;
    private UUID spellId;
    private UUID rulesetId;
    private UUID revisionId;
    private UUID patchVariantId;
    private String sourceUrl;
    private String notes;
    private Instant recordedAt;
    private String recordedByIssuer;
    private String recordedBySubject;
}
