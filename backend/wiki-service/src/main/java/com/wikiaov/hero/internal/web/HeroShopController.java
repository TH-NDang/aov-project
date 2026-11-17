package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroShopCommands.SavePrice;
import com.wikiaov.hero.internal.application.HeroShopCommands.SaveSkinAcquisition;
import com.wikiaov.hero.internal.application.response.HeroShopView;
import com.wikiaov.hero.internal.shop.application.HeroShop;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

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

    @DeleteMapping(path = "/prices/{capturedOn}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePrice(@PathVariable UUID heroId,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate capturedOn,
            @RequestParam(defaultValue = "VN") String region) {
        shop.deletePrice(heroId, region, capturedOn);
    }

    @DeleteMapping(path = "/skins/{skinKey}/{capturedOn}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSkin(@PathVariable UUID heroId, @PathVariable String skinKey,
            @PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate capturedOn,
            @RequestParam(defaultValue = "VN") String region) {
        shop.deleteSkin(heroId, skinKey, region, capturedOn);
    }

    @PutMapping(path = "/skins/{skinKey}", version = "1")
    public HeroShopView.SkinAcquisition saveSkin(@PathVariable UUID heroId, @PathVariable String skinKey,
            @RequestParam(defaultValue = "VN") String region, @RequestBody SaveSkinAcquisition body) {
        return shop.saveSkin(heroId, skinKey, region, body);
    }
}
