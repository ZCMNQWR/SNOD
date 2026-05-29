import { useState, useEffect, useRef, useCallback } from 'react';
import { saveProgress, getProgress, getAvailableFiles } from './services/api';
import type { DocumentProgress, AvailableFile } from './services/api';
import AuthGate from './components/AuthGate';
import DocumentLanding from './components/DocumentLanding';
import ReaderWorkspace from './components/ReaderWorkspace';
import type { HighlightEntry, NotesByPage, PageNoteEntry } from './types/notes';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

const getStoredUserId = (): string => {
  const token = localStorage.getItem('OAUTH_TOKEN');
  if (!token) {
    return '';
  }

  if (token.startsWith('Bearer user:')) {
    const email = token.slice('Bearer user:'.length).trim();
    return email || '';
  }

  try {
    const rawToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const payloadPart = rawToken.split('.')[1];
    if (!payloadPart) {
      return '';
    }

    const payload = JSON.parse(atob(payloadPart));
    return payload.email || '';
  } catch {
    return '';
  }
};

function App() {
  const [userId, setUserId] = useState<string>(() => getStoredUserId());
  const [isSignedIn, setIsSignedIn] = useState<boolean>(() => {
    const token = localStorage.getItem('OAUTH_TOKEN');
    return Boolean(token && token.startsWith('Bearer user:'));
  });
  
  const [isFullPage, setIsFullPage] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'single' | 'scroll'>('scroll');
  const [zoom, setZoom] = useState<number>(100);
  const [notesOpen, setNotesOpen] = useState<boolean>(false);
  const [notesPanelWidth, setNotesPanelWidth] = useState<number>(340);
  
  const [library, setLibrary] = useState<AvailableFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<AvailableFile | null>(null);
  const [libraryOpen, setLibraryOpen] = useState<boolean>(false);
  const [infoOpen, setInfoOpen] = useState<boolean>(false);

  // Decoupled page states for instant local updates vs debounced cloud sync
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [localPage, setLocalPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [notesByPage, setNotesByPage] = useState<NotesByPage>({});
  const [syncStatus, setSyncStatus] = useState<string>('Connecting...');
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [isHighlightMode, setIsHighlightMode] = useState<boolean>(false);
  const [manualScrollNonce, setManualScrollNonce] = useState<number>(0);

  const AUTO_SAVE_DELAY_MS = 5000;

  const shellRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pageChangeSourceRef = useRef<'manual' | 'scroll' | null>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesResizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const isDocumentHydratingRef = useRef<boolean>(false);
  const pendingLoadedPageRef = useRef<number | null>(null);
  const prevNotesByPageRef = useRef<NotesByPage>(notesByPage);

  // FIXED 1 & 2: Derived State Pattern. Tracks viewMode transitions inline on render.
  // This completely eliminates the react-hooks/set-state-in-effect error and the missing localPage dependencies.
  // Ref mutation (pageChangeSourceRef) is omitted here to avoid react-hooks/refs errors; it is handled safely in the subsequent manualScrollNonce effect.
  const [prevViewMode, setPrevViewMode] = useState<'single' | 'scroll'>(viewMode);
  if (viewMode !== prevViewMode) {
    setPrevViewMode(viewMode);
    if (viewMode === 'scroll' && localPage > 1) {
      setManualScrollNonce(prev => prev + 1);
    }
  }

  const resetDocumentState = () => {
    isDocumentHydratingRef.current = false;
    pendingLoadedPageRef.current = null;
    setSelectedFile(null);
    setCurrentPage(1);
    setLocalPage(1);
    setTotalPages(1);
    setNotesByPage({});
    setSelectedHighlightId(null);
    setLibraryOpen(false);
    setInfoOpen(false);
    setManualScrollNonce(0);
  };

  const handleSignOut = () => {
    localStorage.removeItem('OAUTH_TOKEN');
    setIsSignedIn(false);
    setUserId('');
    resetDocumentState();
    setSyncStatus('Signed out.');
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullPage(document.fullscreenElement === shellRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const refreshLibrary = useCallback(async (selectFirstIfNeeded = false): Promise<AvailableFile[]> => {
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
  }, []);

  const handleRemoveFileFromLibrary = async (file: AvailableFile): Promise<boolean> => {
    const wasSelected = selectedFile?.id === file.id;

    if (wasSelected) {
      setSelectedFile(null);
      setCurrentPage(1);
      setLocalPage(1);
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
      setLocalPage(1);
      setTotalPages(1);
      setNotesByPage({});
      setSelectedHighlightId(null);
      setLibraryOpen(false);
    }

    return !refreshed.some((entry) => entry.id === file.id);
  };

  useEffect(() => {
    if (!isSignedIn) {
      return;
    }

    void Promise.resolve().then(() => {
      setSyncStatus('Connecting...');
      return refreshLibrary(true);
    })
    .then((files) => {
      if (files.length === 0) {
        setSyncStatus('Connected — no files yet.');
      } else {
        setSyncStatus('Connected');
      }
    })
    .catch(() => {
      setSyncStatus('Connection failed.');
    });
  }, [isSignedIn, refreshLibrary]);

  useEffect(() => {
    if (!selectedFile?.id) {
      return;
    }

    if (isDocumentHydratingRef.current) {
      prevNotesByPageRef.current = notesByPage;
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    const notesChanged = prevNotesByPageRef.current !== notesByPage;
    prevNotesByPageRef.current = notesByPage;
    const delay = notesChanged ? 500 : AUTO_SAVE_DELAY_MS;

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
    }, delay);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [currentPage, notesByPage, selectedFile?.id, selectedFile?.type, userId]);

  // Core high-priority manual scroll execution engine
  useEffect(() => {
    if (viewMode !== 'scroll' || manualScrollNonce === 0 || !selectedFile) return;

    pageChangeSourceRef.current = 'manual';
    const idPrefix = selectedFile.type || 'pdf';

    const executeScrollJump = () => {
      const el = document.getElementById(`${idPrefix}-page-${localPage}`);
      const container = viewportRef.current;
      
      if (el && container) {
        const elRect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const relativeTop = elRect.top - containerRect.top + container.scrollTop;
        
        container.scrollTo({ 
          top: Math.max(0, Math.round(relativeTop)), 
          behavior: 'auto' 
        });
        
        setTimeout(() => {
          if (pageChangeSourceRef.current === 'manual') {
            pageChangeSourceRef.current = null;
          }
        }, 150);
      }
    };

    executeScrollJump();
    const backupTimer = setTimeout(executeScrollJump, 60);
    return () => clearTimeout(backupTimer);
  }, [manualScrollNonce, viewMode, selectedFile, localPage]); // FIXED: Added localPage to tracking array to resolve warnings

  const setCurrentPageFromManualAction = useCallback((page: number) => {
    pageChangeSourceRef.current = 'manual';
    setLocalPage(page);
    setCurrentPage(page);
    setManualScrollNonce(prev => prev + 1); 
  }, []);

  const setCurrentPageFromScroll = useCallback((page: number) => {
    if (pageChangeSourceRef.current === 'manual') return;
    pageChangeSourceRef.current = 'scroll';
    setLocalPage(page);
    setCurrentPage(page);
  }, []);

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

  const notesText = getPageEntry(localPage).note;
  const currentHighlights = getPageEntry(localPage).highlights;

  const saveCurrentProgressIfNeeded = async () => {
    if (!selectedFile) return;
    const fileToSave = selectedFile;
    try {
      await saveProgress({
        userId,
        documentId: fileToSave.id,
        documentType: fileToSave.type,
        currentPage,
        syncDataJson: JSON.stringify({ notesByPage })
      });
      setSyncStatus(`Saved progress for ${fileToSave.name} on Page ${currentPage}.`);
    } catch (err) {
      console.warn(err);
      setSyncStatus('Failed to save progress before switching file.');
    }
  };

  useEffect(() => {
    if (!selectedFile?.id) return;
    const progressUserId = userId;

    if (!progressUserId) {
      queueMicrotask(() => {
        setNotesByPage({});
        setCurrentPageFromManualAction(1);
        setSyncStatus('Signed out.');
      });
      return;
    }

    async function fetchServerState() {
      isDocumentHydratingRef.current = true;
      const data = await getProgress(progressUserId, selectedFile!.id);
      
      if (data) {
        const loadedPage = data.currentPage;
        
        pageChangeSourceRef.current = 'manual';
        setLocalPage(loadedPage);
        setCurrentPage(loadedPage);
        setManualScrollNonce(prev => prev + 1);

        if (data.syncDataJson) {
          try {
            const parsed = JSON.parse(data.syncDataJson);
            if (parsed.notesByPage) {
              setNotesByPage(parsed.notesByPage as NotesByPage);
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
  }, [userId, selectedFile, totalPages, setCurrentPageFromManualAction]);

  useEffect(() => {
    const pending = pendingLoadedPageRef.current;
    if (pending && totalPages && totalPages > 0) {
      const clamped = Math.min(Math.max(1, pending), totalPages);
      setCurrentPageFromManualAction(clamped);
      pendingLoadedPageRef.current = null;
    }
  }, [totalPages, setCurrentPageFromManualAction]);

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
      try {
        const confirmed = await getProgress(userId, selectedFile.id);
        if (confirmed && confirmed.currentPage === currentPage) {
          setSyncStatus(`Saved on page ${currentPage}.`);
        } else if (confirmed) {
          setSyncStatus(`Saved but server has page ${confirmed.currentPage}.`);
        } else {
          setSyncStatus('Saved, but server returned no progress.');
        }
      } catch (e) {
        console.warn('Verification failed', e);
        setSyncStatus(`Saved (verification failed).`);
      }
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

  const handleNotesResizeMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    notesResizeRef.current = {
      startX: event.clientX,
      startWidth: notesPanelWidth,
    };
  };

  const openFileForCurrentSession = async (file: AvailableFile) => {
    await saveCurrentProgressIfNeeded();
    isDocumentHydratingRef.current = true;
    setSelectedFile(file);
    await refreshLibrary();
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

  const processCurrentSelection = useCallback(() => {
    if (!viewportRef.current) return false;
    const viewport = viewportRef.current;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return false;

    const selectedText = selection.toString().replace(/\s+/g, ' ').trim();
    if (!selectedText) return false;

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

    if (!pageElement) return false;

    const pageMatch = pageElement.id.match(/-(\d+)$/);
    const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : localPage;

    if (!Number.isFinite(pageNumber) || pageNumber < 1) return false;

    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(pageElement);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    
    const preSelectionText = preSelectionRange.toString();

    let occurrenceIndex = 0;
    const strippedPreSelection = preSelectionText.replace(/\s+/g, '').toLowerCase();
    const strippedSelected = selectedText.replace(/\s+/g, '').toLowerCase();
    
    let pos = strippedPreSelection.indexOf(strippedSelected);
    while (pos !== -1) {
      occurrenceIndex++;
      pos = strippedPreSelection.indexOf(strippedSelected, pos + 1);
    }

    addHighlight(pageNumber, selectedText, occurrenceIndex);
    selection.removeAllRanges();
    return true;
  }, [addHighlight, localPage]);

  useEffect(() => {
    if (!notesOpen && !isHighlightMode) return;
    if (!viewportRef.current) return;
    const viewport = viewportRef.current;

    const handleSelectionComplete = () => {
      processCurrentSelection();
    };

    const handleDocumentTouchEnd = () => {
      setTimeout(handleSelectionComplete, 100);
    };

    viewport.addEventListener('mouseup', handleSelectionComplete);
    document.addEventListener('touchend', handleDocumentTouchEnd);
    return () => {
      viewport.removeEventListener('mouseup', handleSelectionComplete);
      document.addEventListener('touchend', handleDocumentTouchEnd);
    };
  }, [processCurrentSelection, notesOpen, isHighlightMode]);

  const handleToggleHighlightMode = useCallback(() => {
    setIsHighlightMode((prev) => !prev);
  }, []);

  // Global Click Listener to unselect highlights when clicking anywhere else
  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('mark[data-highlight-id]')) return;
      if (target.closest('aside') || target.closest('button')) return;
      if (target.closest('input') || target.closest('textarea')) return;

      if (selectedHighlightId !== null) {
        setSelectedHighlightId(null);
      }
    };

    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, [selectedHighlightId]);

  if (!isSignedIn) {
    return (
      <AuthGate
        onAuthenticated={(email, token, status) => {
          localStorage.setItem('OAUTH_TOKEN', token);
          setUserId(email);
          setIsSignedIn(true);
          setSyncStatus(status);
        }}
      />
    );
  }

  if (!selectedFile) {
    return (
      <DocumentLanding
        activeLibrary={library}
        libraryOpen={libraryOpen}
        onOpenLibrary={() => setLibraryOpen(true)}
        onCloseLibrary={() => setLibraryOpen(false)}
        onRefreshLibrary={async () => {
          setSyncStatus('Refreshing library...');
          await refreshLibrary();
        }}
        onSelectFile={openFileForCurrentSession}
        onRemoveFile={handleRemoveFileFromLibrary}
      />
    );
  }

  return (
    <ReaderWorkspace
      shellRef={shellRef}
      viewportRef={viewportRef}
      pageChangeSourceRef={pageChangeSourceRef}
      selectedFile={selectedFile}
      activeLibrary={library}
      libraryOpen={libraryOpen}
      infoOpen={infoOpen}
      currentPage={localPage}
      zoom={zoom}
      viewMode={viewMode}
      isFullPage={isFullPage}
      userId={userId}
      syncStatus={syncStatus}
      notesOpen={notesOpen}
      notesPanelWidth={notesPanelWidth}
      notesText={notesText}
      currentHighlights={currentHighlights}
      totalPages={totalPages}
      selectedHighlightId={selectedHighlightId}
      notesByPage={notesByPage}
      isHighlightMode={isHighlightMode}
      manualScrollNonce={manualScrollNonce}
      onToggleHighlightMode={handleToggleHighlightMode}
      onOpenLibrary={() => setLibraryOpen(true)}
      onCloseLibrary={() => setLibraryOpen(false)}
      onSelectLibraryFile={openFileForCurrentSession}
      onRemoveLibraryFile={handleRemoveFileFromLibrary}
      onSetCurrentPageFromManualAction={setCurrentPageFromManualAction}
      onSetCurrentPageFromScroll={setCurrentPageFromScroll}
      onSetZoom={setZoom}
      onSetViewMode={setViewMode}
      onToggleFullPage={toggleFullPage}
      onSignOut={handleSignOut}
      onOpenNotes={() => setNotesOpen(true)}
      onOpenInfo={() => setInfoOpen(true)}
      onCloseInfo={() => setInfoOpen(false)}
      onSaveProgress={() => void handleSyncData()}
      onSetTotalPages={setTotalPages}
      onSetSyncStatus={setSyncStatus}
      onSetSelectedHighlightId={setSelectedHighlightId}
      onCloseNotes={() => setNotesOpen(false)}
      onResizeNotesMouseDown={handleNotesResizeMouseDown}
      onUpdateNote={(value) => updatePageNote(localPage, value)}
      onUpdateHighlightComment={(highlightId, comment) => updateHighlightComment(localPage, highlightId, comment)}
      onRemoveHighlight={(highlightId) => removeHighlight(localPage, highlightId)}
      onRenameHighlight={(highlightId, name) => renameHighlight(localPage, highlightId, name)}
    />
  );
}

export default App;