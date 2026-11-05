package com.wikiaov.community.community.internal.domain;

import java.util.Set;

/** Editorial occupations are independent of page-management permissions. */
public final class PagePersonRoles {
    private static final Set<String> ROLES = Set.of("COACH", "TEAM_ANALYST", "HOST", "INTERVIEWER", "CASTER",
            "GUEST_ANALYST");

    private PagePersonRoles() {
    }

    public static void validate(PageContent.Kind kind, PageContent content) {
        var roles = content.personRoles();
        if (roles.size() > ROLES.size() || !ROLES.containsAll(roles)
                || roles.stream().distinct().count() != roles.size())
            throw PageRules.invalid("Choose distinct supported personnel roles.");
        if (kind == PageContent.Kind.PERSON && roles.isEmpty())
            throw PageRules.invalid("Choose at least one personnel role.");
        if (kind != PageContent.Kind.PERSON && kind != PageContent.Kind.PLAYER && !roles.isEmpty())
            throw PageRules.invalid("Only individual profiles can have personnel roles.");
    }

    public static String filter(String role) {
        if (role == null)
            return "";
        if (role.equals("COACHING"))
            return "COACH,TEAM_ANALYST";
        if (role.equals("BROADCAST"))
            return "HOST,INTERVIEWER,CASTER,GUEST_ANALYST";
        if (!ROLES.contains(role))
            throw PageRules.invalid("Invalid personnel role filter.");
        return role;
    }
}
