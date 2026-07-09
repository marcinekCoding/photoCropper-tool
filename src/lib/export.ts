import type { CropAspectRatio, CropState } from '../types';
import { aspectToRatioDimensions } from '../types';
import { applyCropToCanvas } from './crop.ts';

export interface ExportOptions {
  directoryHandle: FileSystemDirectoryHandle;
  fileName: string;
  aspectRatio: CropAspectRatio;
  cropState: CropState;
  sourceFile: File;
  outputSubfolder?: string;
}

export interface AcceptedCrop {
  fileName: string;
  sourceFile: File;
  cropState: CropState;
}

export interface ExportSessionOptions {
  directoryHandle: FileSystemDirectoryHandle;
  aspectRatio: CropAspectRatio;
  accepted: AcceptedCrop[];
  outputSubfolder?: string;
}

async function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);

  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error(`Nie udało się wczytać obrazu: ${file.name}`));
      image.src = url;
    });
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function resolveMimeType(file: File): string {
  if (file.type) {
    return file.type;
  }

  const lower = file.name.toLowerCase();
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Nie udało się utworzyć pliku obrazu.'));
        }
      },
      mimeType,
      mimeType === 'image/jpeg' ? 0.92 : undefined,
    );
  });
}

/** Ensure output subfolder exists inside the source directory. */
export async function ensureOutputDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  subfolderName = 'cropped',
): Promise<FileSystemDirectoryHandle> {
  return directoryHandle.getDirectoryHandle(subfolderName, { create: true });
}

/** Save a pre-rendered crop blob to a subfolder, keeping the original filename. */
export async function saveCroppedImage(
  directoryHandle: FileSystemDirectoryHandle,
  subfolderName: string,
  fileName: string,
  blob: Blob,
): Promise<void> {
  const outputDir = await ensureOutputDirectory(directoryHandle, subfolderName);
  const fileHandle = await outputDir.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable({ keepExistingData: false });

  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

/** Render and export a single accepted crop to the output subfolder. */
export async function exportCroppedImage(options: ExportOptions): Promise<void> {
  const {
    directoryHandle,
    fileName,
    aspectRatio,
    cropState,
    sourceFile,
    outputSubfolder = 'cropped',
  } = options;

  const image = await loadImageFromFile(sourceFile);
  const canvas = applyCropToCanvas(
    image,
    cropState,
    aspectToRatioDimensions(aspectRatio),
  );
  const blob = await canvasToBlob(canvas, resolveMimeType(sourceFile));

  await saveCroppedImage(directoryHandle, outputSubfolder, fileName, blob);
}

/** Save all accepted crops from a session, preserving original filenames. */
export async function exportSession(options: ExportSessionOptions): Promise<void> {
  const { directoryHandle, aspectRatio, accepted, outputSubfolder = 'cropped' } = options;

  for (const item of accepted) {
    await exportCroppedImage({
      directoryHandle,
      fileName: item.fileName,
      aspectRatio,
      cropState: item.cropState,
      sourceFile: item.sourceFile,
      outputSubfolder,
    });
  }
}
