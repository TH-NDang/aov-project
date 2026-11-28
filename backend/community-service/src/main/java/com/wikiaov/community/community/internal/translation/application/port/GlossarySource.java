package com.wikiaov.community.community.internal.translation.application.port;

import com.wikiaov.community.community.internal.translation.domain.Glossary;

/** The shared terminology of wiki-service, read through its public API (ADR-011, ADR-037). */
public interface GlossarySource {
    /** The latest glossary; an empty one when wiki-service could not be read yet. */
    Glossary glossary();
}
