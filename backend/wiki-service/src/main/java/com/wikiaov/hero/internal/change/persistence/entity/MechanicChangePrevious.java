package com.wikiaov.hero.internal.change.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

/** What a mechanic did before its change, written later from a cited source; the change itself stays as recorded. */
@Entity
@Immutable
@Getter
@Setter
@Table(schema = "hero", name = "hero_mechanic_change_previous")
public class MechanicChangePrevious extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID mechanicChangeId;
    @Column(columnDefinition = "text")
    private String description;
    @Column(columnDefinition = "text")
    private String sourceUrl;
    private Instant createdAt;
    @Column(columnDefinition = "text")
    private String createdByIssuer;
    @Column(columnDefinition = "text")
    private String createdBySubject;

    @Override
    public UUID getId() {
        return mechanicChangeId;
    }
}
