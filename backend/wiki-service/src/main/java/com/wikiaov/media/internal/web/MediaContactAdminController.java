package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.application.response.MediaContactView;
import com.wikiaov.media.internal.contact.application.MediaContacts;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN + "/media/contact-requests")
class MediaContactAdminController implements MediaContactAdminApi {
    private final MediaContacts contacts;

    MediaContactAdminController(MediaContacts contacts) {
        this.contacts = contacts;
    }

    @GetMapping(version = "1")
    public PageSlice<MediaContactView> list(HttpServletRequest http, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        QueryParameters.requireOnly(http, Set.of("page", "size"));
        return contacts.list(page, size);
    }

    @PostMapping(path = "/{id}/resolve", version = "1")
    public MediaContactView resolve(@PathVariable UUID id) {
        return contacts.resolve(id);
    }
}
