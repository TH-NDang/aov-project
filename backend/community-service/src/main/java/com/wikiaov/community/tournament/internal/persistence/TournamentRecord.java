package com.wikiaov.community.tournament.internal.persistence;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Tournament;
import jakarta.persistence.*;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(schema = "tournament", name = "tournament")
public class TournamentRecord extends VersionedRecord {
    private String code;
    private String name;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Tournament content;

    protected TournamentRecord() {
    }

    public TournamentRecord(UUID id, Tournament content, String actor) {
        super(id, actor);
        setContent(content, actor);
    }

    public Tournament getContent() {
        return content;
    }

    public void setContent(Tournament content, String actor) {
        this.content = content;
        this.code = content.code();
        this.name = content.name();
        touch(actor);
    }
}
