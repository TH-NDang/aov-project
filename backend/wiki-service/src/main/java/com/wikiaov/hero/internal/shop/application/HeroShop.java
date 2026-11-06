package com.wikiaov.hero.internal.shop.application;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.HeroShopCommands.SavePrice;
import com.wikiaov.hero.internal.application.HeroShopCommands.SaveSkinAcquisition;
import com.wikiaov.hero.internal.application.response.HeroShopView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.shop.persistence.HeroShopPriceRepository;
import com.wikiaov.hero.internal.shop.persistence.SkinAcquisitionRepository;
import com.wikiaov.hero.internal.shop.persistence.entity.HeroShopPriceRow;
import com.wikiaov.hero.internal.shop.persistence.entity.SkinAcquisitionRow;
import com.wikiaov.hero.internal.skins.persistence.SkinIdentityRepository;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinIdentityRow;
import com.wikiaov.platform.ApiException;
import java.time.Clock;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * What a hero costs and how its skins are obtained. It follows the shop, so changes apply at once without a draft, and each
 * date is a step of its own: an older view still shows what held on its day.
 */
@Service
public class HeroShop {
    private static final Set<String> AVAILABILITY = Set.of("ON_SALE", "NOT_OPEN", "COMING_SOON", "UNKNOWN");
    private static final Set<String> METHODS = Set.of("VOUCHER", "EVENT", "NOT_OPEN", "OTHER", "UNKNOWN");

    private final HeroShopPriceRepository prices;
    private final SkinAcquisitionRepository acquisitions;
    private final SkinIdentityRepository skins;
    private final HeroIdentityRepository heroes;
    private final Clock clock;

    public HeroShop(HeroShopPriceRepository prices, SkinAcquisitionRepository acquisitions,
            SkinIdentityRepository skins, HeroIdentityRepository heroes, Clock clock) {
        this.prices = prices;
        this.acquisitions = acquisitions;
        this.skins = skins;
        this.heroes = heroes;
        this.clock = clock;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public HeroShopView admin(UUID heroId, String region) {
        requireHero(heroId);
        requireRegion(region);

        var at = today();
        var priceRows = prices.findByHeroIdAndRegionCodeOrderByCapturedOnDesc(heroId, region);
        var skinRows = acquisitions.findByHeroIdAndRegionCodeOrderBySkinKeyAscCapturedOnDesc(heroId, region);

        var current = priceRows.stream().filter(row -> !row.getCapturedOn().isAfter(at)).findFirst()
                .map(this::adminPrice).orElse(null);
        return new HeroShopView(region, at, current, latestPerSkin(skinRows, at).stream().map(this::adminSkin).toList(),
                priceRows.stream().map(this::adminPrice).toList(), skinRows.stream().map(this::adminSkin).toList());
    }

    /** What the shop showed on {@code at}, or today. Steps still waiting for review do not count. */
    @Transactional(readOnly = true)
    public HeroShopView published(UUID heroId, String region, LocalDate at) {
        requireHero(heroId);
        requireRegion(region);

        var day = at == null ? today() : at;
        var price = prices.findByHeroIdAndRegionCodeOrderByCapturedOnDesc(heroId, region).stream()
                .filter(row -> !row.isNeedsReview() && !row.getCapturedOn().isAfter(day)).findFirst()
                .map(row -> new HeroShopView.Price(row.getAvailability(), row.getGoldPrice(), row.getVoucherPrice(),
                        row.getCapturedOn(), null, null))
                .orElse(null);
        var reviewed = acquisitions.findByHeroIdAndRegionCodeOrderBySkinKeyAscCapturedOnDesc(heroId, region).stream()
                .filter(row -> !row.isNeedsReview()).toList();
        var skinRows = latestPerSkin(reviewed, day).stream()
                .map(row -> new HeroShopView.SkinAcquisition(row.getSkinKey(), row.getMethod(), row.getVoucherPrice(),
                        row.getEventName(), row.getCapturedOn(), null, null))
                .toList();
        return new HeroShopView(region, day, price, skinRows, null, null);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public HeroShopView.Price savePrice(UUID heroId, String region, SavePrice request) {
        if (!AVAILABILITY.contains(request.availability()))
            throw HeroValidation.invalid("Unknown hero availability.");
        requireHero(heroId);
        requireRegion(region);

        var on = request.capturedOn() == null ? today() : request.capturedOn();
        var row = prices.findById(new HeroShopPriceRow.Key(heroId, region, on))
                .orElseGet(() -> new HeroShopPriceRow(heroId, region, on));
        row.setAvailability(request.availability());
        row.setGoldPrice(request.goldPrice());
        row.setVoucherPrice(request.voucherPrice());
        row.setNeedsReview(Boolean.TRUE.equals(request.needsReview()));
        row.setNote(blankToNull(request.note()));
        row.setUpdatedAt(clock.instant());

        return adminPrice(prices.save(row));
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public void deletePrice(UUID heroId, String region, LocalDate on) {
        var key = new HeroShopPriceRow.Key(heroId, region, on);
        if (!prices.existsById(key))
            throw new ApiException(HeroErrorCode.HERO_SHOP_ENTRY_NOT_FOUND, "This price step was not found.");

        prices.deleteById(key);
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public HeroShopView.SkinAcquisition saveSkin(UUID heroId, String skinKey, String region,
            SaveSkinAcquisition request) {
        if (!METHODS.contains(request.method()))
            throw HeroValidation.invalid("Unknown skin acquisition method.");
        if (!skins.existsById(new SkinIdentityRow.Key(heroId, skinKey)))
            throw new ApiException(HeroErrorCode.HERO_SKIN_NOT_FOUND, "Skin was not found.");
        requireRegion(region);

        var on = request.capturedOn() == null ? today() : request.capturedOn();
        var row = acquisitions.findById(new SkinAcquisitionRow.Key(heroId, skinKey, region, on))
                .orElseGet(() -> new SkinAcquisitionRow(heroId, skinKey, region, on));
        row.setMethod(request.method());
        // A price only belongs to a skin the shop actually sells.
        row.setVoucherPrice("VOUCHER".equals(request.method()) ? request.voucherPrice() : null);
        row.setEventName("EVENT".equals(request.method()) ? blankToNull(request.eventName()) : null);
        row.setNeedsReview(Boolean.TRUE.equals(request.needsReview()));
        row.setNote(blankToNull(request.note()));
        row.setUpdatedAt(clock.instant());

        return adminSkin(acquisitions.save(row));
    }

    @PreAuthorize("hasAuthority('hero:write')")
    @Transactional
    public void deleteSkin(UUID heroId, String skinKey, String region, LocalDate on) {
        var key = new SkinAcquisitionRow.Key(heroId, skinKey, region, on);
        if (!acquisitions.existsById(key))
            throw new ApiException(HeroErrorCode.HERO_SHOP_ENTRY_NOT_FOUND, "This acquisition step was not found.");

        acquisitions.deleteById(key);
    }

    /** Rows arrive newest first within each skin, so the first one on or before the day is what held then. */
    private static List<SkinAcquisitionRow> latestPerSkin(List<SkinAcquisitionRow> rows, LocalDate day) {
        var latest = new LinkedHashMap<String, SkinAcquisitionRow>();
        rows.stream().filter(row -> !row.getCapturedOn().isAfter(day))
                .forEach(row -> latest.putIfAbsent(row.getSkinKey(), row));
        return List.copyOf(latest.values());
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }

    private void requireHero(UUID heroId) {
        if (!heroes.existsById(heroId))
            throw new ApiException(HeroErrorCode.HERO_NOT_FOUND, "Hero was not found.");
    }

    private HeroShopView.Price adminPrice(HeroShopPriceRow row) {
        return new HeroShopView.Price(row.getAvailability(), row.getGoldPrice(), row.getVoucherPrice(),
                row.getCapturedOn(), row.isNeedsReview(), row.getNote());
    }

    private HeroShopView.SkinAcquisition adminSkin(SkinAcquisitionRow row) {
        return new HeroShopView.SkinAcquisition(row.getSkinKey(), row.getMethod(), row.getVoucherPrice(),
                row.getEventName(), row.getCapturedOn(), row.isNeedsReview(), row.getNote());
    }

    private static void requireRegion(String value) {
        if (value == null || !value.matches("[A-Z]{2,16}"))
            throw HeroValidation.invalid("Unknown market.");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
