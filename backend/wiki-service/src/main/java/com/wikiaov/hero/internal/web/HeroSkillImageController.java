package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroSkillImageView;
import com.wikiaov.hero.internal.application.service.HeroSkillImages;
import com.wikiaov.hero.internal.web.request.SaveHeroSkillImage;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes/{heroId}/skill-images")
public class HeroSkillImageController implements HeroSkillImageApi {
    private final HeroSkillImages images;
    public HeroSkillImageController(HeroSkillImages images) {
        this.images = images;
    }
    @GetMapping(version = "1")
    public Map<String, List<HeroSkillImageView>> list(@PathVariable UUID heroId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return Map.of("items", images.list(heroId));
    }
    @PutMapping(path = "/{sourceSlot}/{variantNo}", version = "1")
    public HeroSkillImageView save(@PathVariable UUID heroId, @PathVariable int sourceSlot, @PathVariable int variantNo,
            @RequestBody SaveHeroSkillImage body, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return images.save(heroId, sourceSlot, variantNo, body.command());
    }
}
