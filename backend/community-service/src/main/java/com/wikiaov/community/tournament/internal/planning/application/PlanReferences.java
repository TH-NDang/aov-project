package com.wikiaov.community.tournament.internal.planning.application;

import com.wikiaov.community.tournament.CompetitionReferences;
import com.wikiaov.community.tournament.internal.planning.persistence.CompetitionPlanRepository;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
public class PlanReferences implements CompetitionReferences {
    private final CompetitionPlanRepository plans;

    public PlanReferences(CompetitionPlanRepository plans) {
        this.plans = plans;
    }

    @Override
    public long identityReferences(String kind, UUID id) {
        return plans.countReferences(id.toString());
    }

    @Override
    public long mediaReferences(UUID id) {
        return plans.countMedia(id.toString());
    }
}
