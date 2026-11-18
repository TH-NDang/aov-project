package com.wikiaov.platform;

/** The shape of a catalog code: lower-case letters and digits in words joined by single hyphens. */
public final class CatalogCodes {
    public static final String PATTERN = "[a-z0-9]+(?:-[a-z0-9]+)*";

    private CatalogCodes() {
    }
}
