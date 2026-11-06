package com.wikiaov.hero.internal.shop.persistence;

import com.wikiaov.hero.internal.shop.persistence.entity.HeroShopPriceRow;

import org.springframework.data.jpa.repository.JpaRepository;

public interface HeroShopPriceRepository extends JpaRepository<HeroShopPriceRow, HeroShopPriceRow.Key> {
}
