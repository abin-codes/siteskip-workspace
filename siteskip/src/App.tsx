import { useState, useEffect } from 'react';

interface ScrapedLink {
  id: string;
  title: string;
  url: string;
  isDestructive: boolean;
}

export default function App() {
  const [query, setQuery] = useState('');
  const [allLinks, setAllLinks] = useState<ScrapedLink[]>([]);
  const [filteredLinks, setFilteredLinks] = useState<ScrapedLink[]>([]);
  const [domain, setDomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('Scanning page...');
  
  // Security States
  const [isSensitivePage, setIsSensitivePage] = useState(false);
  const [pendingDestructiveAction, setPendingDestructiveAction] = useState<ScrapedLink | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id && activeTab.url && !activeTab.url.startsWith('chrome://')) {
        chrome.tabs.sendMessage(
          activeTab.id,
          { action: "GET_PAGE_LINKS" },
          (response) => {
            if (chrome.runtime.lastError) {
              setStatusMessage("Please refresh the page to wake up the scraper.");
              setLoading(false);
              return;
            }
            if (response) {
              setDomain(response.domain);
              if (response.isSensitive) {
                setIsSensitivePage(true);
                setLoading(false);
                return;
              }
              setAllLinks(response.links);
              setFilteredLinks(response.links);
            }
            setLoading(false);
          }
        );
      } else {
        setStatusMessage("SiteSkip cannot run on this page.");
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setFilteredLinks(allLinks);
      return;
    }
    const cleanQuery = query.toLowerCase().trim();
    const matches = allLinks.filter(link => 
      link.title.toLowerCase().includes(cleanQuery) ||
      link.url.toLowerCase().includes(cleanQuery)
    );
    setFilteredLinks(matches);
  }, [query, allLinks]);

  const scrollWebPage = (direction: 'top' | 'bottom') => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: (dir) => {
            window.scrollTo({
              top: dir === 'top' ? 0 : document.body.scrollHeight,
              behavior: 'smooth'
            });
          },
          args: [direction]
        });
      }
    });
  };

  const executeNavigation = (link: ScrapedLink) => {
    if (link.isDestructive) {
      setPendingDestructiveAction(link);
      return;
    }
    proceedWithPhysicalClick(link);
  };

  const proceedWithPhysicalClick = (link: ScrapedLink) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (activeTab?.id) {
        chrome.tabs.sendMessage(
          activeTab.id,
          { action: "CLICK_ELEMENT", elementId: link.id },
          (response) => {
            if (!response?.success && link.url.startsWith('http')) {
              chrome.tabs.update({ url: link.url });
            }
            window.close();
          }
        );
      }
    });
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      if (filteredLinks.length > 0) {
        const exactMatch = filteredLinks.find(l => l.title.toLowerCase() === query.toLowerCase().trim());
        executeNavigation(exactMatch || filteredLinks[0]);
        return;
      }

      setLoading(true);
      setStatusMessage('AI mapping intent...');
      
      try {
        const response = await fetch('http://siteskip-api.onrender.com/api/v1/navigate/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain, query, links: allLinks })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.targetUrl) {
            const matchedLink = allLinks.find(l => l.url === data.targetUrl) || 
                                allLinks.find(l => data.targetUrl.toLowerCase().includes(l.title.toLowerCase())) ||
                                allLinks[0];
            if (matchedLink) {
              executeNavigation(matchedLink);
              return;
            }
          }
        }
      } catch (err) {
        console.error("Backend offline fallback routing triggered.", err);
      } finally {
        setLoading(false);
      }
    }
  };

  // 1. RENDER SENSITIVE PAGE LOCK SCREEN (Stretched to match total viewport dimensions)
  if (isSensitivePage) {
    return (
      <div className="flex flex-col items-center justify-center w-[360px] h-[460px] bg-slate-900 text-white p-6 text-center antialiased">
        <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center text-2xl mb-4 border border-red-500/30">
          🔒
        </div>
        <h2 className="text-base font-bold tracking-tight text-white mb-2">Security Lock Active</h2>
        <p className="text-xs text-slate-300 mb-6 leading-relaxed px-2">
          SiteSkip automatically disables itself on authentication, password, and banking pages to protect your credentials.
        </p>
        <div className="text-[10px] bg-slate-800 text-slate-400 px-3 py-1.5 rounded border border-slate-700">
          Domain: {domain || 'Protected Page'}
        </div>
      </div>
    );
  }

  // 2. RENDER DESTRUCTIVE ACTION CONFIRMATION MODAL (Stretched to match total viewport dimensions)
  if (pendingDestructiveAction) {
    return (
      <div className="flex flex-col items-center justify-center w-[360px] h-[460px] bg-red-950 text-white p-6 text-center antialiased border-4 border-red-600">
        <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center text-xl mb-4 font-bold shadow-lg">
          ⚠️
        </div>
        <h2 className="text-base font-bold tracking-tight text-white mb-2">Destructive Action Warning</h2>
        <p className="text-xs text-red-200 mb-6 leading-relaxed px-2">
          You are about to click <span className="font-bold underline">"{pendingDestructiveAction.title}"</span>. This action may delete data, revoke access, or cancel a service immediately.
        </p>
        <div className="flex items-center gap-3 w-full px-4">
          <button
            onClick={() => setPendingDestructiveAction(null)}
            className="flex-1 py-2.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-600 cursor-pointer transition-all shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => proceedWithPhysicalClick(pendingDestructiveAction)}
            className="flex-1 py-2.5 rounded bg-red-600 hover:bg-red-500 text-xs font-bold text-white cursor-pointer transition-all shadow-md"
          >
            Yes, Execute
          </button>
        </div>
      </div>
    );
  }

  // 3. RENDER STANDARD NAVIGATION VIEW
  return (
    <div className="flex flex-col w-[360px] h-[460px] bg-slate-50 text-slate-800 antialiased p-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-indigo-600">SiteSkip</h1>
          <p className="text-xs text-slate-400 truncate max-w-[130px]">{domain || 'No active site'}</p>
        </div>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={() => scrollWebPage('top')}
            title="Scroll to Top"
            className="px-2 py-1 text-[11px] font-semibold rounded bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer text-slate-600 shadow-2xs transition-colors"
          >
            ↑ Top
          </button>
          <button 
            onClick={() => scrollWebPage('bottom')}
            title="Scroll to Bottom"
            className="px-2 py-1 text-[11px] font-semibold rounded bg-white border border-slate-200 hover:bg-slate-100 cursor-pointer text-slate-600 shadow-2xs transition-colors"
          >
            ↓ Bottom
          </button>
          <span className="text-[10px] bg-indigo-50 border border-indigo-200 text-indigo-600 font-semibold px-2 py-1 rounded-full ml-1">
            {filteredLinks.length} Targets
          </span>
        </div>
      </div>

      <div className="relative mb-3 shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Where do you want to go? (Type or Enter)"
          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
          autoFocus
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 text-sm text-slate-400 gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent"></div>
            <span>{statusMessage}</span>
          </div>
        ) : filteredLinks.length > 0 ? (
          filteredLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => executeNavigation(link)}
              className={`w-full text-left bg-white hover:bg-indigo-50/50 border rounded-lg p-2.5 transition-all duration-150 shadow-2xs cursor-pointer group flex items-center justify-between ${
                link.isDestructive ? 'border-red-200 hover:border-red-400 bg-red-50/20' : 'border-slate-200 hover:border-indigo-100'
              }`}
            >
              <div className="flex-1 min-w-0 pr-2">
                <p className={`text-sm font-medium truncate ${link.isDestructive ? 'text-red-600 group-hover:text-red-700 font-semibold' : 'text-slate-700 group-hover:text-indigo-600'}`}>
                  {link.title} {link.isDestructive && '⚠️'}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {link.url.startsWith('http') ? link.url.replace(/^https?:\/\/(www\.)?/, '') : 'Interactive Element Trigger'}
                </p>
              </div>
              <span className={`text-sm font-bold ${link.isDestructive ? 'text-red-400 group-hover:text-red-600' : 'text-slate-300 group-hover:text-indigo-500'}`}>→</span>
            </button>
          ))
        ) : (
          <div className="text-center py-8 text-sm text-slate-400">
            No matching targets found.
          </div>
        )}
      </div>
    </div>
  );
}