package com.reader.reader_backend.controller;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);

    // DEVELOPMENT: Track registered emails and passwords in memory
    private final Map<String, String> registeredUsers = new ConcurrentHashMap<>();

    public AuthController() {
    }

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Email and password are required"));
        }

        // TODO: Replace this hardcoded check with actual database verification 
        // (e.g., fetching the user via UserRepository and checking with PasswordEncoder)
        String storedPassword = registeredUsers.get(email);
        if (storedPassword == null) {
            // For dev purposes, if the user isn't in memory yet, allow fallback password123 
            // so we don't break existing dev sessions if the server restarts.
            if (!"password123".equals(password)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password"));
            }
        } else if (!storedPassword.equals(password)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Invalid email or password"));
        }

        // DEVELOPMENT: return a simple token.
        String token = "Bearer user:" + email;
        logger.info("Login success for {} (dev auth)", email);
        return ResponseEntity.ok(Map.of("token", token));
    }

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");

        if (email == null || email.isBlank() || password == null || password.isBlank()) {
            return ResponseEntity.badRequest().build();
        }

        // DEVELOPMENT: Prevent duplicate account creation
        if (registeredUsers.containsKey(email)) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", "Email already registered"));
        }
        
        registeredUsers.put(email, password);

        // DEVELOPMENT: return a token.
        String token = "Bearer user:" + email;
        logger.info("Registered (dev) {}", email);
        return ResponseEntity.ok(Map.of("token", token));
    }
}
