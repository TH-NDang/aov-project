package com.wikiaov.hero.internal.authoring.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import com.wikiaov.platform.RevisionState;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_revision")
public class HeroRevision extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID id;

    private UUID heroId;

    private UUID rulesetId;

    private long revisionNo;

    @Enumerated(EnumType.STRING)
    private RevisionState state;

    private long version;

    private Long publicationSequence;

    private Instant publishedAt;

    private String cause;

    private UUID sourceRevisionId;

    private UUID effectiveFromPatchVariantId;

    private UUID profileRevisionId;

    private UUID overviewRatingRevisionId;

    private UUID combatStatsRevisionId;

    private UUID skillsRevisionId;

    private UUID skinsRevisionId;

    private UUID mediaBindingRevisionId;

    private Instant createdAt;

    private Instant updatedAt;

    private String createdByIssuer;

    private String createdBySubject;

    private String updatedByIssuer;

    private String updatedBySubject;

}
