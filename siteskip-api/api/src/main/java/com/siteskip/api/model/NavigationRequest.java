package com.siteskip.api.model;

import lombok.Data;
import java.util.List;

@Data
public class NavigationRequest {
    private String domain;
    private String query;
    private List<ScrapedLink> links;
}