package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.SkinBadgeGroupCommands;
import com.wikiaov.hero.internal.application.response.SkinBadgeGroupView;
import com.wikiaov.hero.internal.application.service.SkinBadgeGroups;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN)
public class SkinBadgeGroupController {
    private final SkinBadgeGroups groups;

    public SkinBadgeGroupController(SkinBadgeGroups groups) {
        this.groups = groups;
    }

    @GetMapping(path = "/skin-badge-groups", version = "1")
    PageSlice<SkinBadgeGroupView> list(@RequestParam(defaultValue = "vi-VN") String locale,
            @RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("locale", "q", "page", "size"));
        return groups.list(locale, q, page, size);
    }

    @PostMapping(path = "/skin-badge-groups", version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    SkinBadgeGroupView create(@Valid @RequestBody SkinBadgeGroupCommands.Create input) {
        return groups.create(input);
    }

    @PutMapping(path = "/skin-badge-groups/{id}", version = "1")
    SkinBadgeGroupView update(@PathVariable UUID id, @Valid @RequestBody SkinBadgeGroupCommands.Update input) {
        return groups.update(id, input);
    }
}
