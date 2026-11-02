package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.application.PageErrorCode;
import com.wikiaov.community.community.internal.membership.persistence.PageMemberRepository;
import com.wikiaov.community.community.internal.pages.persistence.*;
import com.wikiaov.community.platform.*;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class PageAccess {
    private final PageRepository pages;
    private final PageMemberRepository members;
    private final PageAuditRepository audits;

    public PageAccess(PageRepository pages, PageMemberRepository members, PageAuditRepository audits) {
        this.pages = pages;
        this.members = members;
        this.audits = audits;
    }

    public PageRecord read(UUID id) {
        return pages.findById(id).orElseThrow(PageAccess::missing);
    }

    public PageRecord lock(UUID id) {
        return pages.lock(id).orElseThrow(PageAccess::missing);
    }

    public PageRecord published(UUID id) {
        var page = read(id);
        if (page.getPublishedContent() == null)
            throw missing();
        return page;
    }

    public String role(UUID id, CommunityActor actor) {
        return members.findByPageIdAndActor(id, actor.key()).map(member -> member.getRole()).orElse("");
    }

    public void require(UUID id, CommunityActor actor, String... roles) {
        if (!Set.of(roles).contains(role(id, actor)))
            throw forbidden();
    }

    public void audit(UUID id, CommunityActor actor, String action) {
        var event = new PageAudit();
        event.setPageId(id);
        event.setActor(actor.key());
        event.setAction(action);
        event.setOccurredAt(Instant.now());
        audits.save(event);
    }

    public static void version(long actual, Long expected) {
        if (expected == null || actual != expected)
            throw new ApiException(PageErrorCode.PAGE_CONFLICT, "The page changed. Reload before saving.");
    }

    public static ApiException missing() {
        return new ApiException(PageErrorCode.PAGE_NOT_FOUND, "Page or content was not found.");
    }

    public static ApiException conflict(String detail) {
        return new ApiException(PageErrorCode.PAGE_CONFLICT, detail);
    }

    public static ApiException forbidden() {
        return new ApiException(PageErrorCode.PAGE_ACTION_FORBIDDEN, "This account cannot perform this action.");
    }
}
