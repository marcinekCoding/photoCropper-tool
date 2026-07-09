import { useEffect, useState } from 'react';
import type { CropDimensions } from '../types';
import { computeInitialCrop, type CropState } from '../lib/crop.ts';
import {
  computeCenteredCrop,
  detectFaces,
  initFaceDetection,
  type FaceCenter,
} from '../lib/faceDetection.ts';

export interface UseAutoCropOptions {
  image: HTMLImageElement | ImageBitmap | null;
  imageWidth: number;
  imageHeight: number;
  dimensions: CropDimensions;
  enabled?: boolean;
}

export interface UseAutoCropResult {
  cropState: CropState | null;
  faceCenter: FaceCenter | null;
  loading: boolean;
  error: string | null;
}

function pickPrimaryFace(faces: FaceCenter[]): FaceCenter | null {
  return faces[0] ?? null;
}

/**
 * Given a loaded image and session dimensions, returns an initial CropState
 * centered on the detected face (fallback: image center, scale = 1).
 *
 * ## CropSession integration
 *
 * Call this hook in CropSession (or a thin wrapper) **before** rendering
 * CropWorkspace for the current queue item:
 *
 * 1. Load the current `QueuedImage` into an `HTMLImageElement` (or `ImageBitmap`).
 * 2. Wait for `naturalWidth` / `naturalHeight` (or bitmap dimensions).
 * 3. Pass those values to `useAutoCrop`.
 * 4. While `loading` is true, show a lightweight placeholder instead of CropWorkspace.
 * 5. When `cropState` is ready, render:
 *
 *    ```tsx
 *    <CropWorkspace
 *      image={currentImage.file}
 *      targetDimensions={dimensions}
 *      initialCropState={cropState}
 *      onAccept={(state) => {
 *        await exportCroppedImage({
 *          directoryHandle,
 *          fileName: currentImage.name,
 *          dimensions,
 *          cropState: state,
 *          sourceFile: currentImage.file,
 *        });
 *        onAccept();
 *      }}
 *      ...
 *    />
 *    ```
 *
 * Face detection only proposes offset — users can still pan/zoom in CropWorkspace.
 * Preload the model once at app start via `initFaceDetection()` to hide first-image latency.
 */
export function useAutoCrop({
  image,
  imageWidth,
  imageHeight,
  dimensions,
  enabled = true,
}: UseAutoCropOptions): UseAutoCropResult {
  const [cropState, setCropState] = useState<CropState | null>(null);
  const [faceCenter, setFaceCenter] = useState<FaceCenter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !image || imageWidth <= 0 || imageHeight <= 0) {
      setCropState(null);
      setFaceCenter(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        await initFaceDetection();
        const faces = await detectFaces(image);
        const primary = pickPrimaryFace(faces);
        const nextState = computeCenteredCrop(
          imageWidth,
          imageHeight,
          dimensions.width,
          dimensions.height,
          primary,
        );

        if (!cancelled) {
          setFaceCenter(primary);
          setCropState(nextState);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Wykrywanie twarzy nie powiodło się.',
          );
          setFaceCenter(null);
          setCropState(
            computeInitialCrop(
              imageWidth,
              imageHeight,
              dimensions.width,
              dimensions.height,
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [image, imageWidth, imageHeight, dimensions, enabled]);

  return { cropState, faceCenter, loading, error };
}
