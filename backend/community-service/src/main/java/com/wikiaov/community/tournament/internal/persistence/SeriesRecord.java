package com.wikiaov.community.tournament.internal.persistence;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Series;
import jakarta.persistence.*;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(schema = "tournament", name = "series")
public class SeriesRecord extends VersionedRecord {
    private String code;
    private String name;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Series content;

    protected SeriesRecord() {
    }

    public SeriesRecord(UUID id, Series content, String actor) {
        super(id, actor);
        setContent(content, actor);
    }

    public Series getContent() {
        return content;
    }

    public void setContent(Series content, String actor) {
        this.content = content;
        this.code = content.code();
        this.name = content.name();
        touch(actor);
    }
}
