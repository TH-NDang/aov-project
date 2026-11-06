package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroShopCommands.SavePrice;
import com.wikiaov.hero.internal.application.HeroShopCommands.SaveSkinAcquisition;
import com.wikiaov.hero.internal.application.response.HeroShopView;
import com.wikiaov.hero.internal.shop.application.HeroShop;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes/{heroId}/shop")
public class HeroShopController implements HeroShopApi {
    private final HeroShop shop;

    public HeroShopController(HeroShop shop) {
        this.shop = shop;
    }

    @GetMapping(version = "1")
    public HeroShopView read(@PathVariable UUID heroId, @RequestParam(defaultValue = "VN") String region,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region"));
        return shop.admin(heroId, region);
    }

    @PutMapping(version = "1")
    public HeroShopView.Price savePrice(@PathVariable UUID heroId, @RequestParam(defaultValue = "VN") String region,
            @RequestBody SavePrice body) {
        return shop.savePrice(heroId, region, body);
    }

    @PutMapping(path = "/skins/{skinKey}", version = "1")
    public HeroShopView.SkinAcquisition saveSkin(@PathVariable UUID heroId, @PathVariable String skinKey,
            @RequestParam(defaultValue = "VN") String region, @RequestBody SaveSkinAcquisition body) {
        return shop.saveSkin(heroId, skinKey, region, body);
    }
}
