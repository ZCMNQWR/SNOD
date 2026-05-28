import { useState, useEffect, useRef, useCallback, useMemo, type RefObject } from 'react';
import axios from 'axios';
import { Document, Page, pdfjs } from 'react-pdf';
import { getFileStreamUrl } from '../services/api';
import type { AvailableFile } from '../services/api';
import type { NotesByPage, HighlightEntry } from '../types/notes';

// Initialize the PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface PdfViewerProps {
  file: AvailableFile;
  currentPage: number;
  zoom: number;
  onTotalPagesChange: (total: number) => void;
  viewMode: 'single' | 'scroll';
  onCurrentPageChange: (page: number) => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  pageChangeSourceRef: RefObject<'manual' | 'scroll' | null>;
  highlightsByPage?: NotesByPage;
  selectedHighlightId?: string | null;
  onSelectHighlight?: (id: string | null) => void;
}

export function PdfViewer({ 
  file, 
  currentPage, 
  zoom, 
  onTotalPagesChange, 
  viewMode, 
  onCurrentPageChange, 
  scrollContainerRef, 
  pageChangeSourceRef,
  highlightsByPage,
  selectedHighlightId,
  onSelectHighlight
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(1);
  const [textRenderVersion, setTextRenderVersion] = useState(0);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleTextLayerRendered = useCallback(() => {
    setTextRenderVersion(v => v + 1);
  }, []);
  const highlightDependency = JSON.stringify(
    Object.entries(highlightsByPage || {}).map(([, data]) => {
      return data.highlights.map((h: HighlightEntry) => `${h.id}:${h.occurrenceIndex}`);
    })
  );

  const highlightsRef = useRef(highlightsByPage);
  useEffect(() => {
    highlightsRef.current = highlightsByPage;
  }, [highlightsByPage]);

  // 2. HIGHLIGHT ENGINE
  useEffect(() => {
    if (textRenderVersion === 0) return;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageElement = document.getElementById(`pdf-page-${pageNum}`);
      if (!pageElement) continue;

      const pageHighlights = highlightsRef.current?.[pageNum]?.highlights;

      const existingMarks = pageElement.querySelectorAll('mark[data-highlight-id]');
      existingMarks.forEach((mark) => {
        const textNode = document.createTextNode(mark.textContent || '');
        mark.parentNode?.replaceChild(textNode, mark);
      });
      pageElement.normalize();

      if (!pageHighlights || pageHighlights.length === 0) continue;

      const textLayer = pageElement.querySelector('.react-pdf__Page__textContent');
      if (!textLayer) continue;

      let strippedDoc = "";
      const textNodes: { node: Text, start: number, end: number, originalText: string }[] = [];

      const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT, null);
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

      matches.sort((a, b) => b.start - a.start);

      matches.forEach(match => {
        const overlappingNodes = textNodes.filter(n => n.start < match.end && n.end > match.start);

        overlappingNodes.reverse().forEach(n => {
          const strippedStartInNode = Math.max(0, match.start - n.start);
          const strippedEndInNode = Math.min(n.end - n.start, match.end - n.start);

          let charCount = 0;
          let originalStart = -1;
          let originalEnd = -1;

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
    }
  }, [textRenderVersion, highlightDependency, selectedHighlightId, numPages]);

  // 3. Click Listener for the highlights
  useEffect(() => {
    const container = scrollContainerRef.current;
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
  }, [onSelectHighlight, scrollContainerRef]);

  // 4. Scroll visibility observers (Manual scroll syncing)
  useEffect(() => {
    if (viewMode === 'scroll') {
      if (pageChangeSourceRef.current !== 'manual') return;

      const element = document.getElementById(`pdf-page-${currentPage}`);
      if (element) {
        const doScroll = () => {
          const container = scrollContainerRef.current;
          if (container) {
            const elRect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            container.scrollTo({ top: container.scrollTop + (elRect.top - containerRect.top), behavior: 'auto' });
          } else {
            element.scrollIntoView({ behavior: 'auto', block: 'start' });
          }
        };

        doScroll();
        const reScrollTimer = setTimeout(doScroll, 150);

        const unlockTimer = setTimeout(() => {
          if (pageChangeSourceRef.current === 'manual') {
            pageChangeSourceRef.current = null;
          }
        }, 800); 

        return () => {
          clearTimeout(reScrollTimer);
          clearTimeout(unlockTimer);
        };
      }
    }
  }, [currentPage, pageChangeSourceRef, viewMode, numPages]);

  // 5. Scroll tracking observer (Update current page on natural scroll)
  useEffect(() => {
    if (viewMode !== 'scroll' || numPages <= 0) return;

    const container = scrollContainerRef.current;
    if (!container) return;

    let animationFrameId = 0;

    const updateCurrentPageFromScroll = () => {
      if (pageChangeSourceRef?.current === 'manual') return;

      const containerRect = container.getBoundingClientRect();
      const topThreshold = containerRect.top + containerRect.height * 0.5;
      let pageAtTop = 1;

      for (let pageNum = 1; pageNum <= numPages; pageNum += 1) {
        const element = document.getElementById(`pdf-page-${pageNum}`);
        if (!element) continue;

        const rect = element.getBoundingClientRect();
        if (rect.top <= topThreshold) {
          pageAtTop = pageNum;
        }
      }

      const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceToBottom < 150 && numPages > 0) {
        pageAtTop = numPages;
      }

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
  }, [currentPage, numPages, onCurrentPageChange, scrollContainerRef, viewMode, pageChangeSourceRef]);

  const baseWidth = isMobile ? Math.min(window.innerWidth - 32, 600) : 600;
  const pageWidth = Math.max(200, baseWidth * zoom / 100);
  const estimatedPageHeight = pageWidth * 1.3; // Standard 8.5x11 aspect ratio

  // Memoize the options object so it doesn't recreate every render and trigger unnecessary reloads
  const token = localStorage.getItem('OAUTH_TOKEN') || '';
  const options = useMemo(() => {
    if (!token) return { httpHeaders: {} };
    const auth = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    return { httpHeaders: { Authorization: auth } };
  }, [token]);

  // Fetch the PDF as an authenticated ArrayBuffer and create a blob URL for react-pdf to consume
  useEffect(() => {
    let cancelled = false;
    let currentBlobUrl: string | null = null;

    const fetchPdf = async () => {
      setLoadError(null);
      try {
        const url = getFileStreamUrl(file.id);
        const res = await axios.get(url, { responseType: 'arraybuffer' });
        if (cancelled) return;
        const blob = new Blob([res.data], { type: 'application/pdf' });
        currentBlobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(currentBlobUrl);
      } catch (err: unknown) {
        if (!cancelled) {
          setLoadError(axios.isAxiosError(err) && err.response?.status === 403 ? 'forbidden' : 'failed');
          setPdfBlobUrl(null);
        }
      }
    };

    fetchPdf();

    return () => {
      cancelled = true;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
      setPdfBlobUrl(null);
    };
  }, [file.id]);

  return (
    <div style={{ display: 'flex', justifyContent: viewMode === 'scroll' ? 'flex-start' : 'center', minHeight: '100%', flexDirection: 'column', alignItems: isMobile ? 'flex-start' : 'center', width: '100%', overflowX: 'auto' }}>
      <style>{`
        /* Prevent canvas from squishing in flex containers, ensuring text layer stays perfectly aligned */
        .react-pdf__Page__canvas { max-width: none !important; }
      `}</style>
      <Document
        file={pdfBlobUrl || getFileStreamUrl(file.id)}
        options={options}
        onLoadSuccess={({ numPages: loadedNumPages }) => {
          setNumPages(loadedNumPages);
          onTotalPagesChange(loadedNumPages);
        }}
        loading={<div style={{ padding: '20px' }}>Loading PDF...</div>}
        error={<div style={{ padding: '20px' }}>{loadError === 'forbidden' ? 'Forbidden: check your auth token' : 'Failed to load PDF.'}</div>}
      >
        {viewMode === 'scroll' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: isMobile ? '10px' : '20px' }}>
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <div 
                key={pageNum} 
                id={`pdf-page-${pageNum}`} 
                style={{ 
                  marginBottom: '20px', 
                  minHeight: `${estimatedPageHeight}px`, 
                  width: `${pageWidth}px` 
                }}
              >
                <div style={{ fontSize: '12px', color: '#999', marginBottom: '10px', fontWeight: 'bold' }}>--- Page {pageNum} ---</div>
                <Page 
                  pageNumber={pageNum} 
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  width={pageWidth}
                  onRenderTextLayerSuccess={handleTextLayerRendered} 
                />
              </div>
            ))}
          </div>
        ) : (
          <div id={`pdf-page-${currentPage}`}>
            <Page 
              pageNumber={currentPage} 
              renderTextLayer={true}
              renderAnnotationLayer={true}
              width={pageWidth}
              onRenderTextLayerSuccess={handleTextLayerRendered} 
            />
          </div>
        )}
      </Document>
    </div>
  );
}
