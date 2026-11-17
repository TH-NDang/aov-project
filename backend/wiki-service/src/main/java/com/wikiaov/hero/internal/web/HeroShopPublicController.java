package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroShopView;
import com.wikiaov.hero.internal.shop.application.HeroShop;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/heroes/{heroId}/shop")
public class HeroShopPublicController implements HeroShopPublicApi {
    private final HeroShop shop;

    public HeroShopPublicController(HeroShop shop) {
        this.shop = shop;
    }

    @GetMapping(version = "1")
    public HeroShopView read(@PathVariable UUID heroId, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate at,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "at"));
        return shop.published(heroId, region, at);
    }
}
