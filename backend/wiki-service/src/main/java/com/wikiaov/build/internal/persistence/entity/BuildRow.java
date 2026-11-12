package com.wikiaov.build.internal.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One recommended build of a hero in a capture. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "build", name = "build")
public class BuildRow extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID id;

    private UUID captureId;
    private UUID heroId;
    private int listPosition;
    private String playerName;
    private Integer playerPower;
    private BigDecimal playerWinRate;
    private UUID spellId;
    private UUID arcanaPageId;
    private UUID enchantmentSetId;
    private String contentKey;
    private String imageId;
    private boolean needsReview;
    private String note;
    private Instant reviewedAt;
    private String reviewedByIssuer;
    private String reviewedBySubject;
    private long version;
    private Instant updatedAt;
}
