package com.wikiaov.platform;

/**
 * API path prefixes of wiki-service.
 *
 * <p>The {@code {apiVersion}} segment (e.g. {@code v1}) is resolved by Spring MVC native API versioning
 * (see {@code ApiVersioningConfiguration}). Controllers map {@code ROOT + "/heroes"} and declare
 * {@code version = "1"} on the mapping, so a new version never changes existing controllers' paths.
 */
public final class ApiPaths {

    /** Mapping prefix for controllers. */
    public static final String ROOT = "/api/wiki/{apiVersion}";
    /** Mapping prefix for administrative controllers. */
    public static final String ADMIN = ROOT + "/admin";

    /** URL pattern matching every API version, for security rules and interceptors. */
    public static final String ANY_VERSION_PATTERN = "/api/wiki/*/**";
    /** URL pattern matching the admin API of every version. */
    public static final String ANY_VERSION_ADMIN_PATTERN = "/api/wiki/*/admin/**";

    private ApiPaths() {
    }
}
