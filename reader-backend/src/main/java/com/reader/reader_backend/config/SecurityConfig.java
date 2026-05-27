package com.reader.reader_backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, org.springframework.web.cors.CorsConfigurationSource corsConfigurationSource) throws Exception {
        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource))
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/auth/**").permitAll()
                
                // 🔓 STRATEGY A: Allow guests to hit the file endpoints safely
                // This stops Spring Security from throwing 403s on loading the list or uploading!
                .requestMatchers(HttpMethod.GET, "/api/files").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/files/upload").permitAll()
                .requestMatchers(HttpMethod.DELETE, "/api/files/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/files/download/**").permitAll()
                
                .anyRequest().authenticated()
            );

        // This ensures your custom token processor runs first to set up the guest identities
        http.addFilterBefore(new SimpleTokenFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}