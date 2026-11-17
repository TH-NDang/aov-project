package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroUploadSessionView;
import com.wikiaov.hero.internal.importing.application.HeroUploadSessions;
import com.wikiaov.hero.internal.web.request.HeroUploadSessionRequest;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/heroes/import/upload-sessions")
public class HeroUploadSessionController implements HeroUploadSessionApi {
    private final HeroUploadSessions sessions;

    public HeroUploadSessionController(HeroUploadSessions sessions) {
        this.sessions = sessions;
    }

    @GetMapping(version = "1")
    public List<HeroUploadSessionView> list(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return sessions.list();
    }

    @PutMapping(path = "/{id}", version = "1")
    public HeroUploadSessionView save(@PathVariable UUID id, @RequestBody HeroUploadSessionRequest request) {
        return sessions.save(id, request.version(), request.state());
    }

    @DeleteMapping(path = "/{id}", version = "1")
    public void delete(@PathVariable UUID id) {
        sessions.delete(id);
    }
}
