import { useEffect, useRef, useState, type RefObject } from 'react';
import { renderAsync } from 'docx-preview';
import { getFileStreamUrl } from '../services/api';
import type { AvailableFile } from '../services/api';
import type { NotesByPage, HighlightEntry } from '../types/notes'; // Added this import

interface DocxViewerProps {
  file: AvailableFile;
  currentPage: number;
  zoom: number;
  onTotalPagesChange: (total: number) => void;
  onStatusChange: (status: string) => void;
  viewMode: 'single' | 'scroll';
  onCurrentPageChange: (page: number) => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  pageChangeSourceRef: RefObject<'manual' | 'scroll' | null>;
  // Added the highlight props
  highlightsByPage?: NotesByPage;
  selectedHighlightId?: string | null;
  onSelectHighlight?: (id: string | null) => void;
}

export function DocxViewer({ 
  file, 
  currentPage, 
  zoom, 
  onTotalPagesChange, 
  onStatusChange, 
  viewMode, 
  onCurrentPageChange, 
  scrollContainerRef, 
  pageChangeSourceRef,
  highlightsByPage,
  selectedHighlightId,
  onSelectHighlight
}: DocxViewerProps) {
  const docxContainerRef = useRef<HTMLDivElement | null>(null);
  const [renderVersion, setRenderVersion] = useState(0);

  // 1. Create a signature that ONLY changes when highlights are added/removed, NOT when notes are typed.
  const highlightDependency = JSON.stringify(
    Object.entries(highlightsByPage || {}).map(([, data]) => {
      return data.highlights.map((h: HighlightEntry) => `${h.id}:${h.occurrenceIndex}`);
    })
  );

  // 2. Keep a silent reference to the latest data so we can read it without triggering a re-render
  const highlightsRef = useRef(highlightsByPage);
  useEffect(() => {
    highlightsRef.current = highlightsByPage;
  }, [highlightsByPage]);

  useEffect(() => {
    async function loadAndCompileDocx() {
      try {
        onStatusChange('Parsing physical Word page breaks...');
        const response = await fetch(getFileStreamUrl(file.id));
        const blob = await response.blob();
        
        if (docxContainerRef.current) {
          docxContainerRef.current.innerHTML = '';
          
          await renderAsync(blob, docxContainerRef.current, docxContainerRef.current, {
            className: "docx-view",
            inWrapper: false,
            ignoreWidth: false,
            ignoreHeight: false,
            experimental: true
          });

          const physicalPages = docxContainerRef.current.querySelectorAll('.docx-viewer > section, section');
          onTotalPagesChange(physicalPages.length || 1);
          setRenderVersion((value) => value + 1);
          onStatusChange('Word document rendered continuously.');
        }
      } catch (err) {
        onStatusChange('Failed to compile DOCX page breaks.');
        console.error(err);
      }
    }
    loadAndCompileDocx();
  }, [file, onStatusChange, onTotalPagesChange]);

  // 1. Highlight Engine: Multi-line & Whitespace Agnostic
  useEffect(() => {
    if (!docxContainerRef.current || renderVersion === 0) return;
    const container = docxContainerRef.current;

    // A. Clean up old highlights
    const existingMarks = container.querySelectorAll('mark[data-highlight-id]');
    existingMarks.forEach((mark) => {
      const textNode = document.createTextNode(mark.textContent || '');
      mark.parentNode?.replaceChild(textNode, mark);
    });
    container.normalize();

    // B. Apply current highlights
    const pages = container.querySelectorAll('.docx-viewer > section, section');
    pages.forEach((pageElement, index) => {
      const pageNum = index + 1;
      const pageHighlights = highlightsRef.current?.[pageNum]?.highlights;
      if (!pageHighlights || pageHighlights.length === 0) return;

      // 1. Build a fully stripped string and map each text node to its stripped coordinates
      let strippedDoc = "";
      const textNodes: { node: Text, start: number, end: number, originalText: string }[] = [];

      const walker = document.createTreeWalker(pageElement, NodeFilter.SHOW_TEXT, null);
      let n;
      while ((n = walker.nextNode())) {
        const originalText = n.nodeValue || "";
        const strippedText = originalText.replace(/\s+/g, '');

        textNodes.push({
          node: n as Text,
          start: strippedDoc.length,
          end: strippedDoc.length + strippedText.length,
          originalText
        });
        strippedDoc += strippedText;
      }

      // 2. Map highlights to stripped coordinates
      const matches: { start: number, end: number, highlight: HighlightEntry }[] = [];
      pageHighlights.forEach(highlight => {
        const strippedHighlight = highlight.text.replace(/\s+/g, '');
        if(!strippedHighlight) return;

        let pos = -1;
        for (let i = 0; i <= highlight.occurrenceIndex; i++) {
          pos = strippedDoc.toLowerCase().indexOf(strippedHighlight.toLowerCase(), pos + 1);
          if (pos === -1) break;
        }
        if (pos !== -1) {
          matches.push({ start: pos, end: pos + strippedHighlight.length, highlight });
        }
      });

      // 3. Sort back-to-front (crucial so DOM splits don't shift our coordinates)
      matches.sort((a, b) => b.start - a.start);

      // 4. Apply marks safely across newlines, spaces, and formatting tags
      matches.forEach(match => {
        const overlappingNodes = textNodes.filter(n => n.start < match.end && n.end > match.start);

        overlappingNodes.reverse().forEach(n => {
          const strippedStartInNode = Math.max(0, match.start - n.start);
          const strippedEndInNode = Math.min(n.end - n.start, match.end - n.start);

          let charCount = 0;
          let originalStart = -1;
          let originalEnd = -1;

          // Convert stripped coordinates back into the original whitespace-filled string
          for (let i = 0; i < n.originalText.length; i++) {
            if (!/\s/.test(n.originalText[i])) {
              if (charCount === strippedStartInNode) originalStart = i;
              charCount++;
              if (charCount === strippedEndInNode) {
                originalEnd = i + 1;
                break;
              }
            }
          }
          if (originalStart !== -1 && originalEnd === -1) originalEnd = n.originalText.length;
          if (originalStart === -1 || originalStart >= originalEnd) return;

          const text = n.node.nodeValue!;
          const before = text.substring(0, originalStart);
          const highlightText = text.substring(originalStart, originalEnd);
          const after = text.substring(originalEnd);

          const isSelected = match.highlight.id === selectedHighlightId;
          // Slightly milder orange for selected highlights
          const bgColor = isSelected ? 'rgba(255, 165, 0, 0.85)' : 'rgba(253, 224, 71, 0.4)';

          const mark = document.createElement('mark');
          mark.setAttribute('data-highlight-id', match.highlight.id);
          mark.style.backgroundColor = bgColor;
          mark.style.cursor = 'pointer';
          mark.style.color = 'inherit';
          mark.style.borderRadius = '2px';
          mark.textContent = highlightText;

          const frag = document.createDocumentFragment();
          if (before) frag.appendChild(document.createTextNode(before));
          frag.appendChild(mark);
          if (after) frag.appendChild(document.createTextNode(after));

          n.node.parentNode?.replaceChild(frag, n.node);
        });
      });
    });
  }, [renderVersion, highlightDependency, selectedHighlightId]);

  // 2. Click Listener: Catch clicks on injected <mark> tags
  useEffect(() => {
    const container = docxContainerRef.current;
    if (!container) return;

    const handleHighlightClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const mark = target.closest('mark[data-highlight-id]');
      if (mark) {
        const id = mark.getAttribute('data-highlight-id');
        if (id && onSelectHighlight) {
          e.stopPropagation();
          onSelectHighlight(id);
        }
      }
    };

    container.addEventListener('click', handleHighlightClick);
    return () => container.removeEventListener('click', handleHighlightClick);
  }, [onSelectHighlight]);


  // Update visibility of DOCX pages when currentPage shifts or viewMode changes
  useEffect(() => {
    if (!docxContainerRef.current) return;

    const pages = docxContainerRef.current.querySelectorAll('.docx-viewer > section, section');
    
    if (viewMode === 'scroll') {
      const total = pages.length;
      pages.forEach((pageElement, index) => {
        const htmlPage = pageElement as HTMLElement;
        htmlPage.id = `docx-page-${index + 1}`;
        htmlPage.style.display = 'block';
        htmlPage.style.width = '100%';
        htmlPage.style.maxWidth = '900px';
        // Only add bottom margin between pages; remove bottom margin for the final page
        if (total === 1) {
          htmlPage.style.margin = '0 auto 0';
        } else if (index === 0) {
          htmlPage.style.margin = '0 auto 20px';
        } else if (index === total - 1) {
          htmlPage.style.margin = '20px auto 0';
        } else {
          htmlPage.style.margin = '20px auto';
        }
        htmlPage.style.padding = '28px 32px';
        htmlPage.style.boxSizing = 'border-box';
        htmlPage.style.boxShadow = '0 16px 40px rgba(0,0,0,0.14)';
        htmlPage.style.backgroundColor = '#ffffff';
        htmlPage.style.border = '1px solid rgba(0,0,0,0.08)';
        htmlPage.style.borderRadius = '12px';
        htmlPage.style.overflow = 'hidden';

        let indicator = htmlPage.previousElementSibling as HTMLElement;
        if (!indicator || !indicator.classList.contains('docx-page-indicator')) {
          indicator = document.createElement('div');
          indicator.className = 'docx-page-indicator';
          indicator.style.fontSize = '12px';
          indicator.style.color = '#999';
          indicator.style.marginBottom = '10px';
          indicator.style.marginTop = index > 0 ? '20px' : '0px';
          indicator.style.fontWeight = 'bold';
          indicator.style.textAlign = 'center';
          indicator.innerText = `--- Page ${index + 1} ---`;
          htmlPage.parentNode?.insertBefore(indicator, htmlPage);
        }
        indicator.style.display = 'block';
      });
    } else {
      pages.forEach((pageElement, index) => {
        const htmlPage = pageElement as HTMLElement;
        htmlPage.id = `docx-page-${index + 1}`;

        const indicator = htmlPage.previousElementSibling as HTMLElement;
        if (indicator && indicator.classList.contains('docx-page-indicator')) {
          indicator.style.display = 'none';
        }

        if (index === currentPage - 1) {
          htmlPage.style.display = 'block';
          htmlPage.style.width = '100%';
          htmlPage.style.maxWidth = '900px';
          htmlPage.style.margin = '0 auto';
          htmlPage.style.padding = '28px 32px';
          htmlPage.style.boxSizing = 'border-box';
          htmlPage.style.boxShadow = '0 16px 40px rgba(0,0,0,0.14)';
          htmlPage.style.backgroundColor = '#ffffff';
          htmlPage.style.border = '1px solid rgba(0,0,0,0.08)';
          htmlPage.style.borderRadius = '12px';
          htmlPage.style.overflow = 'hidden';
        } else {
          htmlPage.style.display = 'none';
        }
      });
    }
  }, [currentPage, file, viewMode, renderVersion]); // Note: added renderVersion here so it runs after parse

  // Scroll to page when currentPage changes in scroll mode
  useEffect(() => {
    if (viewMode !== 'scroll' || pageChangeSourceRef.current !== 'manual') {
      return;
    }

    const element = document.getElementById(`docx-page-${currentPage}`);
    if (element) {
      // The page exists! Scroll to it.
      element.scrollIntoView({ behavior: 'auto', block: 'start' });
      
      const timer = setTimeout(() => {
        if (pageChangeSourceRef.current === 'manual') {
          pageChangeSourceRef.current = null;
        }
      }, 150);
      return () => clearTimeout(timer);
    }
    // If the element doesn't exist, we DO NOT clear the lock.
    // The effect will re-run automatically when renderVersion updates.
  }, [currentPage, pageChangeSourceRef, viewMode, renderVersion]); // <-- Added renderVersion here

  // Scroll observer
  useEffect(() => {
    if (viewMode !== 'scroll' || currentPage < 1) {
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) {
      return;
    }

    const pages = docxContainerRef.current?.querySelectorAll('.docx-viewer > section, section');
    if (!pages || pages.length === 0) {
      return;
    }

    let animationFrameId = 0;

    const updateCurrentPageFromScroll = () => {
      if (pageChangeSourceRef?.current === 'manual') {
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const topThreshold = containerRect.top + containerRect.height * 0.4;
      let pageAtTop = 1;

      pages.forEach((pageElement, index) => {
        const element = pageElement as HTMLElement;
        const rect = element.getBoundingClientRect();
        if (rect.top <= topThreshold) {
          pageAtTop = index + 1;
        }
      });

      if (pageAtTop !== currentPage) {
        onCurrentPageChange(pageAtTop);
      }
    };

    const handleScroll = () => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(updateCurrentPageFromScroll);
    }

    updateCurrentPageFromScroll();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [currentPage, onCurrentPageChange, renderVersion, scrollContainerRef, viewMode, pageChangeSourceRef]);

  return (
    <div 
      ref={docxContainerRef} 
      style={{ 
        display: 'block', 
        padding: '10px',
        backgroundColor: '#ffffff',
        transform: `scale(${zoom / 100})`,
        transformOrigin: 'top center',
        transition: 'transform 0.2s ease'
      }}
      className="docx-view-single"
    />
  );
}