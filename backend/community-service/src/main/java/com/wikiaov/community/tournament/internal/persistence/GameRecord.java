package com.wikiaov.community.tournament.internal.persistence;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.*;
import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(schema = "tournament", name = "game")
public class GameRecord extends VersionedRecord {
    private UUID seriesId;
    private Integer gameNumber;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Game content;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private PublishedGame publishedSnapshot;
    private Instant publishedAt;

    protected GameRecord() {
    }

    public GameRecord(UUID id, Game content, String actor) {
        super(id, actor);
        setContent(content, actor);
    }

    public Game getContent() {
        return content;
    }

    public PublishedGame getPublishedSnapshot() {
        return publishedSnapshot;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }

    public void setContent(Game content, String actor) {
        this.content = content;
        this.seriesId = content.seriesId();
        this.gameNumber = content.number();
        touch(actor);
    }

    public void withdraw(String actor) {
        this.publishedSnapshot = null;
        this.publishedAt = null;
        touch(actor);
    }

    public void publish(PublishedGame snapshot, String actor) {
        this.publishedSnapshot = snapshot;
        this.publishedAt = snapshot.publishedAt();
        touch(actor);
    }
}
