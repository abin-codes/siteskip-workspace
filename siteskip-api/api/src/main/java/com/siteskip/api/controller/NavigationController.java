package com.siteskip.api.controller;

import com.siteskip.api.model.NavigationRequest;
import com.siteskip.api.model.NavigationResponse;
import com.siteskip.api.service.NavigationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/navigate")
@CrossOrigin(originPatterns = "*") // Allows the Chrome Extension to talk to Spring Boot securely
public class NavigationController {

    private final NavigationService navigationService;

    public NavigationController(NavigationService navigationService) {
        this.navigationService = navigationService;
    }

    @PostMapping("/resolve")
    public ResponseEntity<NavigationResponse> resolve(@RequestBody NavigationRequest request) {
        // Updated to call resolveNavigation() matching our new Spring AI service
        NavigationResponse response = navigationService.resolveNavigation(request);
        return ResponseEntity.ok(response);
    }
}