package com.wikiaov.community.tournament.internal.verification.application;

import com.wikiaov.community.platform.CommunityActor;
import com.wikiaov.community.tournament.internal.application.TournamentErrors;
import com.wikiaov.community.tournament.internal.registry.persistence.TournamentRepository;
import com.wikiaov.community.tournament.internal.verification.domain.VerificationPart;
import com.wikiaov.community.tournament.internal.verification.persistence.ContentVerificationRecord;
import com.wikiaov.community.tournament.internal.verification.persistence.ContentVerificationRecord.Check;
import com.wikiaov.community.tournament.internal.verification.persistence.ContentVerificationRepository;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import org.jspecify.annotations.Nullable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The owner's hand checks of a tournament's data (spec 04, tournament data verification). Admin derives the token of a
 * part from what it shows, so a check names the exact version that was read; a part whose current token has no check
 * reads as unchecked, or as changed when an older version was checked. Only Admin reads these rows.
 */
@Service
public class ContentVerifications {
    static final int LABEL_LIMIT = 200;
    static final int NOTE_LIMIT = 1000;
    static final int NAME_LIMIT = 200;
    private static final Pattern TOKEN = Pattern.compile("[A-Za-z0-9][A-Za-z0-9:._-]{0,127}");

    private final ContentVerificationRepository verifications;
    private final TournamentRepository tournaments;

    public ContentVerifications(ContentVerificationRepository verifications, TournamentRepository tournaments) {
        this.verifications = verifications;
        this.tournaments = tournaments;
    }

    /** What Admin sends when a person has checked one version of one part. */
    public record Verify(
            String part,
            String contentToken,
            @Nullable String label,
            @Nullable String note
    ) {
    }

    /** One check, newest first in lists. */
    public record View(
            UUID id,
            String part,
            String contentToken,
            @Nullable String label,
            @Nullable String note,
            Instant verifiedAt,
            @Nullable String verifiedByName
    ) {
    }

    /** How far the checks of one tournament go: parts with a check of any version, and the newest check. */
    public record Summary(
            UUID tournamentId,
            long parts,
            Instant lastVerifiedAt
    ) {
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public List<View> list(UUID tournamentId) {
        requireTournament(tournamentId);

        return verifications.findByTournamentIdOrderByVerifiedAtDescIdAsc(tournamentId).stream()
                .map(ContentVerifications::view).toList();
    }

    @PreAuthorize("hasAuthority('tournament:read')")
    @Transactional(readOnly = true)
    public List<Summary> summaries() {
        return verifications.lines().stream()
                .map(line -> new Summary(line.getTournamentId(), line.getParts(), line.getLastVerifiedAt())).toList();
    }

    /** Records the check, or refreshes it when this version of the part was already checked. */
    @PreAuthorize("hasAuthority('tournament:read') and hasAuthority('tournament:publish')")
    @Transactional
    public View verify(UUID tournamentId, Verify input) {
        var actor = CommunityActor.require();
        String part = part(input);
        String token = token(input.contentToken());
        String label = text(input.label(), LABEL_LIMIT, "label");
        String note = text(input.note(), NOTE_LIMIT, "note");
        requireTournament(tournamentId);

        var check = new Check(actor.key(), name(actor.name()), Instant.now(), label, note);
        var record = verifications.findByTournamentIdAndPartAndContentToken(tournamentId, part, token)
                .orElse(null);
        if (record == null) {
            record = ContentVerificationRecord.check(tournamentId, part, token, check);
        } else {
            record.recheck(check);
        }

        return view(verifications.saveAndFlush(record));
    }

    @PreAuthorize("hasAuthority('tournament:read') and hasAuthority('tournament:publish')")
    @Transactional
    public void remove(UUID tournamentId, UUID id) {
        CommunityActor.require();
        var record = verifications.findByIdAndTournamentId(id, tournamentId)
                .orElseThrow(TournamentErrors::missing);

        verifications.delete(record);
    }

    private void requireTournament(UUID tournamentId) {
        if (!tournaments.existsById(tournamentId)) {
            throw TournamentErrors.missing();
        }
    }

    private static String part(Verify input) {
        try {
            return VerificationPart.parse(input.part()).value();
        } catch (IllegalArgumentException invalid) {
            throw TournamentErrors.invalid(invalid.getMessage());
        }
    }

    private static String token(@Nullable String token) {
        if (token == null || !TOKEN.matcher(token).matches()) {
            throw TournamentErrors.invalid("Send the token of the version that was checked.");
        }
        return token;
    }

    private static @Nullable String text(@Nullable String value, int limit, String field) {
        String stripped = value == null ? "" : value.strip();
        if (stripped.length() > limit) {
            throw TournamentErrors.invalid("The " + field + " must not exceed " + limit + " characters.");
        }
        return stripped.isEmpty() ? null : stripped;
    }

    private static @Nullable String name(String name) {
        String stripped = name.strip();
        return stripped.isEmpty() ? null : stripped.substring(0, Math.min(stripped.length(), NAME_LIMIT));
    }

    private static View view(ContentVerificationRecord record) {
        return new View(record.getId(), record.getPart(), record.getContentToken(), record.getLabel(),
                record.getNote(), record.getVerifiedAt(), record.getVerifiedByName());
    }
}
