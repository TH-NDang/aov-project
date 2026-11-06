package com.wikiaov.hero.internal.shop.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.*;

/** What the shop asked for a hero from {@code capturedOn} until the next row. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "hero", name = "hero_shop_price")
@IdClass(HeroShopPriceRow.Key.class)
public class HeroShopPriceRow extends AssignedIdentifierEntity<HeroShopPriceRow.Key> {
    @Id
    private UUID heroId;

    @Id
    private String regionCode;

    @Id
    private LocalDate capturedOn;

    private String availability;
    private Integer goldPrice;
    private Integer voucherPrice;
    private boolean needsReview;
    private String note;
    private Instant updatedAt;

    public HeroShopPriceRow(UUID heroId, String regionCode, LocalDate capturedOn) {
        this.heroId = heroId;
        this.regionCode = regionCode;
        this.capturedOn = capturedOn;
    }

    @Override
    public Key getId() {
        return new Key(heroId, regionCode, capturedOn);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID heroId;
        public String regionCode;
        public LocalDate capturedOn;
    }
}
