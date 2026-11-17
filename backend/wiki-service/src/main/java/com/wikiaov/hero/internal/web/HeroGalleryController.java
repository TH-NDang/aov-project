package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.gallery.application.HeroGallery;
import com.wikiaov.hero.internal.gallery.application.HeroGalleryView;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes/{heroId}/gallery")
public class HeroGalleryController implements HeroGalleryApi {
    private final HeroGallery gallery;

    public HeroGalleryController(HeroGallery gallery) {
        this.gallery = gallery;
    }

    @GetMapping(version = "1")
    public HeroGalleryView read(@PathVariable UUID heroId,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        return gallery.read(heroId, locale);
    }

    @PostMapping(version = "1")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, UUID> attach(@PathVariable UUID heroId, @RequestBody HeroGalleryView.Attach body,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return Map.of("id", gallery.attach(heroId, body));
    }

    @PutMapping(path = "/{itemId}", version = "1")
    public Map<String, Object> update(@PathVariable UUID heroId, @PathVariable UUID itemId,
            @RequestBody HeroGalleryView.Update body, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return gallery.update(heroId, itemId, body);
    }

    @DeleteMapping(path = "/{itemId}", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID heroId, @PathVariable UUID itemId, @RequestParam long expectedVersion,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("expectedVersion"));
        gallery.remove(heroId, itemId, expectedVersion);
    }
}
