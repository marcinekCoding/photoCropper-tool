export type AppStep = 'dimensions' | 'folder' | 'crop';

/** Proporcje kadru — bez wymuszania rozdzielczości wyjściowej w px. */
export interface CropAspectRatio {
  ratioW: number;
  ratioH: number;
  label: string;
}

export interface QueuedImage {
  file: File;
  name: string;
  relativePath: string;
}

export interface CropState {
  offsetX: number;
  offsetY: number;
  scale: number;
}

/** Last accepted crop per source filename (used for undo + re-save overwrite). */
export type SavedCropsMap = Record<string, CropState>;

export interface SessionState {
  step: AppStep;
  aspectRatio: CropAspectRatio | null;
  directoryHandle: FileSystemDirectoryHandle | null;
  queue: QueuedImage[];
  currentIndex: number;
  savedCount: number;
  savedCrops: SavedCropsMap;
}

export const ASPECT_PRESETS: CropAspectRatio[] = [
  { ratioW: 3, ratioH: 4, label: 'Portret 3:4' },
  { ratioW: 16, ratioH: 9, label: 'Panorama 16:9' },
  { ratioW: 1, ratioH: 1, label: 'Kwadrat 1:1' },
  { ratioW: 4, ratioH: 3, label: 'Klasyczny 4:3' },
  { ratioW: 9, ratioH: 16, label: 'Story 9:16' },
];

export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export function isSupportedImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

/** Skrócony zapis proporcji, np. 16:9. */
export function formatAspectRatio(ratioW: number, ratioH: number): string {
  const g = gcd(ratioW, ratioH);
  return `${ratioW / g}:${ratioH / g}`;
}

/** Do obliczeń kadru — width/height jako proporcja, nie docelowe px. */
export function aspectToRatioDimensions(aspect: CropAspectRatio): {
  width: number;
  height: number;
} {
  return { width: aspect.ratioW, height: aspect.ratioH };
}
