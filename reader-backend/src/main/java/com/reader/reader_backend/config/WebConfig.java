package com.reader.reader_backend.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

public class WebConfig implements WebMvcConfigurer {

    @Value("${app.cors.allowed-origins}")
    private String[] allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**") // Match every single endpoint path under the sun
                .allowedOrigins(allowedOrigins) // Read the whitelist from application.properties
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // Allow all CRUD operations
                .allowedHeaders("*") // Allow all browser request metadata headers
                .allowCredentials(true);
    }
}