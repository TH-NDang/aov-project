package com.wikiaov.terminology.internal.web;
import com.wikiaov.platform.*;
import com.wikiaov.terminology.internal.application.response.ReferenceSettingsView;
import com.wikiaov.terminology.internal.application.service.PublicReferenceCatalog;
import com.wikiaov.terminology.internal.application.service.ReferenceCatalog;
import com.wikiaov.terminology.internal.web.request.SaveReferenceSettings;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Set;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.context.request.WebRequest;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping(ApiPaths.ROOT)
public class ReferenceController {
    private final ReferenceCatalog catalog;
    private final PublicReferenceCatalog references;
    private final JsonMapper json;
    public ReferenceController(ReferenceCatalog catalog, PublicReferenceCatalog references, JsonMapper json) {
        this.catalog = catalog;
        this.references = references;
        this.json = json;
    }
    @GetMapping(path = "/reference-catalog", version = "1")
    ResponseEntity<ReferenceSettingsView> references(@RequestParam(defaultValue = "VN") String region,
            @RequestParam(defaultValue = "vi-VN") String locale, HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of("region", "locale"));
        return cached(references.read(region, locale), web);
    }
    @GetMapping(path = "/reference-settings", version = "1")
    ResponseEntity<ReferenceSettingsView> publicSettings(HttpServletRequest request, WebRequest web) {
        QueryParameters.requireOnly(request, Set.of());
        return cached(catalog.readPublic(), web);
    }
    @GetMapping(path = "/admin/reference-settings", version = "1")
    ReferenceSettingsView adminSettings(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return catalog.readAdmin();
    }
    @PutMapping(path = "/admin/reference-settings", version = "1")
    ReferenceSettingsView save(@Valid @RequestBody SaveReferenceSettings request) {
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
