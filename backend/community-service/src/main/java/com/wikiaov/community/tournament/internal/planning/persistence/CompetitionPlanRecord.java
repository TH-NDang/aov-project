package com.wikiaov.community.tournament.internal.planning.persistence;

import com.wikiaov.community.tournament.internal.planning.domain.*;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(schema = "tournament", name = "competition_plan")
public class CompetitionPlanRecord {
    @Id
    private UUID id;
    @Version
    private long version;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private CompetitionPlan content;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private CompetitionSnapshot publishedSnapshot;
    private Instant publishedAt;
    private Instant updatedAt;
    private String editedBy;

    protected CompetitionPlanRecord() {
    }

    public CompetitionPlanRecord(UUID id) {
        this.id = id;
    }

    public UUID getId() {
        return id;
    }

    public long getVersion() {
        return version;
    }

    public CompetitionPlan getContent() {
        return content;
    }

    public CompetitionSnapshot getPublishedSnapshot() {
        return publishedSnapshot;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void save(CompetitionPlan content, String actor) {
        this.content = content;
        this.editedBy = actor;
        this.updatedAt = Instant.now();
    }

    public void publish(CompetitionSnapshot snapshot, String actor) {
        this.publishedSnapshot = snapshot;
        this.publishedAt = snapshot == null ? null : Instant.now();
        this.editedBy = actor;
        this.updatedAt = Instant.now();
    }
}
