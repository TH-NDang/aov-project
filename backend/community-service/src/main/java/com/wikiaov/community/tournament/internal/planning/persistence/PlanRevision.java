package com.wikiaov.community.tournament.internal.planning.persistence;

import com.wikiaov.community.tournament.internal.planning.domain.CompetitionSnapshot;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(schema = "tournament", name = "plan_revision")
public class PlanRevision {
    @Id
    private UUID id;
    private UUID tournamentId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private CompetitionSnapshot content;
    private String action;
    private String actor;
    private Instant createdAt;

    protected PlanRevision() {
    }

    public PlanRevision(UUID tournamentId, CompetitionSnapshot content, String action, String actor) {
        this.id = UUID.randomUUID();
        this.tournamentId = tournamentId;
        this.content = content;
        this.action = action;
        this.actor = actor;
        this.createdAt = Instant.now();
    }
}
