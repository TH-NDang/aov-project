package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.ApiPaths;
import com.wikiaov.community.platform.QueryParameters;
import com.wikiaov.community.tournament.internal.verification.application.ContentVerifications;
import com.wikiaov.community.tournament.internal.verification.application.ContentVerifications.Summary;
import com.wikiaov.community.tournament.internal.verification.application.ContentVerifications.Verify;
import com.wikiaov.community.tournament.internal.verification.application.ContentVerifications.View;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(path = ApiPaths.ADMIN + "/competitions")
public class ContentVerificationController implements ContentVerificationApi {
    private final ContentVerifications verifications;

    public ContentVerificationController(ContentVerifications verifications) {
        this.verifications = verifications;
    }

    @Override
    @GetMapping(path = "/verifications", version = "1")
    public List<Summary> summaries(HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return verifications.summaries();
    }

    @Override
    @GetMapping(path = "/{id}/verifications", version = "1")
    public List<View> list(@PathVariable UUID id, HttpServletRequest request) {
        QueryParameters.requireOnly(request, Set.of());
        return verifications.list(id);
    }

    @Override
    @PostMapping(path = "/{id}/verifications", version = "1")
    public View verify(@PathVariable UUID id, @RequestBody Verify body) {
        return verifications.verify(id, body);
    }

    @Override
    @PostMapping(path = "/{id}/verifications/{verificationId}/remove", version = "1")
    public ResponseEntity<Void> remove(@PathVariable UUID id, @PathVariable UUID verificationId) {
        verifications.remove(id, verificationId);
        return ResponseEntity.noContent().build();
    }
}
