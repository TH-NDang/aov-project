package com.wikiaov.community.tournament.internal.persistence;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.PublishedGame;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(schema = "tournament", name = "game_publication")
public class PublicationRecord {
    @Id
    private UUID id;
    private UUID gameId;
    private Instant publishedAt;
    private String actor;
    private String action;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private PublishedGame snapshot;

    protected PublicationRecord() {
    }

    public PublicationRecord(UUID id, UUID gameId, PublishedGame snapshot, String actor) {
        this(id, gameId, snapshot, actor, "PUBLICATION");
    }

    public PublicationRecord(UUID id, UUID gameId, PublishedGame snapshot, String actor, String action) {
        this.id = id;
        this.gameId = gameId;
        this.snapshot = snapshot;
        this.publishedAt = Instant.now();
        this.actor = actor;
        this.action = action;
    }
}
