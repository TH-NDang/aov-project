package com.wikiaov.build.internal.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A shared, immutable arcana page identified by its content. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "build", name = "arcana_page")
public class ArcanaPageRow {
    @Id
    private UUID id;

    private String contentKey;
    private Instant createdAt;
}
