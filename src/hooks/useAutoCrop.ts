import { useEffect, useState } from 'react';
import type { CropAspectRatio } from '../types';
import { aspectToRatioDimensions } from '../types';
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
  aspectRatio: CropAspectRatio;
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
 * Given a loaded image and session aspect ratio, returns an initial CropState
 * centered on the detected face (fallback: image center, scale = 1).
 */
export function useAutoCrop({
  image,
  imageWidth,
  imageHeight,
  aspectRatio,
  enabled = true,
}: UseAutoCropOptions): UseAutoCropResult {
  const [cropState, setCropState] = useState<CropState | null>(null);
  const [faceCenter, setFaceCenter] = useState<FaceCenter | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { width: ratioW, height: ratioH } = aspectToRatioDimensions(aspectRatio);

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
          ratioW,
          ratioH,
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
          setCropState(computeInitialCrop(imageWidth, imageHeight, ratioW, ratioH));
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
  }, [image, imageWidth, imageHeight, ratioW, ratioH, enabled]);

  return { cropState, faceCenter, loading, error };
}
