import { useState } from 'react';
import type { CropDimensions, QueuedImage } from '../types';
import { isSupportedImageFile } from '../types';

interface FolderPickerProps {
  dimensions: CropDimensions;
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

export function FolderPicker({ dimensions, onSelect, onBack }: FolderPickerProps) {
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
        Wybrany wymiar: <strong>{dimensions.label}</strong> ({dimensions.width} ×{' '}
        {dimensions.height} px)
      </p>
      <p className="step-description">
        Wczytane zostaną wszystkie pliki JPG, PNG i WebP z wybranego folderu.
      </p>

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
          {loading ? 'Wczytywanie…' : 'Wybierz folder'}
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}
    </section>
  );
}
