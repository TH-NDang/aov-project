package com.wikiaov.media.internal.source.infrastructure;

import com.wikiaov.media.internal.source.application.SourceProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(SourceProperties.class)
class SourceConfiguration {
}
