import { useState, useEffect, useRef, useCallback, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { saveProgress, getProgress, getAvailableFiles } from './services/api';
import type { DocumentProgress, AvailableFile } from './services/api';
import { TxtViewer } from './components/TxtViewer';
import { PdfViewer } from './components/PdfViewer';
import { DocxViewer } from './components/DocxViewer';
import LibraryPanel from './components/LibraryPanel';
import InfoModal from './components/InfoModal';
import NotesSidebar from './components/NotesSidebar';
import SignInButton from './components/SignInButton';
import type { HighlightEntry, NotesByPage, PageNoteEntry } from './types/notes';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

function App() {
  const [userId] = useState<string>('steve123');
  const [isFullPage, setIsFullPage] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('scroll');
  const [zoom, setZoom] = useState<number>(100);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [menuHover, setMenuHover] = useState<'notes' | 'info' | null>(null);
  const [notesOpen, setNotesOpen] = useState<boolean>(false);
  const [notesPanelWidth, setNotesPanelWidth] = useState<number>(340);
  
  const [library, setLibrary] = useState<AvailableFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<AvailableFile | null>(null);
  const [libraryOpen, setLibraryOpen] = useState<boolean>(false);
  const [infoOpen, setInfoOpen] = useState<boolean>(false);

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>('1');
  const [totalPages, setTotalPages] = useState<number>(1);
  const [notesByPage, setNotesByPage] = useState<NotesByPage>({});
  const [syncStatus, setSyncStatus] = useState<string>('Connecting...');
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  
  const shellRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pageChangeSourceRef = useRef<'manual' | 'scroll' | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const isDocumentHydratingRef = useRef<boolean>(false);
  const pendingLoadedPageRef = useRef<number | null>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullPage(document.fullscreenElement === shellRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Load Dynamic Storage Library
  const refreshLibrary = async (selectFirstIfNeeded = false): Promise<AvailableFile[]> => {
    const files = await getAvailableFiles();
    const defaultEpoch = new Date('2026-05-23T00:00:00Z').getTime();
    const normalized = files.map(f => ({
      ...f,
      lastModifiedEpoch: f.lastModifiedEpoch || defaultEpoch,
      lastModified: f.lastModified || new Date(f.lastModifiedEpoch || defaultEpoch).toISOString(),
      addedEpoch: f.addedEpoch || defaultEpoch,
    }));
    normalized.sort((a, b) => (b.addedEpoch || b.lastModifiedEpoch || 0) - (a.addedEpoch || a.lastModifiedEpoch || 0));
    setLibrary(normalized);
    if (selectFirstIfNeeded && normalized.length > 0) {
      isDocumentHydratingRef.current = true;
      setSelectedFile(normalized[0]);
    }

    return normalized;
  };

  const handleRemoveFileFromLibrary = async (file: AvailableFile): Promise<boolean> => {
    const wasSelected = selectedFile?.id === file.id;

    if (wasSelected) {
      setSelectedFile(null);
      setCurrentPage(1);
      setPageInput('1');
      setTotalPages(1);
      setNotesByPage({});
      setSelectedHighlightId(null);
    }

    const refreshed = await refreshLibrary(wasSelected);

    if (wasSelected) {
      if (refreshed.length > 0) {
        isDocumentHydratingRef.current = true;
        setSelectedFile(refreshed[0]);
      }

      setCurrentPage(1);
      setPageInput('1');
      setTotalPages(1);
      setNotesByPage({});
      setSelectedHighlightId(null);
      setLibraryOpen(false);
    }

    return !refreshed.some((entry) => entry.id === file.id);
  };

  useEffect(() => {
    void Promise.resolve().then(() => refreshLibrary(true));
  }, []);


  useEffect(() => {
    void Promise.resolve().then(() => setPageInput(String(currentPage)));
  }, [currentPage, selectedFile]);

  useEffect(() => {
    if (!selectedFile?.id) {
      return;
    }

    if (isDocumentHydratingRef.current) {
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      void saveProgress({
        userId,
        documentId: selectedFile.id,
        documentType: selectedFile.type,
        currentPage,
        syncDataJson: JSON.stringify({ notesByPage })
      }).then(() => {
        setSyncStatus(`Auto-saved on Page ${currentPage}.`);
      }).catch(() => {
        setSyncStatus('Auto-save failed.');
      });
    }, 600);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [currentPage, notesByPage, selectedFile?.id, selectedFile?.type, userId]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuOpen) {
        return;
      }

      const target = event.target as Node | null;
      if (target && menuRef.current?.contains(target)) {
        return;
      }

      setMenuOpen(false);
      setMenuHover(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [menuOpen]);

  const setCurrentPageFromManualAction = (page: number) => {
    pageChangeSourceRef.current = 'manual';
    setCurrentPage(page);
  };

  const setCurrentPageFromScroll = (page: number) => {
    pageChangeSourceRef.current = 'scroll';
    setCurrentPage(page);
  };

  const getPageEntry = (page: number): PageNoteEntry => notesByPage[page] ?? { note: '', highlights: [] };

  const updatePageNote = (page: number, note: string) => {
    setNotesByPage((previous) => {
      const next = { ...previous };
      const currentEntry = next[page] ? { ...next[page] } : { note: '', highlights: [] };
      currentEntry.note = note;

      if (!note.trim() && currentEntry.highlights.length === 0) {
        delete next[page];
      } else {
        next[page] = currentEntry;
      }

      return next;
    });
  };

  const addHighlight = useCallback((page: number, text: string, occurrenceIndex: number) => {
    const normalizedText = text.replace(/\s+/g, ' ').trim();
    if (!normalizedText) return;

    setNotesByPage((previous) => {
      const next = { ...previous };
      const currentEntry = next[page] ? { ...next[page] } : { note: '', highlights: [] };

      const alreadyExists = currentEntry.highlights.some(h => h.text === normalizedText && h.occurrenceIndex === occurrenceIndex);

      if (alreadyExists) return previous;

      const highlight: HighlightEntry = {
        id: crypto.randomUUID(),
        page,
        text: normalizedText,
        comment: '',
        createdAt: Date.now(),
        occurrenceIndex,
      };

      currentEntry.highlights = [...currentEntry.highlights, highlight];
      next[page] = currentEntry;
      return next;
    });
  }, [setNotesByPage]);

  const updateHighlightComment = (page: number, highlightId: string, comment: string) => {
    setNotesByPage((previous) => {
      const currentEntry = previous[page];
      if (!currentEntry) {
        return previous;
      }

      const updatedHighlights = currentEntry.highlights.map((highlight) => (
        highlight.id === highlightId ? { ...highlight, comment } : highlight
      ));

      return {
        ...previous,
        [page]: {
          ...currentEntry,
          highlights: updatedHighlights,
        },
      };
    });
  };

  const removeHighlight = (page: number, highlightId: string) => {
    setNotesByPage((previous) => {
      const currentEntry = previous[page];
      if (!currentEntry) {
        return previous;
      }

      const updatedHighlights = currentEntry.highlights.filter((highlight) => highlight.id !== highlightId);

      if (!currentEntry.note.trim() && updatedHighlights.length === 0) {
        const next = { ...previous };
        delete next[page];
        return next;
      }

      return {
        ...previous,
        [page]: {
          ...currentEntry,
          highlights: updatedHighlights,
        },
      };
    });
  };

  const renameHighlight = (page: number, highlightId: string, customName: string) => {
    setNotesByPage((previous) => {
      const currentEntry = previous[page];
      if (!currentEntry) return previous;

      const updatedHighlights = currentEntry.highlights.map((highlight) => (
        highlight.id === highlightId ? { ...highlight, customName } : highlight
      ));

      return {
        ...previous,
        [page]: { ...currentEntry, highlights: updatedHighlights },
      };
    });
  };

  const notesText = getPageEntry(currentPage).note;
  const currentHighlights = getPageEntry(currentPage).highlights;

  // Handle Swapping Files
  const saveCurrentProgressIfNeeded = async () => {
    if (!selectedFile) return;
    try {
      await saveProgress({
        userId,
        documentId: selectedFile.id,
        documentType: selectedFile.type,
        currentPage,
        syncDataJson: JSON.stringify({ notesByPage })
      });
      setSyncStatus(`Saved progress for ${selectedFile.name} on Page ${currentPage}.`);
    } catch (err) {
      console.warn(err);
      setSyncStatus('Failed to save progress before switching file.');
    }
  };

  // Cloud Progress Syncing Coordinates
  useEffect(() => {
    if (!selectedFile?.id) return;
    async function fetchServerState() {
      isDocumentHydratingRef.current = true;
      const data = await getProgress(userId, selectedFile!.id);
      if (data) {
        // Don't immediately set the page if viewer hasn't reported total pages yet.
        const loadedPage = data.currentPage;
        // fetched progress for selected document
        if (totalPages && totalPages > 0 && loadedPage >= 1 && loadedPage <= totalPages) {
          setCurrentPageFromManualAction(loadedPage);
        } else {
          // Defer applying until viewer reports totalPages
          pendingLoadedPageRef.current = loadedPage;
        }
        if (data.syncDataJson) {
          try {
            const parsed = JSON.parse(data.syncDataJson);
            if (parsed.notesByPage) {
              setNotesByPage(parsed.notesByPage as NotesByPage);
            } else if (parsed.comments) {
              setNotesByPage({
                [data.currentPage]: {
                  note: parsed.comments || '',
                  highlights: [],
                },
              });
            } else {
              setNotesByPage({});
            }
          } catch (e) {
            console.warn(e);
          }
        }
        setSyncStatus(`Page snapshot loaded!`);
      } else {
        setNotesByPage({});
        setCurrentPageFromManualAction(1);
        setSyncStatus('Fresh snapshot created.');
      }
      isDocumentHydratingRef.current = false;
    }
    fetchServerState();
  }, [userId, selectedFile, totalPages]);

  // Apply pending loaded page when totalPages becomes available
  useEffect(() => {
    const pending = pendingLoadedPageRef.current;
    if (pending && totalPages && totalPages > 0) {
      const clamped = Math.min(Math.max(1, pending), totalPages);
      // applying pending loaded page after totalPages reported
      setCurrentPageFromManualAction(clamped);
      pendingLoadedPageRef.current = null;
      // If we're in scroll mode, also ensure the viewport scrolls to the page
      if (viewMode === 'scroll') {
        // page elements are named like txt/pdf/docx-page-N
        const idPrefix = selectedFile?.type || 'pdf';
        let attempts = 0;
        const maxAttempts = 12; // ~1.8s total retries

        const tryScroll = () => {
          attempts += 1;
          const el = document.getElementById(`${idPrefix}-page-${clamped}`);
          if (el) {
            try {
              const container = viewportRef.current;
              if (container) {
                // Compute element's offset relative to the scroll container and set scrollTop exactly
                const elRect = el.getBoundingClientRect();
                const containerRect = container.getBoundingClientRect();
                const relativeTop = elRect.top - containerRect.top + container.scrollTop;
                // Align element top to container top
                container.scrollTo({ top: Math.max(0, Math.round(relativeTop)), behavior: 'auto' });
              } else {
                el.scrollIntoView({ behavior: 'auto', block: 'start' });
              }
            } catch (e) {
               
              console.warn(e);
            }
            // clear manual lock shortly after ensuring we've scrolled
            setTimeout(() => {
              if (pageChangeSourceRef.current === 'manual') pageChangeSourceRef.current = null;
            }, 250);
            return true;
          }
          if (attempts >= maxAttempts) {
            // give up and clear manual lock to avoid permanent lock
            if (pageChangeSourceRef.current === 'manual') pageChangeSourceRef.current = null;
            return true;
          }
          return false;
        };

        // Try immediately and then poll until element appears
        if (!tryScroll()) {
          const intervalId = setInterval(() => {
            const done = tryScroll();
            if (done) clearInterval(intervalId);
          }, 150);
        }
      }
    }
  }, [totalPages, selectedFile?.type, viewMode, pageChangeSourceRef, viewportRef]);

  const handleSyncData = async () => {
    if (!selectedFile) return;
    setSyncStatus('Syncing progress...');
    
    const payload: DocumentProgress = {
      userId,
      documentId: selectedFile.id,
      documentType: selectedFile.type,
      currentPage,
      syncDataJson: JSON.stringify({ notesByPage })
    };

    try {
      await saveProgress(payload);
      setSyncStatus(`Saved on page ${currentPage}.`);
    } catch (err) {
      console.warn(err);
      setSyncStatus('Sync broken.');
    }
  };

  const toggleFullPage = async () => {
    try {
      if (document.fullscreenElement === shellRef.current) {
        await document.exitFullscreen();
        return;
      }

      if (shellRef.current?.requestFullscreen) {
        await shellRef.current.requestFullscreen();
        return;
      }

      setIsFullPage((current) => !current);
    } catch (error) {
      console.error('Unable to toggle full page mode.', error);
      setIsFullPage((current) => !current);
    }
  };

  const handleNotesResizeMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    notesResizeRef.current = {
      startX: event.clientX,
      startWidth: notesPanelWidth,
    };
  };

  useEffect(() => {
    if (!notesOpen) {
      notesResizeRef.current = null;
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!notesResizeRef.current || !shellRef.current) {
        return;
      }

      const shellWidth = shellRef.current.getBoundingClientRect().width;
      const nextWidth = shellWidth - event.clientX;
      const minWidth = 280;
      const maxWidth = Math.max(minWidth, Math.round(shellWidth * 0.6));

      setNotesPanelWidth(Math.min(maxWidth, Math.max(minWidth, nextWidth)));
    };

    const handleMouseUp = () => {
      notesResizeRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [notesOpen]);

  useEffect(() => {
    if (!notesOpen || !viewportRef.current) return;
    const viewport = viewportRef.current;

    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
      if (!selectedText) return;

      const range = selection.getRangeAt(0);
      let currentNode: Node | null = range.commonAncestorContainer;
      let pageElement: HTMLElement | null = null;

      while (currentNode && currentNode !== viewport) {
        if (currentNode instanceof HTMLElement && /^(txt|pdf|docx)-page-\d+$/.test(currentNode.id)) {
          pageElement = currentNode;
          break;
        }
        currentNode = currentNode.parentNode;
      }

      if (!pageElement) return;

      const pageMatch = pageElement.id.match(/-(\d+)$/);
      const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : currentPage;

      if (!Number.isFinite(pageNumber) || pageNumber < 1) return;

      // Clone a range from the very start of the page up to exactly where the user started highlighting
      const preSelectionRange = range.cloneRange();
      preSelectionRange.selectNodeContents(pageElement);
      preSelectionRange.setEnd(range.startContainer, range.startOffset);
      
      // Extract the text that comes *before* the highlight
      const preSelectionText = preSelectionRange.toString();

      // Count how many times our selected text appears in the preceding text (Whitespace agnostic!)
      let occurrenceIndex = 0;
      const strippedPreSelection = preSelectionText.replace(/\s+/g, '').toLowerCase();
      const strippedSelected = selectedText.replace(/\s+/g, '').toLowerCase();
      
      let pos = strippedPreSelection.indexOf(strippedSelected);
      while (pos !== -1) {
        occurrenceIndex++;
        pos = strippedPreSelection.indexOf(strippedSelected, pos + 1);
      }

      addHighlight(pageNumber, selectedText, occurrenceIndex); // Pass it down!
      selection.removeAllRanges();
    };

    viewport.addEventListener('mouseup', handleMouseUp);
    return () => viewport.removeEventListener('mouseup', handleMouseUp);
  }, [addHighlight, currentPage, notesOpen]);

  const shellStyle: CSSProperties = {
    fontFamily: 'system-ui, sans-serif',
    width: '100%',
    height: '100vh',
    margin: '0',
    padding: '0',
    border: 'none',
    borderRadius: '0',
    boxShadow: 'none',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fff',
    overflow: 'auto'
  };

  const toolbarStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '12px 16px',
    backgroundColor: '#3C3C3C',
    color: '#fff',
    borderBottom: '1px solid #2C2C2C',
    flexShrink: 0,
    height: '56px',
    boxSizing: 'border-box'
  };

  const toolbarButtonStyle: CSSProperties = {
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#fff',
    transition: 'background 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  };

  const viewportStyle: CSSProperties = {
    flex: 1,
    width: '100%',
    overflowY: 'auto',
    overflowX: 'hidden',
    backgroundColor: '#808080',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '16px',
    boxSizing: 'border-box'
  };

  const handleSelectHighlight = (id: string | null) => {
    setSelectedHighlightId(id);
    if (id) {
      setNotesOpen(true);
    }
  };

  // 🌟 TypeScript Safety Guard: Stops execution if data is still fetching over the network
  if (!selectedFile) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '32px' }}>⏳</span>
          <h3 style={{ marginTop: '10px', color: '#666' }}>Connecting to Backend Storage...</h3>
          <p style={{ fontSize: '13px', color: '#999' }}>Make sure your Spring Boot server is running.</p>
        </div>
        {libraryOpen && (
          <LibraryPanel
            files={library}
            onClose={() => setLibraryOpen(false)}
            onSelect={async (file) => {
              await saveCurrentProgressIfNeeded();
              isDocumentHydratingRef.current = true;
              setSelectedFile(file);
              await refreshLibrary();
              setLibraryOpen(false);
            }}
            onRemove={handleRemoveFileFromLibrary}
          />
        )}
      </div>
    );
  }

  return (
    <div ref={shellRef} style={shellStyle}>
      {/* DARK TOOLBAR - Chrome-like */}
      <div style={toolbarStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div onClick={() => setLibraryOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 4, backgroundColor: '#2b2b2b', cursor: 'pointer', color: '#fff', border: '1px solid #5C5C5C' }}>
                    <div style={{ fontSize: 16 }}>{selectedFile?.type === 'pdf' ? '📕' : selectedFile?.type === 'docx' ? '📘' : ''}</div>
                    <div style={{ fontWeight: 600, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedFile?.name}</div>
                  </div>

                  <button onClick={() => setLibraryOpen(true)} style={{ padding: '6px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', border: '1px solid #5C5C5C', backgroundColor: '#4C4C4C', color: '#fff' }}>
                    Library
                  </button>
                </div>
              </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            disabled={currentPage <= 1}
            onClick={() => setCurrentPageFromManualAction(Math.max(1, currentPage - 1))}
            style={{ ...toolbarButtonStyle, opacity: currentPage <= 1 ? 0.5 : 1 }}
            title="Previous page"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4C4C4C')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            ◀
          </button>
          
          <input
            type="text"
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => {
              // Only allow digits in the input to keep it simple while typing
              const cleaned = e.target.value.replace(/[^0-9]/g, '');
              setPageInput(cleaned);
            }}
            onKeyDown={(e) => {
              // Prevent arrow keys from incrementing/decrementing the number input
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                return;
              }

              if (e.key === 'Escape') {
                setPageInput(String(currentPage));
                e.currentTarget.blur();
                return;
              }

              if (e.key !== 'Enter') return;

              const val = parseInt(pageInput, 10);
              if (!isNaN(val) && val >= 1 && val <= totalPages) {
                setCurrentPageFromManualAction(val);
              } else {
                setPageInput(String(currentPage));
              }
            }}
            // Prevent mouse wheel from changing any accidental focus behavior
            onWheel={(e) => { e.preventDefault(); }}
            style={{ width: '50px', padding: '6px 8px', borderRadius: '4px', border: '1px solid #5C5C5C', backgroundColor: '#4C4C4C', color: '#fff', fontSize: '13px', textAlign: 'center', fontWeight: '500' }}
          />
          
          <span style={{ color: '#fff', fontSize: '13px', minWidth: '40px', textAlign: 'center' }}>/ {totalPages}</span>
          
          <button
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPageFromManualAction(Math.min(totalPages, currentPage + 1))}
            style={{ ...toolbarButtonStyle, opacity: currentPage >= totalPages ? 0.5 : 1 }}
            title="Next page"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4C4C4C')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            ▶
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SignInButton />
          <button
            onClick={() => setZoom(z => Math.max(50, z - 10))}
            style={toolbarButtonStyle}
            title="Zoom out"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4C4C4C')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            −
          </button>

          <input 
            type="number"
            min={50}
            max={200}
            value={zoom}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 50 && val <= 200) {
                setZoom(val);
              }
            }}
            style={{ width: '50px', padding: '6px 8px', borderRadius: '4px', border: '1px solid #5C5C5C', backgroundColor: '#4C4C4C', color: '#fff', fontSize: '13px', textAlign: 'center', fontWeight: '500' }}
          />

          <button
            onClick={() => setZoom(100)}
            style={{ ...toolbarButtonStyle, fontSize: '14px', fontWeight: 'bold' }}
            title="Reset zoom"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4C4C4C')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            ↺
          </button>

          <button
            onClick={() => setZoom(z => Math.min(200, z + 10))}
            style={toolbarButtonStyle}
            title="Zoom in"
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4C4C4C')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            +
          </button>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#5C5C5C' }} />

          <button
            onClick={() => {
              if (viewMode === 'single') {
                // mark upcoming mode change as a manual page-change so viewers
                // won't immediately override the current page while they mount
                pageChangeSourceRef.current = 'manual';
                setViewMode('scroll');
              } else {
                setViewMode('single');
              }
            }}
            style={toolbarButtonStyle}
            title={viewMode === 'scroll' ? 'Switch to single page view' : 'Switch to continuous scroll view'}
            aria-label={viewMode === 'scroll' ? 'Switch to single page view' : 'Switch to continuous scroll view'}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4C4C4C')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {viewMode === 'scroll' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>≡</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Scroll</span>
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14 }}>▢</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Single</span>
              </span>
            )}
          </button>

          <button
            onClick={toggleFullPage}
            style={toolbarButtonStyle}
            title={isFullPage ? 'Exit fullscreen' : 'Fullscreen'}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4C4C4C')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {isFullPage ? '⛶' : '⛶'}
          </button>

          <div style={{ width: '1px', height: '24px', backgroundColor: '#5C5C5C' }} />

          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => {
                setMenuOpen(!menuOpen);
                setMenuHover(null);
              }}
              style={toolbarButtonStyle}
              title="More options"
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#4C4C4C')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              ⋯
            </button>

            {menuOpen && (
              <div style={{ 
                position: 'absolute', 
                top: '100%', 
                right: 0, 
                marginTop: '4px',
                minWidth: '160px',
                padding: '8px', 
                backgroundColor: 'rgba(15, 23, 42, 0.82)', 
                borderRadius: '6px', 
                border: '1px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
                zIndex: 1000
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setMenuHover(null);
                      setMenuOpen(false);
                      setNotesOpen(true);
                    }}
                    onMouseEnter={() => setMenuHover('notes')}
                    onMouseLeave={() => setMenuHover(null)}
                    style={{ 
                      width: '100%',
                      padding: '10px 12px', 
                      borderRadius: '4px', 
                      cursor: 'pointer', 
                      fontSize: '13px', 
                      fontWeight: '500', 
                      border: 'none',
                      backgroundColor: menuHover === 'notes' ? 'rgba(96, 165, 250, 0.22)' : 'transparent',
                      color: menuHover === 'notes' ? '#ffffff' : '#dbeafe',
                      textAlign: 'left'
                    }}
                  >
                    Notes
                  </button>
                  <button
                    onClick={() => {
                      setMenuHover(null);
                      setMenuOpen(false);
                      setInfoOpen(true);
                    }}
                    onMouseEnter={() => setMenuHover('info')}
                    onMouseLeave={() => setMenuHover(null)}
                    style={{ 
                      width: '100%',
                      padding: '10px 12px', 
                      borderRadius: '4px', 
                      cursor: 'pointer', 
                      fontSize: '13px', 
                      fontWeight: '500', 
                      border: 'none',
                      backgroundColor: menuHover === 'info' ? 'rgba(96, 165, 250, 0.22)' : 'transparent',
                      color: menuHover === 'info' ? '#ffffff' : '#dbeafe',
                      textAlign: 'left'
                    }}
                  >
                    Info
                  </button>
                  <button
                    onClick={() => {
                      setMenuHover(null);
                      setMenuOpen(false);
                      void handleSyncData();
                    }}
                    onMouseEnter={() => setMenuHover(null)}
                    onMouseLeave={() => setMenuHover(null)}
                    style={{ 
                      width: '100%',
                      padding: '10px 12px', 
                      borderRadius: '4px', 
                      cursor: 'pointer', 
                      fontSize: '13px', 
                      fontWeight: '500', 
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#dbeafe',
                      textAlign: 'left'
                    }}
                  >
                    Save progress
                  </button>
                  <div style={{ padding: '10px 12px 2px', fontSize: '12px', lineHeight: 1.4, color: '#94a3b8', borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '6px' }}>
                    {syncStatus}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {libraryOpen && (
        <LibraryPanel
          files={library}
          onClose={() => setLibraryOpen(false)}
          onSelect={async (file) => {
            await saveCurrentProgressIfNeeded();
            isDocumentHydratingRef.current = true;
            setSelectedFile(file);
            // setCurrentPageFromManualAction(1);
            // setTotalPages(file.totalPages || 1);
            await refreshLibrary();
            setLibraryOpen(false);
          }}
          onRemove={handleRemoveFileFromLibrary}
        />
      )}

      {infoOpen && (
        <InfoModal
          file={selectedFile}
          totalPages={totalPages}
          onClose={() => setInfoOpen(false)}
        />
      )}

      {/* CONTENT AREA */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%' }}>
        <div ref={viewportRef} style={{ ...viewportStyle, width: 'auto', minWidth: 0, flex: 1, height: '100%' }}>
          {selectedFile?.type === 'txt' && (
            <TxtViewer
              file={selectedFile}
              currentPage={currentPage}
              zoom={zoom}
              onTotalPagesChange={setTotalPages}
              viewMode={viewMode}
              onCurrentPageChange={setCurrentPageFromScroll}
              scrollContainerRef={viewportRef}
              pageChangeSourceRef={pageChangeSourceRef}
              highlightsByPage={notesByPage}
              selectedHighlightId={selectedHighlightId}
              onSelectHighlight={handleSelectHighlight}
            />
          )}
          {selectedFile?.type === 'pdf' && (
            <PdfViewer
              file={selectedFile}
              currentPage={currentPage}
              zoom={zoom}
              onTotalPagesChange={setTotalPages}
              viewMode={viewMode}
              onCurrentPageChange={setCurrentPageFromScroll}
              scrollContainerRef={viewportRef}
              pageChangeSourceRef={pageChangeSourceRef}
              highlightsByPage={notesByPage}
              selectedHighlightId={selectedHighlightId}
              onSelectHighlight={handleSelectHighlight}
            />
          )}
          {selectedFile?.type === 'docx' && (
            <DocxViewer
              file={selectedFile}
              currentPage={currentPage}
              zoom={zoom}
              onTotalPagesChange={setTotalPages}
              onStatusChange={setSyncStatus}
              viewMode={viewMode}
              onCurrentPageChange={setCurrentPageFromScroll}
              scrollContainerRef={viewportRef}
              pageChangeSourceRef={pageChangeSourceRef}
              highlightsByPage={notesByPage}
              selectedHighlightId={selectedHighlightId}
              onSelectHighlight={handleSelectHighlight}
            />
          )}
        </div>

        {notesOpen && (
          <NotesSidebar
            currentPage={currentPage}
            totalPages={totalPages}
            width={notesPanelWidth}
            note={notesText}
            highlights={currentHighlights}
            selectedHighlightId={selectedHighlightId}
            onSelectHighlight={(id) => setSelectedHighlightId(id)}
            onClose={() => setNotesOpen(false)}
            onResizeMouseDown={handleNotesResizeMouseDown}
            onNoteChange={(value) => updatePageNote(currentPage, value)}
            onHighlightCommentChange={(highlightId, comment) => updateHighlightComment(currentPage, highlightId, comment)}
            onRemoveHighlight={(highlightId) => removeHighlight(currentPage, highlightId)}
            onRenameHighlight={(highlightId, name) => renameHighlight(currentPage, highlightId, name)}
          />
        )}
      </div>

    </div>
  );
}

export default App;
