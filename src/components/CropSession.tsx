import { useCallback, useEffect, useState } from 'react';
import type { CropDimensions, QueuedImage, SavedCropsMap } from '../types';
import type { CropState } from '../lib/crop';
import { exportCroppedImage } from '../lib/export';
import { detectFaceBoxes, initFaceDetection, proposeCropFromFaceBoxes } from '../lib/faceDetection';
import type { MultiFaceStatus } from '../lib/faceDetection';
import { CropWorkspace } from './CropWorkspace';

interface CropSessionProps {
  dimensions: CropDimensions;
  directoryHandle: FileSystemDirectoryHandle;
  queue: QueuedImage[];
  currentIndex: number;
  savedCount: number;
  savedCrops: SavedCropsMap;
  onAccept: (fileName: string, cropState: CropState) => void;
  onSkip: () => void;
  onBack: () => void;
  onRestart: () => void;
  onChangeFolder: () => void;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Nie udało się wczytać obrazu.'));
    };

    img.src = url;
  });
}

export function CropSession({
  dimensions,
  directoryHandle,
  queue,
  currentIndex,
  savedCount,
  savedCrops,
  onAccept,
  onSkip,
  onBack,
  onRestart,
  onChangeFolder,
}: CropSessionProps) {
  const currentImage = queue[currentIndex];
  const [initialCropState, setInitialCropState] = useState<CropState | undefined>();
  const [multiFaceStatus, setMultiFaceStatus] = useState<MultiFaceStatus>('none');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    void initFaceDetection();
  }, []);

  useEffect(() => {
    if (!currentImage) {
      return;
    }

    let cancelled = false;

    const prepareCropProposal = async () => {
      setInitialCropState(undefined);
      setMultiFaceStatus('none');
      setExportError(null);

      const savedCrop = savedCrops[currentImage.name];
      if (savedCrop) {
        setInitialCropState(savedCrop);
        return;
      }

      try {
        const img = await loadImageFromFile(currentImage.file);
        if (cancelled) {
          return;
        }

        const faceBoxes = await detectFaceBoxes(img);
        if (cancelled) {
          return;
        }

        const proposal = proposeCropFromFaceBoxes(
          img.naturalWidth,
          img.naturalHeight,
          { width: dimensions.width, height: dimensions.height },
          faceBoxes,
        );

        setInitialCropState(proposal.cropState);
        setMultiFaceStatus(proposal.multiFaceStatus);
      } catch {
        if (!cancelled) {
          setInitialCropState({ offsetX: 0, offsetY: 0, scale: 1 });
          setMultiFaceStatus('none');
        }
      }
    };

    void prepareCropProposal();

    return () => {
      cancelled = true;
    };
  }, [currentImage, dimensions.height, dimensions.width, savedCrops]);

  const handleAccept = useCallback(
    async (cropState: CropState) => {
      if (!currentImage || isExporting) {
        return;
      }

      setIsExporting(true);
      setExportError(null);

      try {
        await exportCroppedImage({
          directoryHandle,
          fileName: currentImage.name,
          dimensions,
          cropState,
          sourceFile: currentImage.file,
        });
        onAccept(currentImage.name, cropState);
      } catch {
        setExportError('Nie udało się zapisać pliku. Sprawdź uprawnienia do folderu.');
      } finally {
        setIsExporting(false);
      }
    },
    [currentImage, dimensions, directoryHandle, isExporting, onAccept],
  );

  if (!currentImage) {
    return (
      <section className="step-panel">
        <h2>Sesja zakończona</h2>
        <p className="step-description">
          Przetworzono {queue.length} zdjęć. Zapisano: {savedCount}.
        </p>
        <div className="action-row">
          <button type="button" className="secondary-button" onClick={onChangeFolder}>
            Wybierz inny folder
          </button>
          <button type="button" className="primary-button" onClick={onRestart}>
            Nowa sesja
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="crop-session">
      <header className="crop-session__header">
        <h2>Krok 3: Kadrowanie</h2>
        <p>
          {dimensions.label} ({dimensions.width} × {dimensions.height} px) · folder:{' '}
          {directoryHandle.name} · zapisane: {savedCount}
        </p>
      </header>

      {exportError && <p className="error-message">{exportError}</p>}

      <CropWorkspace
        key={`${currentIndex}-${currentImage.name}`}
        image={currentImage.file}
        targetDimensions={{ width: dimensions.width, height: dimensions.height }}
        initialCropState={initialCropState}
        multiFaceStatus={multiFaceStatus}
        onAccept={handleAccept}
        onSkip={onSkip}
        onBack={currentIndex > 0 ? onBack : undefined}
        index={currentIndex}
        total={queue.length}
        savedCount={savedCount}
        isResave={currentImage.name in savedCrops}
        isExporting={isExporting}
      />
    </section>
  );
}
