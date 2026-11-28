package com.wikiaov.community.community.internal.web;

import com.wikiaov.community.community.internal.translation.application.PostTranslationView;
import com.wikiaov.community.community.internal.translation.application.PostTranslations;
import com.wikiaov.community.community.internal.translation.application.TranslationStatus;
import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
class TranslationController implements TranslationApi {
    private final PostTranslations translations;
    private final HttpServletRequest request;

    TranslationController(PostTranslations translations, HttpServletRequest request) {
        this.translations = translations;
        this.request = request;
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/translation", version = "1")
    public TranslationStatus status() {
        QueryParameters.requireOnly(request, Set.of());
        return translations.status();
    }

    @Override
    @GetMapping(path = ApiPaths.ROOT + "/posts/{id}/translation", version = "1")
    public ResponseEntity<PostTranslationView> post(@PathVariable UUID id, @RequestParam String locale) {
        QueryParameters.requireOnly(request, Set.of("locale"));
        String person = CommunityActor.personKey();
        String requester = person != null ? "account:" + person : "address:" + request.getRemoteAddr();
        // The answer changes when the post is edited, so it is not cached by browsers or proxies.
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(translations.translate(id, locale, requester));
    }
}
