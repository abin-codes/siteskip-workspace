package com.siteskip.api.model;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class NavigationResponse {
    private String targetUrl;
    private double confidence;
}