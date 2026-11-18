package com.wikiaov.community.tournament.internal.games.application;

import com.wikiaov.community.platform.ApiException;
import com.wikiaov.community.tournament.internal.application.TournamentErrorCode;
import java.util.List;
import java.util.Map;

public class PublicationIncomplete extends ApiException {
    private final List<String> missingFields;

    public PublicationIncomplete(List<String> fields) {
        super(TournamentErrorCode.TOURNAMENT_PUBLICATION_INCOMPLETE,
                "Complete the required game observations before publication.",
                Map.of("missingFields", fields));
        this.missingFields = List.copyOf(fields);
    }

    public List<String> missingFields() {
        return missingFields;
    }
}
