import type { CropState } from '../types.ts';

export type { CropState };

export interface Dimensions {
  width: number;
  height: number;
}

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 8;

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

function targetAspect(target: Dimensions): number {
  return target.width / target.height;
}

/** Największy prostokąt o proporcjach docelowych mieszczący się w obrazie (cover). */
export function getBaseCropSize(
  imageWidth: number,
  imageHeight: number,
  target: Dimensions,
): Dimensions {
  const aspect = targetAspect(target);
  const imageAspect = imageWidth / imageHeight;

  if (imageAspect > aspect) {
    return { width: imageHeight * aspect, height: imageHeight };
  }

  return { width: imageWidth, height: imageWidth / aspect };
}

/** Prostokąt wycięcia w pikselach obrazu źródłowego. */
export function getCropRect(
  imageWidth: number,
  imageHeight: number,
  target: Dimensions,
  cropState: CropState,
): CropRect {
  const scale = clampScale(cropState.scale);
  const base = getBaseCropSize(imageWidth, imageHeight, target);
  const width = base.width / scale;
  const height = base.height / scale;

  const centerX = imageWidth / 2 + cropState.offsetX;
  const centerY = imageHeight / 2 + cropState.offsetY;

  const x = clamp(centerX - width / 2, 0, imageWidth - width);
  const y = clamp(centerY - height / 2, 0, imageHeight - height);

  return { x, y, width, height };
}

/** Ogranicza offset tak, by kadr nie wychodził poza obraz. */
export function clampCropState(
  imageWidth: number,
  imageHeight: number,
  target: Dimensions,
  cropState: CropState,
): CropState {
  const scale = clampScale(cropState.scale);
  const base = getBaseCropSize(imageWidth, imageHeight, target);
  const cropW = base.width / scale;
  const cropH = base.height / scale;

  const maxOffsetX = Math.max(0, (imageWidth - cropW) / 2);
  const maxOffsetY = Math.max(0, (imageHeight - cropH) / 2);

  return {
    offsetX: clamp(cropState.offsetX, -maxOffsetX, maxOffsetX),
    offsetY: clamp(cropState.offsetY, -maxOffsetY, maxOffsetY),
    scale,
  };
}

export function computeInitialCrop(
  _imageWidth: number,
  _imageHeight: number,
  _targetWidth: number,
  _targetHeight: number,
): CropState {
  return { offsetX: 0, offsetY: 0, scale: 1 };
}

/** Rozmiar wyjściowy w px — natywna rozdzielczość wyciętego fragmentu (bez skalowania). */
export function getOutputPixelSize(
  imageWidth: number,
  imageHeight: number,
  aspect: Dimensions,
  cropState: CropState,
): Dimensions {
  const clamped = clampCropState(imageWidth, imageHeight, aspect, cropState);
  const rect = getCropRect(imageWidth, imageHeight, aspect, clamped);
  return {
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  };
}

export function applyCropToCanvas(
  image: CanvasImageSource & { width?: number; height?: number },
  cropState: CropState,
  aspect: Dimensions,
): HTMLCanvasElement {
  const imageWidth =
    'naturalWidth' in image && image.naturalWidth
      ? image.naturalWidth
      : (image.width ?? 0);
  const imageHeight =
    'naturalHeight' in image && image.naturalHeight
      ? image.naturalHeight
      : (image.height ?? 0);

  const clamped = clampCropState(imageWidth, imageHeight, aspect, cropState);
  const rect = getCropRect(imageWidth, imageHeight, aspect, clamped);

  const outW = Math.max(1, Math.round(rect.width));
  const outH = Math.max(1, Math.round(rect.height));

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return canvas;
  }

  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, outW, outH);

  return canvas;
}

export interface DisplayLayout {
  scale: number;
  offsetX: number;
  offsetY: number;
  displayWidth: number;
  displayHeight: number;
}

/** Skala i offset do wyświetlenia pełnego obrazu w kontenerze (object-fit: contain). */
export function computeImageDisplayLayout(
  imageWidth: number,
  imageHeight: number,
  containerWidth: number,
  containerHeight: number,
): DisplayLayout {
  const scale = Math.min(
    containerWidth / imageWidth,
    containerHeight / imageHeight,
    1,
  );
  const displayWidth = imageWidth * scale;
  const displayHeight = imageHeight * scale;

  return {
    scale,
    offsetX: (containerWidth - displayWidth) / 2,
    offsetY: (containerHeight - displayHeight) / 2,
    displayWidth,
    displayHeight,
  };
}

export function cropRectToDisplayRect(
  cropRect: CropRect,
  layout: DisplayLayout,
): CropRect {
  return {
    x: layout.offsetX + cropRect.x * layout.scale,
    y: layout.offsetY + cropRect.y * layout.scale,
    width: cropRect.width * layout.scale,
    height: cropRect.height * layout.scale,
  };
}

export function displayDeltaToSourceDelta(
  deltaDisplay: number,
  layout: DisplayLayout,
): number {
  if (layout.scale === 0) {
    return 0;
  }
  return deltaDisplay / layout.scale;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
