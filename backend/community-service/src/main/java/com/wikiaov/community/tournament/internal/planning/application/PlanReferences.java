package com.wikiaov.community.tournament.internal.planning.application;

import com.wikiaov.community.tournament.CompetitionReferences;
import com.wikiaov.community.tournament.CompetitionReferences.Subject;
import com.wikiaov.community.tournament.internal.planning.domain.PlanRevisionAction;
import com.wikiaov.community.tournament.internal.planning.persistence.CompetitionPlanRepository;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class PlanReferences implements CompetitionReferences {
    private static final List<String> PUBLIC_ACTIONS = PlanRevisionAction.PUBLIC_HISTORY.stream()
            .map(PlanRevisionAction::name).sorted().toList();
    private final CompetitionPlanRepository plans;

    public PlanReferences(CompetitionPlanRepository plans) {
        this.plans = plans;
    }

    /**
     * A registry record only ever goes to the trash, so a plan that went there with its tournament no longer keeps it
     * out. A page is deleted for good: every plan that names it keeps protecting it, those in the trash included, since
     * their tournament can still be restored.
     */
    @Override
    public long identityReferences(Subject subject, UUID id) {
        return plans.countReferences(subject.name(), id.toString(), PUBLIC_ACTIONS, subject == Subject.PAGE);
    }

    @Override
    public long mediaReferences(UUID id) {
        return plans.countMedia(id.toString());
    }

    @Override
    public List<String> allMediaReferences() {
        return plans.allMedia();
    }
}
