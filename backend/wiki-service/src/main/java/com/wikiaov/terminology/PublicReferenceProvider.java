package com.wikiaov.terminology;
import java.util.List;
import java.util.UUID;

/** Each catalog supplies only records published in the requested gameplay context. */
public interface PublicReferenceProvider {
    List<Candidate> references(String region, String locale);
    record Candidate(
            UUID id,
            String kind,
            String name,
            String description,
            String locale,
            String icon
    ) {
    }
}
