package com.wikiaov.community.community.internal.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class PagePersonRolesTest {
    @Test
    void aPersonNeedsAtLeastOneRole() {
        assertThatThrownBy(() -> PagePersonRoles.validate(PageContent.Kind.PERSON, withRoles()))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void aPlayerMayAlsoHoldAPersonnelRole() {
        assertThatCode(() -> PagePersonRoles.validate(PageContent.Kind.PLAYER, withRoles("CASTER")))
                .doesNotThrowAnyException();
    }

    @Test
    void aContentCreatorIsAPersonnelRole() {
        assertThatCode(() -> PagePersonRoles.validate(PageContent.Kind.PERSON, withRoles("CREATOR")))
                .doesNotThrowAnyException();
        assertThat(PagePersonRoles.filter("CREATOR")).isEqualTo("CREATOR");
    }

    @Test
    void theBroadcastFilterLeavesCreatorsOut() {
        assertThat(PagePersonRoles.filter("BROADCAST")).doesNotContain("CREATOR");
    }

    @Test
    void aTeamHasNoPersonnelRoles() {
        assertThatThrownBy(() -> PagePersonRoles.validate(PageContent.Kind.TEAM, withRoles("COACH")))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void aRoleIsListedOnce() {
        assertThatThrownBy(() -> PagePersonRoles.validate(PageContent.Kind.PERSON, withRoles("HOST", "HOST")))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void anUnknownRoleIsRefused() {
        assertThatThrownBy(() -> PagePersonRoles.validate(PageContent.Kind.PERSON, withRoles("REFEREE")))
                .isInstanceOf(PageRules.InvalidPage.class);
    }

    @Test
    void theCoachingFilterNamesItsRoles() {
        assertThat(PagePersonRoles.filter("COACHING")).isEqualTo("COACH,TEAM_ANALYST");
    }

    @Test
    void noFilterKeepsEveryRole() {
        assertThat(PagePersonRoles.filter(null)).isEmpty();
    }

    @Test
    void anUnknownFilterIsRefused() {
        assertThatThrownBy(() -> PagePersonRoles.filter("REFEREE")).isInstanceOf(PageRules.InvalidPage.class);
    }

    private static PageContent withRoles(String... roles) {
        return new PageContent("Name", null, null, null, null, null, List.of(), List.of(), List.of(), List.of(),
                List.of(), List.of(roles), null);
    }
}
