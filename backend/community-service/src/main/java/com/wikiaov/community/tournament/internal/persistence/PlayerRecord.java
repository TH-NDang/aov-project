package com.wikiaov.community.tournament.internal.persistence;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.Player;
import jakarta.persistence.*;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(schema = "tournament", name = "player")
public class PlayerRecord extends VersionedRecord {
    private String code;
    private String name;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Player content;

    protected PlayerRecord() {
    }

    public PlayerRecord(UUID id, Player content, String actor) {
        super(id, actor);
        setContent(content, actor);
    }

    public Player getContent() {
        return content;
    }

    public void setContent(Player content, String actor) {
        this.content = content;
        this.code = content.code();
        this.name = content.nickname();
        touch(actor);
    }
}
