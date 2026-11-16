package com.wikiaov.media;

import java.util.Collection;
import java.util.List;
import java.util.Set;

/**
 * Reverse usage of private source files (ADR-030 section 7), implemented by every module that keeps the SHA-256 of a
 * capture as evidence, for example recommended builds and ranking snapshots.
 *
 * <p>The owner module stays the source of truth: media asks each provider before purging stored bytes and when it
 * shows where a file is used. Implementations are Spring beans; media collects all of them.
 */
public interface SourceFileUsageProvider {

    /** Every reference to the bytes with this lower-case SHA-256 held by this module; empty if there is none. */
    List<SourceFileUsage> findUsages(String sha256);

    /** The subset of {@code sha256s} this module references, so many files can be checked in one query. */
    Set<String> findReferenced(Collection<String> sha256s);
}
