package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.SkinImagePublicationRequest;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.skins.application.SkinImagePublications;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes/{heroId}/skin-images/publish")
public class SkinImagePublicationController implements SkinImagePublicationApi {
    private final SkinImagePublications publications;

    public SkinImagePublicationController(SkinImagePublications publications) {
        this.publications = publications;
    }

    @PostMapping(version = "1")
    public HeroRevisionView publish(@PathVariable UUID heroId, @RequestBody SkinImagePublicationRequest body,
            HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return publications.publish(heroId, body);
    }
}
