package com.wikiaov.hero.internal.shop.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
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
    public static class Key implements Serializable {
        public UUID heroId;
        public String regionCode;
        public LocalDate capturedOn;
    }
}
