export type AppStep = 'dimensions' | 'folder' | 'crop';

export interface CropDimensions {
  width: number;
  height: number;
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
  dimensions: CropDimensions | null;
  directoryHandle: FileSystemDirectoryHandle | null;
  queue: QueuedImage[];
  currentIndex: number;
  savedCount: number;
  savedCrops: SavedCropsMap;
}

export const DIMENSION_PRESETS: CropDimensions[] = [
  { width: 300, height: 400, label: '300×400' },
  { width: 1920, height: 1080, label: '1920×1080' },
  { width: 1080, height: 1080, label: '1:1' },
  { width: 1600, height: 1200, label: '4:3' },
  { width: 1080, height: 1920, label: '9:16' },
];

export const SUPPORTED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

export function isSupportedImageFile(name: string): boolean {
  const lower = name.toLowerCase();
  return SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
