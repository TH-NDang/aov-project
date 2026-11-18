package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroAuthoring;
import com.wikiaov.hero.internal.authoring.application.HeroEvaluationCommands.UpdateNotesCommand;
import com.wikiaov.hero.internal.authoring.application.HeroEvaluationCommands.UpdateTraitsCommand;
import com.wikiaov.platform.ApiPaths;
import java.util.UUID;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes/{heroId}/drafts/{draftId}")
public class HeroEvaluationController implements HeroEvaluationApi {
    private final HeroAuthoring authoring;

    public HeroEvaluationController(HeroAuthoring authoring) {
        this.authoring = authoring;
    }

    @Override
    @PutMapping(path = "/traits", version = "1")
    public HeroRevisionView updateTraits(@PathVariable UUID heroId, @PathVariable UUID draftId,
            @RequestBody UpdateTraitsCommand body) {
        return authoring.updateTraits(heroId, draftId, body);
    }

    @Override
    @PutMapping(path = "/notes", version = "1")
    public HeroRevisionView updateNotes(@PathVariable UUID heroId, @PathVariable UUID draftId,
            @RequestBody UpdateNotesCommand body) {
        return authoring.updateNotes(heroId, draftId, body);
    }
}
