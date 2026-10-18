package com.wikiaov.access;

/** Executes a previously authorized hero import without retaining user credentials. */
public interface AcceptedCommands {
    void runHeroImport(Actor owner, Runnable command);
}
