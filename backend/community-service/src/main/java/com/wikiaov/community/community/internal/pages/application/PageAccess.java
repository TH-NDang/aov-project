package com.wikiaov.community.community.internal.pages.application;

import com.wikiaov.community.community.internal.application.PageErrorCode;
import com.wikiaov.community.community.internal.domain.PageContent.Role;
import com.wikiaov.community.community.internal.membership.persistence.PageMember;
import com.wikiaov.community.community.internal.membership.persistence.PageMemberRepository;
import com.wikiaov.community.community.internal.pages.persistence.PageAudit;
import com.wikiaov.community.community.internal.pages.persistence.PageAuditRepository;
import com.wikiaov.community.community.internal.pages.persistence.PageRecord;
import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.platform.CommunityActor;
import java.time.Instant;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
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
        if (page.getPublishedContent() == null) {
            throw missing();
        }
        return page;
    }

    /** The account's role on a community page; none on a circuit page, which has no representatives. */
    public Optional<Role> role(UUID id, CommunityActor actor) {
        if (!community(read(id))) {
            return Optional.empty();
        }
        return members.findByPageIdAndActor(id, actor.key()).map(PageMember::getRole);
    }

    public PageRecord social(UUID id) {
        var page = published(id);
        requireCommunity(page);
        return page;
    }

    public static boolean community(PageRecord page) {
        return !"CIRCUIT".equals(page.getKind());
    }

    public static void requireCommunity(PageRecord page) {
        if (!community(page)) {
            throw new ApiException(PageErrorCode.PAGE_ACTION_FORBIDDEN,
                    "Circuit pages are editorial information pages and do not support community accounts.");
        }
    }

    public void require(UUID id, CommunityActor actor, Role... roles) {
        if (role(id, actor).filter(Set.of(roles)::contains).isEmpty()) {
            throw forbidden();
        }
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
        if (expected == null || actual != expected) {
            throw new ApiException(PageErrorCode.PAGE_CONFLICT, "The page changed. Reload before saving.");
        }
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
