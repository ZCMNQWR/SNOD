import { type CSSProperties, type RefObject, type MouseEvent as ReactMouseEvent } from 'react';
import { TxtViewer } from './TxtViewer';
import { PdfViewer } from './PdfViewer';
import { DocxViewer } from './DocxViewer';
import ReaderToolbar from './ReaderToolbar';
import LibraryPanel from './LibraryPanel';
import InfoModal from './InfoModal';
import NotesSidebar from './NotesSidebar';
import type { AvailableFile } from '../services/api';
import type { HighlightEntry, NotesByPage } from '../types/notes';

interface ReaderWorkspaceProps {
  shellRef: RefObject<HTMLDivElement | null>;
  viewportRef: RefObject<HTMLDivElement | null>;
  pageChangeSourceRef: RefObject<'manual' | 'scroll' | null>;
  selectedFile: AvailableFile;
  activeLibrary: AvailableFile[];
  libraryOpen: boolean;
  infoOpen: boolean;
  currentPage: number;
  pageInput: string;
  zoom: number;
  viewMode: 'single' | 'scroll';
  isFullPage: boolean;
  userId: string;
  syncStatus: string;
  notesOpen: boolean;
  notesPanelWidth: number;
  notesText: string;
  currentHighlights: HighlightEntry[];
  totalPages: number;
  selectedHighlightId: string | null;
  notesByPage: NotesByPage;
  onOpenLibrary: () => void;
  onCloseLibrary: () => void;
  onSelectLibraryFile: (file: AvailableFile) => Promise<void> | void;
  onRemoveLibraryFile: (file: AvailableFile) => Promise<boolean>;
  onSetCurrentPageFromManualAction: (page: number) => void;
  onSetCurrentPageFromScroll: (page: number) => void;
  onSetPageInput: (value: string) => void;
  onSetZoom: (value: number | ((current: number) => number)) => void;
  onSetViewMode: (value: 'single' | 'scroll') => void;
  onToggleFullPage: () => void;
  onSignOut: () => void;
  onOpenNotes: () => void;
  onOpenInfo: () => void;
  onCloseInfo: () => void;
  onSaveProgress: () => void;
  onSetTotalPages: (totalPages: number) => void;
  onSetSyncStatus: (status: string) => void;
  onSetSelectedHighlightId: (id: string | null) => void;
  onCloseNotes: () => void;
  onResizeNotesMouseDown: (event: ReactMouseEvent<HTMLDivElement>) => void;
  onUpdateNote: (value: string) => void;
  onUpdateHighlightComment: (highlightId: string, comment: string) => void;
  onRemoveHighlight: (highlightId: string) => void;
  onRenameHighlight: (highlightId: string, name: string) => void;
}

export default function ReaderWorkspace({
  shellRef,
  viewportRef,
  pageChangeSourceRef,
  selectedFile,
  activeLibrary,
  libraryOpen,
  infoOpen,
  currentPage,
  pageInput,
  zoom,
  viewMode,
  isFullPage,
  userId,
  syncStatus,
  notesOpen,
  notesPanelWidth,
  notesText,
  currentHighlights,
  totalPages,
  selectedHighlightId,
  notesByPage,
  onOpenLibrary,
  onCloseLibrary,
  onSelectLibraryFile,
  onRemoveLibraryFile,
  onSetCurrentPageFromManualAction,
  onSetCurrentPageFromScroll,
  onSetPageInput,
  onSetZoom,
  onSetViewMode,
  onToggleFullPage,
  onSignOut,
  onOpenNotes,
  onOpenInfo,
  onCloseInfo,
  onSaveProgress,
  onSetTotalPages,
  onSetSyncStatus,
  onSetSelectedHighlightId,
  onCloseNotes,
  onResizeNotesMouseDown,
  onUpdateNote,
  onUpdateHighlightComment,
  onRemoveHighlight,
  onRenameHighlight,
}: ReaderWorkspaceProps) {
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
    onSetSelectedHighlightId(id);
    if (id) {
      onOpenNotes();
    }
  };

  return (
    <div ref={shellRef} style={shellStyle}>
      <ReaderToolbar
        selectedFile={selectedFile}
        currentPage={currentPage}
        totalPages={totalPages}
        pageInput={pageInput}
        zoom={zoom}
        viewMode={viewMode}
        isFullPage={isFullPage}
        userId={userId}
        syncStatus={syncStatus}
        onOpenLibrary={onOpenLibrary}
        onSetCurrentPage={onSetCurrentPageFromManualAction}
        onSetPageInput={onSetPageInput}
        onSetZoom={onSetZoom}
        onSetViewMode={onSetViewMode}
        onToggleFullPage={onToggleFullPage}
        onSignOut={onSignOut}
        onOpenNotes={onOpenNotes}
        onOpenInfo={onOpenInfo}
        onSaveProgress={onSaveProgress}
        onPageChangeSourceManual={() => { pageChangeSourceRef.current = 'manual'; }}
      />

      {libraryOpen && (
        <LibraryPanel
          files={activeLibrary}
          canUpload={true}
          maxUploadBytes={200 * 1024 * 1024}
          onClose={onCloseLibrary}
          onSelect={async (file) => {
            await onSelectLibraryFile(file);
            onCloseLibrary();
          }}
          onRemove={onRemoveLibraryFile}
        />
      )}

      {infoOpen && (
        <InfoModal
          file={selectedFile}
          totalPages={totalPages}
          onClose={onCloseInfo}
        />
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0, width: '100%' }}>
        <div ref={viewportRef} style={{ ...viewportStyle, width: 'auto', minWidth: 0, flex: 1, height: '100%' }}>
          {selectedFile?.type === 'txt' && (
            <TxtViewer
              file={selectedFile}
              currentPage={currentPage}
              zoom={zoom}
              onTotalPagesChange={onSetTotalPages}
              viewMode={viewMode}
              onCurrentPageChange={onSetCurrentPageFromScroll}
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
              onTotalPagesChange={onSetTotalPages}
              viewMode={viewMode}
              onCurrentPageChange={onSetCurrentPageFromScroll}
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
              onTotalPagesChange={onSetTotalPages}
              onStatusChange={onSetSyncStatus}
              viewMode={viewMode}
              onCurrentPageChange={onSetCurrentPageFromScroll}
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
            onSelectHighlight={onSetSelectedHighlightId}
            onClose={onCloseNotes}
            onResizeMouseDown={onResizeNotesMouseDown}
            onNoteChange={onUpdateNote}
            onHighlightCommentChange={onUpdateHighlightComment}
            onRemoveHighlight={onRemoveHighlight}
            onRenameHighlight={onRenameHighlight}
          />
        )}
      </div>
    </div>
  );
}