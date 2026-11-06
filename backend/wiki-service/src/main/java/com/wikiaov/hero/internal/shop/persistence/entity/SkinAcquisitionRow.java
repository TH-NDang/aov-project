package com.wikiaov.hero.internal.shop.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "hero", name = "hero_skin_acquisition")
@IdClass(SkinAcquisitionRow.Key.class)
public class SkinAcquisitionRow extends AssignedIdentifierEntity<SkinAcquisitionRow.Key> {
    @Id
    private UUID heroId;

    @Id
    private String skinKey;

    @Id
    private String regionCode;

    private String method;
    private Integer voucherPrice;
    private String eventName;
    private LocalDate capturedOn;
    private boolean needsReview;
    private String note;
    private Instant updatedAt;

    public SkinAcquisitionRow(UUID heroId, String skinKey, String regionCode) {
        this.heroId = heroId;
        this.skinKey = skinKey;
        this.regionCode = regionCode;
    }

    @Override
    public Key getId() {
        return new Key(heroId, skinKey, regionCode);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID heroId;
        public String skinKey;
        public String regionCode;
    }
}
