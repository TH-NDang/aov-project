package com.wikiaov.hero.internal.shop.persistence.entity;

import com.wikiaov.hero.internal.shop.domain.SkinAcquisitionMethod;
import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** How a skin could be obtained from {@code capturedOn} until the next row. */
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

    @Id
    private LocalDate capturedOn;

    @Enumerated(EnumType.STRING)
    private SkinAcquisitionMethod method;
    private Integer voucherPrice;
    private String eventName;
    private boolean needsReview;
    private String note;
    private Instant updatedAt;

    public SkinAcquisitionRow(UUID heroId, String skinKey, String regionCode, LocalDate capturedOn) {
        this.heroId = heroId;
        this.skinKey = skinKey;
        this.regionCode = regionCode;
        this.capturedOn = capturedOn;
    }

    @Override
    public Key getId() {
        return new Key(heroId, skinKey, regionCode, capturedOn);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID heroId;
        public String skinKey;
        public String regionCode;
        public LocalDate capturedOn;
    }
}
