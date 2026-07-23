console.log("[SiteSkip] Universal Scraper injected and listening for requests.");

/**
 * Checks if an element belongs to a third-party Chrome Extension
 */
function isExtensionContaminated(el) {
  const badKeywords = ['merlin', 'grammarly', 'languagetool', 'quillbot', 'chrome-extension'];
  let current = el;
  while (current && current !== document.body) {
    const id = (current.id || '').toLowerCase();
    const className = (typeof current.className === 'string' ? current.className : '').toLowerCase();
    const tagName = (current.tagName || '').toLowerCase();

    if (
      badKeywords.some(kw => id.includes(kw) || className.includes(kw) || tagName.includes(kw)) ||
      current.hasAttribute('data-merlin') ||
      current.hasAttribute('data-extension')
    ) {
      return true;
    }
    current = current.parentElement || current.host;
  }
  return false;
}

/**
 * Prevents form dropdown options from being mistaken for navigation links.
 */
function isFormOptionOrDropdown(el) {
  const role = (el.getAttribute('role') || '').toLowerCase();
  if (['option', 'menuitemcheckbox', 'menuitemradio', 'treeitem', 'tab'].includes(role)) return true;

  let current = el;
  while (current && current !== document.body) {
    const parentRole = (current.getAttribute('role') || '').toLowerCase();
    const tagName = (current.tagName || '').toLowerCase();
    const className = (typeof current.className === 'string' ? current.className : '').toLowerCase();

    if (
      tagName === 'select' || tagName === 'datalist' || tagName === 'optgroup' ||
      parentRole === 'listbox' || parentRole === 'combobox' ||
      className.includes('select-menu') || className.includes('dropdown-menu') || className.includes('autocomplete')
    ) {
      return true;
    }
    current = current.parentElement || current.host;
  }
  return false;
}

/**
 * AUTOMATIC SECURITY HEURISTIC: Detects Login, Signup, Banking, and Password pages
 */
function isSensitiveSecurityPage() {
  const url = window.location.href.toLowerCase();
  const sensitiveKeywords = ['/login', '/signin', '/signup', '/register', '/checkout', '/billing', '/payment', '/password', '/reset', '/bank', '/oauth', '/auth'];
  
  // 1. Check if URL contains auth/banking pathways
  if (sensitiveKeywords.some(kw => url.includes(kw))) {
    return true;
  }

  // 2. Check if DOM contains a password field or credit card input
  const hasPasswordField = document.querySelector('input[type="password"]');
  const hasCreditCardField = document.querySelector('input[autocomplete*="cc-"], input[name*="cardnumber"], input[name*="cvv"]');
  
  if (hasPasswordField || hasCreditCardField) {
    return true;
  }

  return false;
}

/**
 * SAFETY HEURISTIC: Checks if button text indicates a dangerous, irreversible action
 */
function isDestructiveVerb(text) {
  const dangerousVerbs = ['delete', 'remove', 'destroy', 'revoke', 'cancel subscription', 'deactivate', 'drop', 'terminate', 'pay', 'transfer', 'disconnect'];
  const lower = text.toLowerCase();
  return dangerousVerbs.some(verb => lower.includes(verb));
}

/**
 * PRIVACY HEURISTIC: Strips sensitive URL query parameters (tokens, session IDs)
 */
function sanitizeUrl(rawUrl) {
  if (!rawUrl || rawUrl.startsWith('interactive-action://')) return rawUrl;
  try {
    const urlObj = new URL(rawUrl);
    const sensitiveParams = ['token', 'auth', 'session', 'key', 'password', 'email', 'id', 'access_token'];
    
    sensitiveParams.forEach(param => {
      if (urlObj.searchParams.has(param)) {
        urlObj.searchParams.delete(param);
      }
    });
    
    return urlObj.toString();
  } catch (e) {
    return rawUrl;
  }
}

function collectUniversalElements(root = document.body) {
  let elements = [];
  if (!root) return elements;

  const selector = 'a, button, input[type="submit"], input[type="button"], [role="link"], [role="button"]';
  try {
    const found = root.querySelectorAll(selector);
    elements = elements.concat(Array.from(found));
  } catch (e) {}

  try {
    const allNodes = root.querySelectorAll('*');
    allNodes.forEach((node) => {
      if (node.shadowRoot && !isExtensionContaminated(node)) {
        elements = elements.concat(collectUniversalElements(node.shadowRoot));
      }
    });
  } catch (e) {}

  return elements;
}

function scrapeNavigationLinks() {
  const links = [];
  const seenTitles = new Set();
  const elements = collectUniversalElements(document.body);

  elements.forEach((el, index) => {
    if (isExtensionContaminated(el) || isFormOptionOrDropdown(el)) return;

    const rawText = el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.value || '';
    let cleanText = rawText.trim().replace(/\s+/g, ' ');
    const lowerText = cleanText.toLowerCase();

    if (
      !cleanText || cleanText.length < 2 || cleanText.length > 60 || 
      cleanText.startsWith('{') || cleanText.startsWith('[') ||
      lowerText.includes('skip to') || lowerText.includes('skip navigation') ||
      (el.getAttribute('href') || '').startsWith('#')
    ) {
      return;
    }

    let url = el.href || el.getAttribute('data-url') || el.getAttribute('data-href') || '';
    if (!url && (el.tagName === 'BUTTON' || el.tagName === 'INPUT')) {
      const parentForm = el.closest('form');
      if (parentForm && parentForm.action) url = parentForm.action;
    }
    
    if (url && !url.startsWith('http') && !url.startsWith('interactive-action')) {
      try {
        url = new URL(url, window.location.href).href;
      } catch(e) {}
    }

    if (!url) url = `interactive-action://${cleanText.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    // Clean sensitive params from standard web URLs
    const safeUrl = sanitizeUrl(url);

    const trackingId = `siteskip-target-${index}`;
    el.setAttribute('data-siteskip-id', trackingId);

    if (!safeUrl.startsWith('javascript:') && !safeUrl.startsWith('mailto:') && !seenTitles.has(lowerText)) {
      seenTitles.add(lowerText);
      links.push({
        id: trackingId,
        title: cleanText,
        url: safeUrl,
        isDestructive: isDestructiveVerb(cleanText)
      });
    }
  });

  return links;
}

function triggerDOMClick(trackingId) {
  const targetElement = document.querySelector(`[data-siteskip-id="${trackingId}"]`);
  if (targetElement) {
    console.log(`[SiteSkip] Triggering physical click on:`, targetElement);
    ['mousedown', 'mouseup', 'click'].forEach(eventType => {
      targetElement.dispatchEvent(new MouseEvent(eventType, {
        view: window, bubbles: true, cancelable: true, buttons: 1
      }));
    });
    return true;
  }
  return false;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GET_PAGE_LINKS") {
    if (isSensitiveSecurityPage()) {
      console.log("[SiteSkip Security] Sensitive auth/banking page detected. Locking scraper.");
      sendResponse({ domain: window.location.hostname, isSensitive: true, links: [] });
      return true;
    }

    const scrapedData = scrapeNavigationLinks();
    
    if (window !== window.top) {
      const host = window.location.hostname.toLowerCase();
      if (scrapedData.length === 0 || host.includes('captcha') || host.includes('doubleclick') || host.includes('stripe')) {
        return false;
      }
    }

    sendResponse({ domain: window.location.hostname, isSensitive: false, links: scrapedData });
  } 
  else if (request.action === "CLICK_ELEMENT") {
    const success = triggerDOMClick(request.elementId);
    sendResponse({ success: success });
  }
  return true;
});