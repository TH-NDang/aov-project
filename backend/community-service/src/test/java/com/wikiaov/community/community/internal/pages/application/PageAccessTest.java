package com.wikiaov.community.community.internal.pages.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.wikiaov.community.community.internal.application.PageErrorCode;
import com.wikiaov.community.community.internal.domain.PageContent.Kind;
import com.wikiaov.community.community.internal.domain.PageContent.Role;
import com.wikiaov.community.community.internal.membership.persistence.PageMember;
import com.wikiaov.community.community.internal.membership.persistence.PageMemberRepository;
import com.wikiaov.community.community.internal.pages.persistence.PageAuditRepository;
import com.wikiaov.community.community.internal.pages.persistence.PageRecord;
import com.wikiaov.community.community.internal.pages.persistence.PageRepository;
import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.platform.CommunityActor;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PageAccessTest {
    private static final UUID PAGE = UUID.randomUUID();
    private static final CommunityActor EDITOR = new CommunityActor("issuer\neditor", "Editor", Set.of());

    private final PageRepository pages = mock(PageRepository.class);
    private final PageMemberRepository members = mock(PageMemberRepository.class);
    private final PageAccess access = new PageAccess(pages, members, mock(PageAuditRepository.class));

    @Test
    void aMemberHoldingOneOfTheRolesPasses() {
        page(Kind.TEAM);
        member(Role.EDITOR);

        assertThatCode(() -> access.require(PAGE, EDITOR, Role.OWNER, Role.EDITOR)).doesNotThrowAnyException();
    }

    @Test
    void aMemberWithAnotherRoleIsRefused() {
        page(Kind.TEAM);
        member(Role.EDITOR);

        var error = catchThrowableOfType(ApiException.class, () -> access.require(PAGE, EDITOR, Role.OWNER));

        assertThat(error.getErrorCode()).isEqualTo(PageErrorCode.PAGE_ACTION_FORBIDDEN);
    }

    @Test
    void nobodyHasARoleOnACircuitPage() {
        page(Kind.CIRCUIT);
        member(Role.OWNER);

        assertThat(access.role(PAGE, EDITOR)).isEmpty();
    }

    private void page(Kind kind) {
        var row = new PageRecord();
        row.setId(PAGE);
        row.setKind(kind);
        when(pages.findById(PAGE)).thenReturn(Optional.of(row));
    }

    private void member(Role role) {
        var row = new PageMember();
        row.setPageId(PAGE);
        row.setActor(EDITOR.key());
        row.setRole(role);
        when(members.findByPageIdAndActor(PAGE, EDITOR.key())).thenReturn(Optional.of(row));
    }
}
