package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.contact.application.MediaContactThrottle;
import com.wikiaov.media.internal.contact.application.MediaContacts;
import com.wikiaov.media.internal.web.request.ContactRequest;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ROOT + "/media/contact-requests")
class MediaContactController implements MediaContactApi {
    private final MediaContacts contacts;
    private final MediaContactThrottle throttle;

    MediaContactController(MediaContacts contacts, MediaContactThrottle throttle) {
        this.contacts = contacts;
        this.throttle = throttle;
    }

    @PostMapping(version = "1")
    public ResponseEntity<Receipt> submit(HttpServletRequest http, @RequestBody ContactRequest request) {
        QueryParameters.requireOnly(http, Set.of());
        throttle.check(http.getRemoteAddr());
        var id = contacts.submit(request.assetId(), request.versionId(), request.name(), request.email(),
                request.topic(), request.message());
        return ResponseEntity.status(201).header("Cache-Control", "no-store").body(new Receipt(id));
    }
}
