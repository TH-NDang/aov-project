package com.wikiaov.community.platform;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;

@Configuration
class WebConfiguration implements WebMvcConfigurer {
    private final String[] origins;

    WebConfiguration(@Value("${community.allowed-origins}") String[] origins) {
        this.origins = origins;
    }

    @Override
    public void configureApiVersioning(ApiVersionConfigurer configurer) {
        configurer.usePathSegment(2, path -> path.pathWithinApplication().value().startsWith("/api/community/"))
                .addSupportedVersions("1").setVersionRequired(false);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/community/**").allowedOrigins(origins).allowedMethods("GET", "POST", "PUT", "OPTIONS")
                .allowedHeaders("Authorization", "Content-Type").maxAge(3600);
    }
}
