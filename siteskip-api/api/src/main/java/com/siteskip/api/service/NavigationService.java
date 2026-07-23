package com.siteskip.api.service;

import com.siteskip.api.model.*;
import com.siteskip.api.repository.DomainLinkRepository;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NavigationService {

    private final ChatClient chatClient;
    private final DomainLinkRepository domainLinkRepository;

    public NavigationService(ChatClient.Builder chatClientBuilder, DomainLinkRepository domainLinkRepository) {
        this.chatClient = chatClientBuilder.build();
        this.domainLinkRepository = domainLinkRepository;
    }

    @Transactional
    public NavigationResponse resolveNavigation(NavigationRequest request) {
        System.out.println("\n[SiteSkip Hybrid RAG] Resolving intent for domain: " + request.getDomain());
        System.out.println("[SiteSkip Hybrid RAG] User Query: '" + request.getQuery() + "'");

        // 1. SILENT INGESTION: Save active page targets into persistent domain memory
        ingestLinksIntoDatabase(request.getDomain(), request.getLinks());

        // 2. RETRIEVAL LAYER 1: Current live DOM elements (immediate page context)
        String activePageContext = request.getLinks().stream()
                .map(l -> "- [Active Page] \"%s\" -> %s".formatted(l.getTitle(), l.getUrl()))
                .collect(Collectors.joining("\n"));

        // 3. RETRIEVAL LAYER 2: Historical domain memory from SQL database
        List<DomainLink> historicalLinks = domainLinkRepository.findTop75ByDomainOrderByLastSeenDesc(request.getDomain());
        String domainWideContext = historicalLinks.stream()
                .map(l -> "- [Domain Database] \"%s\" -> %s".formatted(l.getTitle(), l.getUrl()))
                .collect(Collectors.joining("\n"));

        // 4. AUGMENTED PROMPT: Provide both layers to Gemini via Spring AI
        String systemPrompt = """
                You are an enterprise Hybrid RAG navigation routing engine for the domain: %s.
                The user wants to navigate to or perform this action: "%s"
                
                We have retrieved two layers of structural web context:
                --- LAYER 1: ACTIVE PAGE TARGETS (Currently visible on screen) ---
                %s
                
                --- LAYER 2: DOMAIN-WIDE KNOWLEDGE BASE (Historical links from this website) ---
                %s
                
                TASK:
                Analyze the user's intent and determine the best single target URL or interactive action.
                - Prioritize Layer 1 if the user is trying to interact with a visible button or SPA modal.
                - Prioritize Layer 2 if the user is asking for a global site destination (e.g., password reset, pricing, settings) not visible on the active page.
                - Respond ONLY with the raw destination URL string or interactive-action:// URI.
                - Do NOT include markdown, quotes, explanations, or conversational text.
                - If no target in either layer is relevant, output ONLY the word: NONE
                """.formatted(request.getDomain(), request.getQuery(), activePageContext, domainWideContext);

        try {
            // 5. GENERATION: Execute Spring AI ChatClient
            String aiDecision = chatClient.prompt(systemPrompt)
                    .call()
                    .content()
                    .trim();

            System.out.println("[SiteSkip Hybrid RAG] Spring AI Decision -> " + aiDecision);

            if (!aiDecision.equalsIgnoreCase("NONE") && !aiDecision.isEmpty()) {
                return new NavigationResponse(aiDecision, 0.95);
            }
        } catch (Exception e) {
            System.err.println("[SiteSkip Hybrid RAG] AI API Communication Failure: " + e.getMessage());
            System.out.println("[SiteSkip Hybrid RAG] Reverting to local keyword fallback...");
        }

        return runFallbackKeywordMatch(request);
    }

    private void ingestLinksIntoDatabase(String domain, List<ScrapedLink> links) {
        for (ScrapedLink link : links) {
            if (link.getUrl().startsWith("http")) {
                domainLinkRepository.findByUrl(link.getUrl()).ifPresentOrElse(
                    existing -> {
                        existing.setLastSeen(LocalDateTime.now());
                        domainLinkRepository.save(existing);
                    },
                    () -> domainLinkRepository.save(new DomainLink(domain, link.getTitle(), link.getUrl()))
                );
            }
        }
    }

    private NavigationResponse runFallbackKeywordMatch(NavigationRequest request) {
        String queryLower = request.getQuery().toLowerCase().trim();
        for (ScrapedLink link : request.getLinks()) {
            if (link.getTitle().toLowerCase().contains(queryLower) || link.getUrl().toLowerCase().contains(queryLower)) {
                return new NavigationResponse(link.getUrl(), 0.60);
            }
        }
        return new NavigationResponse(null, 0.0);
    }
}