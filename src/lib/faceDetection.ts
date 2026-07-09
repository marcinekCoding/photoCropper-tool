import {
  clampCropState,
  getBaseCropSize,
  type CropRect,
  type CropState,
  type Dimensions,
} from './crop.ts';

const MEDIAPIPE_BASE = `${import.meta.env.BASE_URL}mediapipe/face_detection/`;

type FaceDetectionModule = typeof import('@mediapipe/face_detection');
type FaceDetectionInstance = InstanceType<FaceDetectionModule['FaceDetection']>;
type FaceDetectionCtor = FaceDetectionModule['FaceDetection'];

export interface FaceCenter {
  centerX: number;
  centerY: number;
}

export interface FaceDetectionResult {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export type MultiFaceStatus = 'ok' | 'warning' | 'none';

export interface MultiFaceCropResult {
  cropState: CropState;
  multiFaceStatus: MultiFaceStatus;
}

const FACE_GROUP_MARGIN_FACTOR = 0.15;

let FaceDetectionClass: FaceDetectionCtor | null = null;
let detector: FaceDetectionInstance | null = null;
let initPromise: Promise<void> | null = null;
let detectionQueue: Promise<unknown> = Promise.resolve();

function toInputImage(image: HTMLImageElement | ImageBitmap): HTMLImageElement | HTMLCanvasElement {
  if (image instanceof HTMLImageElement) {
    return image;
  }

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Nie udało się przygotować obrazu do wykrywania twarzy.');
  }
  ctx.drawImage(image, 0, 0);
  return canvas;
}

function getImageSize(image: HTMLImageElement | HTMLCanvasElement): Dimensions {
  if (image instanceof HTMLImageElement) {
    return {
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
  }

  return { width: image.width, height: image.height };
}

function normalizedBoxToPixels(
  box: { xCenter: number; yCenter: number; width: number; height: number },
  imageWidth: number,
  imageHeight: number,
): FaceDetectionResult {
  const width = box.width * imageWidth;
  const height = box.height * imageHeight;
  const centerX = box.xCenter * imageWidth;
  const centerY = box.yCenter * imageHeight;

  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height,
    confidence: 1,
  };
}

function pickPrimaryFaceBox(faces: FaceDetectionResult[]): FaceDetectionResult | null {
  if (faces.length === 0) {
    return null;
  }

  return faces.reduce((best, face) =>
    face.width * face.height > best.width * best.height ? face : best,
  );
}

function runQueued<T>(task: () => Promise<T>): Promise<T> {
  const next = detectionQueue.then(task, task);
  detectionQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function detectFaceBoxesInternal(
  image: HTMLImageElement | ImageBitmap,
): Promise<FaceDetectionResult[]> {
  if (!detector) {
    throw new Error('Model wykrywania twarzy nie został zainicjalizowany.');
  }

  const input = toInputImage(image);
  const { width, height } = getImageSize(input);

  return new Promise((resolve, reject) => {
    detector!.onResults((results) => {
      resolve(
        results.detections.map((detection) =>
          normalizedBoxToPixels(detection.boundingBox, width, height),
        ),
      );
    });

    detector!.send({ image: input }).catch(reject);
  });
}

async function loadFaceDetectionClass(): Promise<FaceDetectionCtor> {
  if (!FaceDetectionClass) {
    const mod = await import('@mediapipe/face_detection');
    FaceDetectionClass = mod.FaceDetection;
  }
  return FaceDetectionClass;
}

/** Load MediaPipe Face Detection model once and reuse across images. */
export async function initFaceDetection(): Promise<void> {
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const FaceDetection = await loadFaceDetectionClass();
    const instance = new FaceDetection({
      locateFile: (file: string) => `${MEDIAPIPE_BASE}${file}`,
    });

    instance.setOptions({
      model: 'short',
      minDetectionConfidence: 0.5,
    });

    await instance.initialize();
    detector = instance;
  })();

  return initPromise;
}

/** Detect faces and return center points in image pixel coordinates. */
export async function detectFaces(
  image: HTMLImageElement | ImageBitmap,
): Promise<FaceCenter[]> {
  await initFaceDetection();

  const boxes = await runQueued(() => detectFaceBoxesInternal(image));
  return boxes.map((face) => ({
    centerX: face.x + face.width / 2,
    centerY: face.y + face.height / 2,
  }));
}

/** Detect faces and return bounding boxes in image coordinates. */
export async function detectFaceBoxes(
  image: HTMLImageElement | ImageBitmap,
): Promise<FaceDetectionResult[]> {
  await initFaceDetection();
  return runQueued(() => detectFaceBoxesInternal(image));
}

/**
 * Compute initial crop offset to center on a face (or image center when absent).
 * Does not change scale — only offsetX/offsetY are adjusted.
 */
export function computeCenteredCrop(
  imageW: number,
  imageH: number,
  targetW: number,
  targetH: number,
  faceCenter?: FaceCenter | null,
): CropState {
  const centerX = faceCenter?.centerX ?? imageW / 2;
  const centerY = faceCenter?.centerY ?? imageH / 2;
  const target: Dimensions = { width: targetW, height: targetH };

  return clampCropState(imageW, imageH, target, {
    offsetX: centerX - imageW / 2,
    offsetY: centerY - imageH / 2,
    scale: 1,
  });
}

/** Center an existing crop rect on the primary face without changing its size. */
export function centerCropOnFace(
  cropRect: { x: number; y: number; width: number; height: number },
  faces: FaceDetectionResult[],
  imageWidth: number,
  imageHeight: number,
): { x: number; y: number; width: number; height: number } {
  const primary = pickPrimaryFaceBox(faces);
  if (!primary) {
    return cropRect;
  }

  const faceCenterX = primary.x + primary.width / 2;
  const faceCenterY = primary.y + primary.height / 2;
  const cropCenterX = cropRect.x + cropRect.width / 2;
  const cropCenterY = cropRect.y + cropRect.height / 2;

  const deltaX = faceCenterX - cropCenterX;
  const deltaY = faceCenterY - cropCenterY;

  const maxX = Math.max(0, imageWidth - cropRect.width);
  const maxY = Math.max(0, imageHeight - cropRect.height);

  return {
    ...cropRect,
    x: clamp(cropRect.x + deltaX, 0, maxX),
    y: clamp(cropRect.y + deltaY, 0, maxY),
  };
}

function getFacesUnionBBox(
  faces: FaceDetectionResult[],
  marginFactor: number,
): { x: number; y: number; width: number; height: number } | null {
  if (faces.length === 0) {
    return null;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const face of faces) {
    minX = Math.min(minX, face.x);
    minY = Math.min(minY, face.y);
    maxX = Math.max(maxX, face.x + face.width);
    maxY = Math.max(maxY, face.y + face.height);
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const marginX = width * marginFactor;
  const marginY = height * marginFactor;

  return {
    x: minX - marginX,
    y: minY - marginY,
    width: width + marginX * 2,
    height: height + marginY * 2,
  };
}

function faceBoxContainedInCrop(face: FaceDetectionResult, crop: CropRect): boolean {
  return (
    face.x >= crop.x &&
    face.y >= crop.y &&
    face.x + face.width <= crop.x + crop.width &&
    face.y + face.height <= crop.y + crop.height
  );
}

function allFacesFitInCrop(faces: FaceDetectionResult[], crop: CropRect): boolean {
  return faces.every((face) => faceBoxContainedInCrop(face, crop));
}

function cropRectToCropState(
  rect: CropRect,
  imageW: number,
  imageH: number,
  target: Dimensions,
): CropState {
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  return clampCropState(imageW, imageH, target, {
    offsetX: centerX - imageW / 2,
    offsetY: centerY - imageH / 2,
    scale: 1,
  });
}

function bestEffortGroupCrop(
  imageW: number,
  imageH: number,
  target: Dimensions,
  faces: FaceDetectionResult[],
): CropState {
  const union = getFacesUnionBBox(faces, FACE_GROUP_MARGIN_FACTOR);
  if (!union) {
    return computeCenteredCrop(imageW, imageH, target.width, target.height, null);
  }

  const centerX = union.x + union.width / 2;
  const centerY = union.y + union.height / 2;
  return computeCenteredCrop(imageW, imageH, target.width, target.height, {
    centerX,
    centerY,
  });
}

/**
 * Propose crop for detected faces. Single face: center on it. Multiple faces:
 * try to fit all bounding boxes in the crop at scale=1; set warning when impossible.
 */
export function proposeCropFromFaceBoxes(
  imageW: number,
  imageH: number,
  target: Dimensions,
  faces: FaceDetectionResult[],
): MultiFaceCropResult {
  if (faces.length === 0) {
    return {
      cropState: computeCenteredCrop(imageW, imageH, target.width, target.height, null),
      multiFaceStatus: 'none',
    };
  }

  if (faces.length === 1) {
    const face = faces[0];
    return {
      cropState: computeCenteredCrop(imageW, imageH, target.width, target.height, {
        centerX: face.x + face.width / 2,
        centerY: face.y + face.height / 2,
      }),
      multiFaceStatus: 'none',
    };
  }

  const baseCrop = getBaseCropSize(imageW, imageH, target);
  const cropW = baseCrop.width;
  const cropH = baseCrop.height;
  const union = getFacesUnionBBox(faces, FACE_GROUP_MARGIN_FACTOR)!;

  if (union.width > cropW || union.height > cropH) {
    return {
      cropState: bestEffortGroupCrop(imageW, imageH, target, faces),
      multiFaceStatus: 'warning',
    };
  }

  const minCropX = Math.max(...faces.map((face) => face.x + face.width - cropW), 0);
  const maxCropX = Math.min(...faces.map((face) => face.x), imageW - cropW);
  const minCropY = Math.max(...faces.map((face) => face.y + face.height - cropH), 0);
  const maxCropY = Math.min(...faces.map((face) => face.y), imageH - cropH);

  if (minCropX > maxCropX || minCropY > maxCropY) {
    return {
      cropState: bestEffortGroupCrop(imageW, imageH, target, faces),
      multiFaceStatus: 'warning',
    };
  }

  const preferredX = union.x + union.width / 2 - cropW / 2;
  const preferredY = union.y + union.height / 2 - cropH / 2;
  const cropRect: CropRect = {
    x: clamp(preferredX, minCropX, maxCropX),
    y: clamp(preferredY, minCropY, maxCropY),
    width: cropW,
    height: cropH,
  };

  if (!allFacesFitInCrop(faces, cropRect)) {
    return {
      cropState: cropRectToCropState(cropRect, imageW, imageH, target),
      multiFaceStatus: 'warning',
    };
  }

  return {
    cropState: cropRectToCropState(cropRect, imageW, imageH, target),
    multiFaceStatus: 'ok',
  };
}

/** Alias used by CropSession — centers crop on primary detected face. */
export function proposeCropStateFromFaces(
  imageW: number,
  imageH: number,
  target: Dimensions,
  faces: FaceCenter[],
): CropState {
  const primary = faces[0] ?? null;
  return computeCenteredCrop(imageW, imageH, target.width, target.height, primary);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
