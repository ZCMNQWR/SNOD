import LibraryPanel from './LibraryPanel';
import type { AvailableFile } from '../services/api';

interface DocumentLandingProps {
  activeLibrary: AvailableFile[];
  libraryOpen: boolean;
  onOpenLibrary: () => void;
  onCloseLibrary: () => void;
  onRefreshLibrary: () => Promise<void> | void;
  onSelectFile: (file: AvailableFile) => Promise<void> | void;
  onRemoveFile: (file: AvailableFile) => Promise<boolean>;
}

export default function DocumentLanding({
  activeLibrary,
  libraryOpen,
  onOpenLibrary,
  onCloseLibrary,
  onRefreshLibrary,
  onSelectFile,
  onRemoveFile,
}: DocumentLandingProps) {

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <span style={{ fontSize: '36px' }}>📂</span>
        <h3 style={{ marginTop: '10px', color: '#666' }}>{activeLibrary.length === 0 ? 'Your library is empty' : 'No document selected'}</h3>
        <p style={{ fontSize: '13px', color: '#999' }}>{activeLibrary.length === 0 ? 'Open the library to upload your first document.' : 'Open the library to select a document to view.'}</p>
        <div style={{ marginTop: 16, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button onClick={onOpenLibrary} style={{ padding: '10px 14px', borderRadius: 8, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}>Open Library</button>
          <button onClick={() => void onRefreshLibrary()} style={{ padding: '10px 14px', borderRadius: 8, background: '#0f172a', color: '#fff', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>Refresh</button>
        </div>
      </div>
      {libraryOpen && (
        <LibraryPanel
          files={activeLibrary}
          canUpload={true}
          maxUploadBytes={200 * 1024 * 1024}
          onClose={onCloseLibrary}
          onSelect={async (file) => {
            await onSelectFile(file);
            onCloseLibrary();
          }}
          onRemove={onRemoveFile}
        />
      )}
    </div>
  );
}
