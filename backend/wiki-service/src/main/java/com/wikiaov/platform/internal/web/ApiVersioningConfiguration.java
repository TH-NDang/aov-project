package com.wikiaov.platform.internal.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ApiVersionConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Spring MVC 7 native API versioning from the path: {@code /api/wiki/v1/heroes} has segments
 * 0 = "api", 1 = "wiki", 2 = "v1", so version 1 is read from segment 2.
 *
 * <p>Only paths under {@code /api/wiki/} are parsed; actuator and error routes are not. An unsupported
 * version (e.g. {@code v2}) is rejected with {@code INVALID_API_VERSION} instead of falling back to v1.
 * To add a version: add it here, then add {@code version = "2"} mappings next to the v1 ones.
 */
@Configuration(proxyBeanMethods = false)
class ApiVersioningConfiguration implements WebMvcConfigurer {

    static final int VERSION_SEGMENT = 2;

    @Override
    public void configureApiVersioning(ApiVersionConfigurer configurer) {
        configurer
                .usePathSegment(VERSION_SEGMENT, path -> path.pathWithinApplication().value().startsWith("/api/wiki/"))
                .addSupportedVersions("1")
                .setVersionRequired(false);
    }
}
