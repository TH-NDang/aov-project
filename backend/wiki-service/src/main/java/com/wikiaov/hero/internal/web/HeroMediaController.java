package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.SkinBadgeCommands;
import com.wikiaov.hero.internal.application.response.HeroMediaGroup;
import com.wikiaov.hero.internal.application.response.SkinBadgeRelation;
import com.wikiaov.hero.internal.application.response.SkinBadgeView;
import com.wikiaov.hero.internal.badges.application.SkinBadges;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.media.application.HeroMediaQueries;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN)
public class HeroMediaController implements HeroMediaApi {
    private final HeroMediaQueries gallery;
    private final SkinBadges badges;

    public HeroMediaController(HeroMediaQueries gallery, SkinBadges badges) {
        this.gallery = gallery;
        this.badges = badges;
    }

    @Override
    @GetMapping(path = "/hero-media", version = "1")
    public PageSlice<HeroMediaGroup> gallery(@RequestParam UUID rulesetId, @RequestParam MediaRole role,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId", "role", "locale", "q", "page", "size"));
        return gallery.list(rulesetId, role, locale, q, page, size);
    }

    @Override
    @GetMapping(path = "/skin-badges", version = "1")
    public PageSlice<SkinBadgeView> badges(@RequestParam(required = false) UUID rulesetId,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) UUID groupId, @RequestParam(defaultValue = "false") boolean ungrouped,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("rulesetId", "locale", "q", "groupId", "ungrouped", "page", "size"));
        return badges.list(rulesetId, locale, q, groupId, ungrouped, page, size);
    }

    @Override
    @PostMapping(path = "/skin-badges", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public SkinBadgeView create(@RequestBody SkinBadgeCommands.Create body) {
        return badges.create(body);
    }

    @Override
    @PutMapping(path = "/skin-badges/{id}", version = "1")
    public SkinBadgeView update(@PathVariable UUID id, @RequestBody SkinBadgeCommands.Update body) {
        return badges.update(id, body);
    }

    @Override
    @PutMapping(path = "/skin-badges/{id}/group", version = "1")
    public SkinBadgeView assignGroup(@PathVariable UUID id, @RequestBody SkinBadgeCommands.AssignGroup body) {
        return badges.assignGroup(id, body);
    }

    @Override
    @GetMapping(path = "/skin-badges/{id}/skins", version = "1")
    public PageSlice<SkinBadgeRelation> skins(@PathVariable UUID id, @RequestParam UUID rulesetId,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId", "locale", "page", "size"));
        return badges.skins(id, rulesetId, locale, page, size);
    }
}
