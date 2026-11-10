package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroCommands.ReplaceForms;
import com.wikiaov.hero.internal.application.response.HeroFormsView;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes/{heroId}/forms")
public class HeroFormsController implements HeroFormsApi {
    private final HeroForms forms;

    public HeroFormsController(HeroForms forms) {
        this.forms = forms;
    }

    @GetMapping(version = "1")
    public HeroFormsView read(@PathVariable UUID heroId, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return forms.view(heroId);
    }

    @PutMapping(version = "1")
    public HeroFormsView replace(@PathVariable UUID heroId, @RequestBody ReplaceForms body) {
        return forms.replace(heroId, body);
    }
}
