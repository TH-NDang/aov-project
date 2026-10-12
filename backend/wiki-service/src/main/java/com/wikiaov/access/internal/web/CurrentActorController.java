package com.wikiaov.access.internal.web;

import com.wikiaov.access.Actor;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Returns identity and capabilities from the verified access token. */
@RestController
public class CurrentActorController {
    private final CurrentActor currentActor;

    public CurrentActorController(CurrentActor currentActor) {
        this.currentActor = currentActor;
    }

    @GetMapping(path = ApiPaths.ADMIN + "/me", version = "1")
    Actor me(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return currentActor.require();
    }
}
