package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroShopView;
import com.wikiaov.hero.internal.shop.application.HeroShop;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ROOT + "/heroes/{heroId}/shop")
public class HeroShopPublicController implements HeroShopPublicApi {
    private final HeroShop shop;

    public HeroShopPublicController(HeroShop shop) {
        this.shop = shop;
    }

    @GetMapping(version = "1")
    public HeroShopView read(@PathVariable UUID heroId, @RequestParam(defaultValue = "VN") String region,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region"));
        return shop.published(heroId, region);
    }
}
