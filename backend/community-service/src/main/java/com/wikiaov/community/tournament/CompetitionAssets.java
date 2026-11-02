package com.wikiaov.community.tournament;

/** Serializes media reference changes with retirement of managed images. */
public interface CompetitionAssets {
    void acquire(String... urls);
}
