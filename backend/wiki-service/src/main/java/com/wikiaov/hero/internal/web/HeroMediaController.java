package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.SkinBadgeCommands;
import com.wikiaov.hero.internal.application.response.*;
import com.wikiaov.hero.internal.application.service.*;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN)
public class HeroMediaController implements HeroMediaApi {
    private final HeroMediaQueries gallery;
    private final SkinBadges badges;

    public HeroMediaController(HeroMediaQueries gallery, SkinBadges badges) {
        this.gallery = gallery;
        this.badges = badges;
    }

    @GetMapping(path = "/hero-media", version = "1")
    public PageSlice<HeroMediaGroup> gallery(@RequestParam UUID rulesetId, @RequestParam MediaRole role,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(defaultValue = "") String q,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId", "role", "locale", "q", "page", "size"));
        return gallery.list(rulesetId, role, locale, q, page, size);
    }

    @GetMapping(path = "/skin-badges", version = "1")
    public PageSlice<SkinBadgeView> badges(@RequestParam(required = false) UUID rulesetId,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) UUID groupId, @RequestParam(defaultValue = "false") boolean ungrouped,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request,
                Set.of("rulesetId", "locale", "q", "groupId", "ungrouped", "page", "size"));
        return badges.list(rulesetId, locale, q, groupId, ungrouped, page, size);
    }

    @PostMapping(path = "/skin-badges", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public SkinBadgeView create(@RequestBody SkinBadgeCommands.Create body) {
        return badges.create(body);
    }

    @PutMapping(path = "/skin-badges/{id}", version = "1")
    public SkinBadgeView update(@PathVariable UUID id, @RequestBody SkinBadgeCommands.Update body) {
        return badges.update(id, body);
    }

    @PutMapping(path = "/skin-badges/{id}/group", version = "1")
    public SkinBadgeView assignGroup(@PathVariable UUID id, @RequestBody SkinBadgeCommands.AssignGroup body) {
        return badges.assignGroup(id, body);
    }

    @GetMapping(path = "/skin-badges/{id}/skins", version = "1")
    public PageSlice<SkinBadgeRelation> skins(@PathVariable UUID id, @RequestParam UUID rulesetId,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId", "locale", "page", "size"));
        return badges.skins(id, rulesetId, locale, page, size);
    }
}
