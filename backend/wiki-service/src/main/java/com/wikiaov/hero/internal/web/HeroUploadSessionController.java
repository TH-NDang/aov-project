package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroUploadSessionView;
import com.wikiaov.hero.internal.application.service.HeroUploadSessions;
import com.wikiaov.hero.internal.web.request.HeroUploadSessionRequest;
import com.wikiaov.platform.ApiPaths;
import jakarta.validation.Valid;
import java.util.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping(path = ApiPaths.ADMIN + "/heroes/import/upload-sessions", version = "1")
@PreAuthorize("hasAuthority('hero:write')")
public class HeroUploadSessionController {
    private final HeroUploadSessions sessions;
    public HeroUploadSessionController(HeroUploadSessions sessions) {
        this.sessions = sessions;
    }
    @GetMapping
    List<HeroUploadSessionView> list() {
        return sessions.list();
    }
    @PutMapping("/{id}")
    HeroUploadSessionView save(@PathVariable UUID id, @Valid @RequestBody HeroUploadSessionRequest request) {
        return sessions.save(id, request.version(), request.state());
    }
    @DeleteMapping("/{id}")
    void delete(@PathVariable UUID id) {
        sessions.delete(id);
    }
}
