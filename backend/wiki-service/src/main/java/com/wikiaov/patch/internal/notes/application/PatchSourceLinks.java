package com.wikiaov.patch.internal.notes.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.patch.PatchSource;
import com.wikiaov.patch.PatchSources;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.notes.persistence.PatchSourceLinkRepository;
import com.wikiaov.patch.internal.notes.persistence.entity.PatchSourceLink;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogAggregates;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** The links to the official notes of a patch variant: one list for the whole patch, replaced as a whole. */
@Service
@RequiredArgsConstructor
@Transactional
public class PatchSourceLinks implements PatchSources {
    static final int MAX_SOURCES = 10;
    static final int MAX_LABEL = 80;
    static final int MAX_URL = 2048;

    private final PatchSourceLinkRepository links;
    private final PatchVariantRepository variants;
    private final CurrentActor actors;
    private final AuditLog audit;

    public record UpdatePatchSources(
            List<PatchSource> sources
    ) {
    }

    /** Joins the caller's transaction as it is, since other modules read the links while they write. */
    @Override
    public List<PatchSource> of(UUID variantId) {
        return links.findByVariantIdOrderByPositionAsc(variantId).stream().map(PatchSourceLinks::view).toList();
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<PatchSource> read(UUID id) {
        if (!variants.existsById(id)) {
            throw notFound();
        }
        return of(id);
    }

    @PreAuthorize("hasAuthority('patch:write')")
    public List<PatchSource> save(UUID id, UpdatePatchSources input) {
        var wanted = validate(input);

        variants.lockById(id).orElseThrow(PatchSourceLinks::notFound);
        var before = of(id);
        if (before.equals(wanted)) {
            return before;
        }

        links.deleteByVariant(id);
        var rows = new ArrayList<PatchSourceLink>();
        for (int index = 0; index < wanted.size(); index++) {
            var source = wanted.get(index);
            var row = new PatchSourceLink();
            row.setId(UUID.randomUUID());
            row.setVariantId(id);
            row.setPosition(index);
            row.setUrl(source.url());
            row.setLabel(source.label());
            row.setLocale(source.locale());
            rows.add(row);
        }
        links.saveAllAndFlush(rows);
        audit.record(new AuditEntry(actors.require(), "PATCH_SOURCES_UPDATED", CatalogAggregates.PATCH, id, null,
                null, null, null, Map.of("before", before.size(), "after", wanted.size())));

        return wanted;
    }

    private static List<PatchSource> validate(UpdatePatchSources input) {
        if (input == null || input.sources() == null || input.sources().size() > MAX_SOURCES) {
            throw invalid("Provide up to " + MAX_SOURCES + " source links.");
        }
        var urls = new HashSet<String>();
        var result = new ArrayList<PatchSource>();
        for (var source : input.sources()) {
            if (source == null) {
                throw invalid("A source link cannot be empty.");
            }
            String url = requireUrl(source.url());
            String label = source.label() == null ? "" : source.label().strip();
            if (label.isEmpty() || label.length() > MAX_LABEL) {
                throw invalid("Give each source link a label of up to " + MAX_LABEL + " characters.");
            }
            String locale = source.locale() == null || source.locale().isBlank() ? null : source.locale().strip();
            if (locale != null && (locale.length() > 35
                    || !Locale.forLanguageTag(locale).toLanguageTag().equals(locale))) {
                throw invalid("Use a canonical BCP 47 locale for a source link.");
            }
            if (!urls.add(url)) {
                throw invalid("Each source link may appear once.");
            }
            result.add(new PatchSource(url, label, locale));
        }
        return List.copyOf(result);
    }

    private static String requireUrl(String value) {
        String url = value == null ? "" : value.strip();
        try {
            var uri = new URI(url);
            if (url.length() <= MAX_URL && uri.getHost() != null
                    && ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))) {
                return url;
            }
        } catch (URISyntaxException ignored) {
            // Answered below like any other link that is not HTTP(S).
        }
        throw invalid("A source link must be an HTTP(S) address.");
    }

    private static PatchSource view(PatchSourceLink link) {
        return new PatchSource(link.getUrl(), link.getLabel(), link.getLocale());
    }

    private static ApiException invalid(String detail) {
        return new ApiException(PatchErrorCode.PATCH_INVALID, detail);
    }

    private static ApiException notFound() {
        return new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "The patch variant was not found.");
    }
}
