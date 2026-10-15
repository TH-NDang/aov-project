package com.wikiaov.query.internal.web;
import com.wikiaov.hero.HeroChangeQueries;
import com.wikiaov.patch.PatchCatalog;
import com.wikiaov.platform.*;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping(ApiPaths.ROOT + "/patches")
public class PatchPageController {
    private final PatchCatalog patches;
    private final HeroChangeQueries heroes;
    public PatchPageController(PatchCatalog patches, HeroChangeQueries heroes) {
        this.patches = patches;
        this.heroes = heroes;
    }
    @GetMapping(version = "1")
    ResponseEntity<?> list(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "page", "size"));
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic())
                .body(patches.list(region, locale, page, size));
    }
    @GetMapping(path = "/{id}", version = "1")
    ResponseEntity<?> detail(@PathVariable UUID id, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale"));
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic())
                .body(patches.published(id, region, locale));
    }
    @GetMapping(path = "/{id}/changes", version = "1")
    ResponseEntity<?> changes(@PathVariable UUID id, @RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, @RequestParam(defaultValue = "HERO") String domain,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "domain", "page", "size"));
        if (!"HERO".equals(domain))
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                    "This domain does not have an implemented change provider.");
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid page bounds.");
        var patch = patches.published(id, region, locale);
        UUID variant = (UUID) patch.get("variantId");
        var all = heroes.forVariant(variant, locale);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("patch", patch);
        response.put("variantId", variant);
        response.put("effectiveAt", patch.get("effectiveAt"));
        response.put("items", all.stream().skip((long) page * size).limit(size).toList());
        response.put("page", page);
        response.put("size", size);
        response.put("totalElements", all.size());
        return ResponseEntity.ok().cacheControl(CacheControl.noCache().cachePublic()).body(response);
    }
}
