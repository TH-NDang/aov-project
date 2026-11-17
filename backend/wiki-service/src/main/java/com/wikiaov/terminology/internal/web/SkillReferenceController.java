package com.wikiaov.terminology.internal.web;

import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import com.wikiaov.terminology.SkillReferenceProvider.Candidate;
import com.wikiaov.terminology.internal.reference.application.SkillReferenceCatalog;
import jakarta.servlet.http.HttpServletRequest;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.WebRequest;
import tools.jackson.databind.json.JsonMapper;

@RestController
public class SkillReferenceController implements SkillReferenceApi {
    private final SkillReferenceCatalog catalog;
    private final JsonMapper json;

    public SkillReferenceController(SkillReferenceCatalog catalog, JsonMapper json) {
        this.catalog = catalog;
        this.json = json;
    }

    @GetMapping(path = ApiPaths.ADMIN + "/reference-skills", version = "1")
    public PageSlice<Candidate> admin(@RequestParam(required = false) UUID rulesetId,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) UUID heroId, @RequestParam(required = false) String ids,
            @RequestParam(defaultValue = "0") int page, @RequestParam(required = false) Integer size,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId", "locale", "q", "heroId", "ids", "page", "size"));
        return catalog.admin(rulesetId, locale, q, heroId, ids, page, size);
    }

    @GetMapping(path = ApiPaths.ROOT + "/reference-skills", version = "1")
    public ResponseEntity<PageSlice<Candidate>> published(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = CatalogLocales.DEFAULT) String locale,
            @RequestParam(defaultValue = "") String q,
            @RequestParam(required = false) UUID heroId, @RequestParam(required = false) String ids,
            @RequestParam(defaultValue = "0") int page, @RequestParam(required = false) Integer size,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped,
            HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("region", "locale", "q", "heroId", "ids", "page", "size",
                "seasonId", "patchVariantId", "includeUnscoped"));
        var value = seasonId == null && patchVariantId == null
                ? catalog.published(region, locale, q, heroId, ids, page, size)
                : catalog.published(region, locale, q, heroId, ids, page, size, seasonId, patchVariantId,
                        includeUnscoped);
        try {
            String tag = "\"" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(json.writeValueAsBytes(value))) + "\"";
            var cache = CacheControl.noCache().cachePublic();
            if (web.checkNotModified(tag)) {
                return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(tag).cacheControl(cache).build();
            }
            return ResponseEntity.ok().eTag(tag).cacheControl(cache).body(value);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
