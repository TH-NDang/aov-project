package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroSkillImageView;
import com.wikiaov.hero.internal.skills.application.HeroSkillImages;
import com.wikiaov.hero.internal.web.request.SaveHeroSkillImage;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes/{heroId}/skill-images")
public class HeroSkillImageController implements HeroSkillImageApi {
    private final HeroSkillImages images;

    public HeroSkillImageController(HeroSkillImages images) {
        this.images = images;
    }

    @Override
    @GetMapping(version = "1")
    public Map<String, List<HeroSkillImageView>> list(@PathVariable UUID heroId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return Map.of("items", images.list(heroId));
    }

    @Override
    @PutMapping(path = "/{sourceSlot}/{variantNo}", version = "1")
    public HeroSkillImageView save(@PathVariable UUID heroId, @PathVariable int sourceSlot, @PathVariable int variantNo,
            @RequestBody SaveHeroSkillImage body, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return images.save(heroId, sourceSlot, variantNo, body.command());
    }
}
