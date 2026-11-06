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
@Table(schema = "hero", name = "hero_shop_price")
@IdClass(HeroShopPriceRow.Key.class)
public class HeroShopPriceRow extends AssignedIdentifierEntity<HeroShopPriceRow.Key> {
    @Id
    private UUID heroId;

    @Id
    private String regionCode;

    private String availability;
    private Integer goldPrice;
    private Integer voucherPrice;
    private LocalDate capturedOn;
    private boolean needsReview;
    private String note;
    private Instant updatedAt;

    public HeroShopPriceRow(UUID heroId, String regionCode) {
        this.heroId = heroId;
        this.regionCode = regionCode;
    }

    @Override
    public Key getId() {
        return new Key(heroId, regionCode);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID heroId;
        public String regionCode;
    }
}
