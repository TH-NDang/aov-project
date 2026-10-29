package com.wikiaov.community.tournament.internal.application;

import com.wikiaov.community.platform.ApiException;
import java.util.List;

public class PublicationIncomplete extends ApiException {
    private final List<String> missingFields;

    public PublicationIncomplete(List<String> fields) {
        super(TournamentErrorCode.TOURNAMENT_PUBLICATION_INCOMPLETE,
                "Complete the required game observations before publication.",
                java.util.Map.of("missingFields", fields));
        this.missingFields = List.copyOf(fields);
    }

    public List<String> missingFields() {
        return missingFields;
    }
}
