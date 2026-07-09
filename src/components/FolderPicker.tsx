import { useState } from 'react';
import type { CropAspectRatio, QueuedImage } from '../types';
import { formatAspectRatio, isSupportedImageFile } from '../types';

interface FolderPickerProps {
  aspectRatio: CropAspectRatio;
  onSelect: (directoryHandle: FileSystemDirectoryHandle, queue: QueuedImage[]) => void;
  onBack: () => void;
}

async function collectImagesFromDirectory(
  directoryHandle: FileSystemDirectoryHandle,
): Promise<QueuedImage[]> {
  const queue: QueuedImage[] = [];

  for await (const entry of directoryHandle.values()) {
    if (entry.kind !== 'file') {
      continue;
    }

    const fileHandle = entry as FileSystemFileHandle;
    if (!isSupportedImageFile(fileHandle.name)) {
      continue;
    }

    const file = await fileHandle.getFile();
    queue.push({
      file,
      name: fileHandle.name,
      relativePath: fileHandle.name,
    });
  }

  queue.sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  return queue;
}

export function FolderPicker({ aspectRatio, onSelect, onBack }: FolderPickerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickFolder = async () => {
    if (!('showDirectoryPicker' in window)) {
      setError(
        'Twoja przeglądarka nie obsługuje File System Access API. Użyj Chrome lub Edge.',
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });

      const queue = await collectImagesFromDirectory(directoryHandle);

      if (queue.length === 0) {
        setError('W wybranym folderze nie znaleziono plików JPG, PNG ani WebP.');
        return;
      }

      onSelect(directoryHandle, queue);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setError('Nie udało się wczytać folderu. Spróbuj ponownie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="step-panel">
      <h2>Krok 2: Wybierz folder ze zdjęciami</h2>
      <p className="step-description">
        Wybrany format: <strong>{aspectRatio.label}</strong> (
        {formatAspectRatio(aspectRatio.ratioW, aspectRatio.ratioH)})
      </p>
      <p className="step-description">
        Wczytane zostaną wszystkie pliki JPG, PNG i WebP z wybranego folderu. Każde zdjęcie
        zachowa własną rozdzielczość po wycięciu.
      </p>

      <div className="info-card">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <p>
          Wymagana przeglądarka <strong>Chrome</strong> lub <strong>Edge</strong> — zapis do
          podfolderu <code>cropped/</code> działa tylko z File System Access API.
        </p>
      </div>

      <div className="action-row">
        <button type="button" className="secondary-button" onClick={onBack}>
          Wstecz
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={handlePickFolder}
          disabled={loading}
        >
          {loading ? (
            'Wczytywanie…'
          ) : (
            <>
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
              Wybierz folder
            </>
          )}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
