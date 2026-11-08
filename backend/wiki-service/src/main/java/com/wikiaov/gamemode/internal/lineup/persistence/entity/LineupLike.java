package com.wikiaov.gamemode.internal.lineup.persistence.entity;

import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One reader's like of one lineup. The primary key keeps it to one like per reader and lineup. */
@Entity
@Getter
@Setter
@Table(schema = "gamemode", name = "lineup_like")
public class LineupLike {
    @EmbeddedId
    private Key id;

    private UUID modeId;

    private String lineupSource;

    private Instant createdAt;

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        private UUID lineupId;

        private String issuer;

        private String subject;

        public Key(UUID lineupId, String issuer, String subject) {
            this.lineupId = lineupId;
            this.issuer = issuer;
            this.subject = subject;
        }
    }
}
