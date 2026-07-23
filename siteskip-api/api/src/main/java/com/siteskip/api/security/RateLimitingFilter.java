package com.siteskip.api.security;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class RateLimitingFilter extends OncePerRequestFilter {

    // In-memory cache to store buckets per IP address
    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) 
            throws ServletException, IOException {
        
        String clientIp = request.getRemoteAddr();
        Bucket bucket = buckets.computeIfAbsent(clientIp, this::createNewBucket);

        // Try to consume 1 token. If successful, allow the request to pass to the Controller.
        if (bucket.tryConsume(1)) {
            filterChain.doFilter(request, response);
        } else {
            // If the bucket is empty (user exceeded 15 req/min), reject with HTTP 429.
            response.setStatus(429);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\": \"Too many requests. Please try again in a minute.\"}");
        }
    }

    private Bucket createNewBucket(String clientIp) {
        // Limit to 15 requests per minute per IP using modern Bucket4j 8.x syntax
        Bandwidth limit = Bandwidth.builder()
                .capacity(15)
                .refillGreedy(15, Duration.ofMinutes(1))
                .build();
                
        return Bucket.builder().addLimit(limit).build();
    }
}