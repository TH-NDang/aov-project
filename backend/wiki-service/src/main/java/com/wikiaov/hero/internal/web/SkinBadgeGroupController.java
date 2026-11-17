package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.SkinBadgeGroupCommands;
import com.wikiaov.hero.internal.application.response.SkinBadgeGroupView;
import com.wikiaov.hero.internal.badges.application.SkinBadgeGroups;
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
public class SkinBadgeGroupController implements SkinBadgeGroupApi {
    private final SkinBadgeGroups groups;

    public SkinBadgeGroupController(SkinBadgeGroups groups) {
        this.groups = groups;
    }

    @GetMapping(path = "/skin-badge-groups", version = "1")
    public PageSlice<SkinBadgeGroupView> list(@RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("locale", "q", "page", "size"));
        return groups.list(locale, q, page, size);
    }

    @PostMapping(path = "/skin-badge-groups", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public SkinBadgeGroupView create(@RequestBody SkinBadgeGroupCommands.Create input) {
        return groups.create(input);
    }

    @PutMapping(path = "/skin-badge-groups/{id}", version = "1")
    public SkinBadgeGroupView update(@PathVariable UUID id, @RequestBody SkinBadgeGroupCommands.Update input) {
        return groups.update(id, input);
    }
}
