package com.wikiaov.terminology.internal.web;

import com.wikiaov.platform.*;
import com.wikiaov.terminology.internal.application.response.AdminReferenceCatalogView;
import com.wikiaov.terminology.internal.application.response.ReferenceSettingsView;
import com.wikiaov.terminology.internal.reference.application.AdminReferenceCatalog;
import com.wikiaov.terminology.internal.reference.application.PublicReferenceCatalog;
import com.wikiaov.terminology.internal.settings.application.ReferenceCatalog;
import com.wikiaov.terminology.internal.web.request.SaveReferenceSettings;
import jakarta.servlet.http.HttpServletRequest;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping(ApiPaths.ROOT)
public class ReferenceController implements ReferenceApi {
    private final ReferenceCatalog catalog;
    private final PublicReferenceCatalog references;
    private final AdminReferenceCatalog adminReferences;
    private final JsonMapper json;
    private final ReadModelCache cache;

    public ReferenceController(ReferenceCatalog catalog, PublicReferenceCatalog references,
            AdminReferenceCatalog adminReferences, JsonMapper json, ReadModelCache cache) {
        this.catalog = catalog;
        this.references = references;
        this.adminReferences = adminReferences;
        this.json = json;
        this.cache = cache;
    }

    @GetMapping(path = "/admin/reference-catalog", version = "1")
    public AdminReferenceCatalogView adminReferences(@RequestParam(required = false) UUID rulesetId,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of("rulesetId"));
        return adminReferences.read(rulesetId);
    }

    @GetMapping(path = "/reference-catalog", version = "1")
    public ResponseEntity<ReferenceSettingsView> references(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale,
            @RequestParam(required = false) UUID seasonId, @RequestParam(required = false) UUID patchVariantId,
            @RequestParam(defaultValue = "false") boolean includeUnscoped, HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request,
                Set.of("region", "locale", "seasonId", "patchVariantId", "includeUnscoped"));
        return cached(seasonId == null && patchVariantId == null
                ? references.read(region, locale)
                : references.read(region, locale, seasonId, patchVariantId, includeUnscoped), web);
    }

    @GetMapping(path = "/reference-settings", version = "1")
    public ResponseEntity<ReferenceSettingsView> publicSettings(HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of());
        return cached(cache.read(ReadModelCache.Area.PUBLIC_TERMS, "all", ReferenceSettingsView.class,
                catalog::readPublic), web);
    }

    @GetMapping(path = "/admin/reference-settings", version = "1")
    public ReferenceSettingsView adminSettings(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.readAdmin();
    }

    @PutMapping(path = "/admin/reference-settings", version = "1")
    public ReferenceSettingsView save(@RequestBody SaveReferenceSettings request) {
        return catalog.save(request.expectedVersion(), request.settings());
    }

    private ResponseEntity<ReferenceSettingsView> cached(ReferenceSettingsView value, WebRequest request) {
        try {
            String tag = "\"" + HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(json.writeValueAsBytes(value))) + "\"";
            var cache = CacheControl.noCache().cachePublic();
            if (request.checkNotModified(tag))
                return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(tag).cacheControl(cache).build();
            return ResponseEntity.ok().eTag(tag).cacheControl(cache).body(value);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
