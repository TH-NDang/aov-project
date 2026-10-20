package com.wikiaov.platform.internal.cache;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ReadModelCacheProperties.class)
class ReadModelCacheConfiguration {
}
