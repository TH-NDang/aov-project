package com.wikiaov.access.internal.infrastructure;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration(proxyBeanMethods = false)
class SecurityConfiguration {
    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        // Closed until public API and JWT issuer/audience policies are implemented.
        return http.authorizeHttpRequests(authorize -> authorize
                .requestMatchers(org.springframework.http.HttpMethod.GET, "/actuator/health").permitAll()
                .anyRequest().denyAll())
                .build();
    }
}

