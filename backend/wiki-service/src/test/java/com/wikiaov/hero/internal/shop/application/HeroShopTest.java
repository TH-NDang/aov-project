package com.wikiaov.hero.internal.shop.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.access.Actor;
import com.wikiaov.access.ActorType;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.hero.internal.application.HeroShopCommands.SavePrice;
import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.shop.persistence.HeroShopPriceRepository;
import com.wikiaov.hero.internal.shop.persistence.SkinAcquisitionRepository;
import com.wikiaov.hero.internal.shop.persistence.entity.HeroShopPriceRow;
import com.wikiaov.hero.internal.skins.persistence.SkinIdentityRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class HeroShopTest {
    private static final UUID HERO = UUID.randomUUID();
    private static final LocalDate DAY = LocalDate.parse("2026-11-17");
    private static final Actor EDITOR = new Actor("issuer", "editor", ActorType.HUMAN, null, Set.of("hero:write"));

    private final HeroShopPriceRepository prices = mock(HeroShopPriceRepository.class);
    private final HeroIdentityRepository heroes = mock(HeroIdentityRepository.class);
    private final CurrentActor actors = mock(CurrentActor.class);
    private final List<AuditEntry> audited = new ArrayList<>();
    private final HeroShop shop = new HeroShop(prices, mock(SkinAcquisitionRepository.class),
            mock(SkinIdentityRepository.class), heroes, actors, audited::add,
            Clock.fixed(Instant.parse("2026-11-17T03:00:00Z"), ZoneOffset.UTC));

    HeroShopTest() {
        when(actors.require()).thenReturn(EDITOR);
        when(heroes.lockById(HERO)).thenReturn(Optional.of(new HeroIdentity()));
        when(prices.findById(any())).thenReturn(Optional.empty());
        when(prices.save(any())).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void savingAPriceStepIsAudited() {
        shop.savePrice(HERO, "VN", new SavePrice("ON_SALE", 18888, null, DAY, false, null));

        assertThat(audited).singleElement().satisfies(entry -> {
            assertThat(entry.action()).isEqualTo("HERO_SHOP_PRICE_SAVED");
            assertThat(entry.aggregateId()).isEqualTo(HERO);
            assertThat(entry.metadata()).containsEntry("region", "VN").containsEntry("capturedOn", "2026-11-17");
        });
    }

    @Test
    void savingAPriceStepLocksTheHeroBeforeReadingTheStep() {
        shop.savePrice(HERO, "VN", new SavePrice("ON_SALE", 18888, null, DAY, false, null));

        var order = inOrder(heroes, prices);
        order.verify(heroes).lockById(HERO);
        order.verify(prices).findById(new HeroShopPriceRow.Key(HERO, "VN", DAY));
    }

    @Test
    void deletingAPriceStepIsAudited() {
        when(prices.existsById(new HeroShopPriceRow.Key(HERO, "VN", DAY))).thenReturn(true);

        shop.deletePrice(HERO, "VN", DAY);

        assertThat(audited).extracting(AuditEntry::action).containsExactly("HERO_SHOP_PRICE_DELETED");
    }
}
