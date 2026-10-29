package com.wikiaov.community.tournament.internal.roster.persistence;

import com.wikiaov.community.tournament.internal.domain.TournamentContent.RosterMembership;
import com.wikiaov.community.tournament.internal.persistence.VersionedRecord;
import jakarta.persistence.*;
import java.util.UUID;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(schema = "tournament", name = "roster_membership")
public class RosterRecord extends VersionedRecord {
    private UUID tournamentId;
    private UUID teamId;
    private UUID playerId;
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private RosterMembership content;

    protected RosterRecord() {
    }

    public RosterRecord(UUID id, RosterMembership content, String actor) {
        super(id, actor);
        setContent(content, actor);
    }

    public RosterMembership getContent() {
        return content;
    }

    public void setContent(RosterMembership content, String actor) {
        this.content = content;
        this.tournamentId = content.tournamentId();
        this.teamId = content.teamId();
        this.playerId = content.playerId();
        touch(actor);
    }
}
