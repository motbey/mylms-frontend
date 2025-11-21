import pica from 'pica';
import type { Area } from 'react-easy-crop';

const picaInstance = pica();

export interface ProcessedImageResult {
  blob: Blob;
  dataUrl: string;
}

export interface ImageTransformations {
  crop: Area;
  rotation?: number;
  zoom?: number;
  targetWidth?: number | null;
  format?: 'webp' | 'png';
  quality?: number;
}

// Helper to create an image from a URL, handling CORS
function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    // This is important for fetching images from Supabase Storage or other CDNs
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

// Function to get the rotated bounding box
function getRotatedSize(width: number, height: number, rotation: number): { width: number; height: number } {
  const rads = (rotation * Math.PI) / 180;
  const absRads = Math.abs(rads);
  const newWidth = height * Math.abs(Math.sin(absRads)) + width * Math.abs(Math.cos(absRads));
  const newHeight = width * Math.abs(Math.sin(absRads)) + height * Math.abs(Math.cos(absRads));
  return { width: newWidth, height: newHeight };
}

/**
 * Processes an image with cropping, rotation, and resizing.
 * @param imageUrl The URL of the image to process.
 * @param transform The transformation settings.
 * @returns A promise that resolves with the processed image blob and data URL.
 */
export async function processImage(
  imageUrl: string,
  transform: ImageTransformations
): Promise<ProcessedImageResult> {
  const image = await createImage(imageUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  const rotation = transform.rotation || 0;
  const rads = (rotation * Math.PI) / 180;

  // Calculate the bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = getRotatedSize(
    image.width,
    image.height,
    rotation
  );

  // Set the canvas size to the bounding box to prevent clipping
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Translate to the center of the canvas and rotate
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rads);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  // Get the data from the rotated canvas
  const rotatedData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Now, crop from the rotated canvas data
  canvas.width = transform.crop.width;
  canvas.height = transform.crop.height;

  // Clear and draw the cropped part of the rotated image
  ctx.putImageData(
    rotatedData,
    Math.round(-bBoxWidth / 2 + image.width / 2 - transform.crop.x),
    Math.round(-bBoxHeight / 2 + image.height / 2 - transform.crop.y)
  );

  // Resize with pica if needed
  let finalCanvas = canvas;
  if (transform.targetWidth && transform.targetWidth < canvas.width) {
    const resizedCanvas = document.createElement('canvas');
    const aspectRatio = canvas.height / canvas.width;
    resizedCanvas.width = transform.targetWidth;
    resizedCanvas.height = Math.round(transform.targetWidth * aspectRatio);

    await picaInstance.resize(canvas, resizedCanvas);
    finalCanvas = resizedCanvas;
  }

  // Get the final result as a blob
  return new Promise((resolve, reject) => {
    const mimeType = transform.format === 'png' ? 'image/png' : 'image/webp';
    const quality = (transform.quality || 80) / 100;
    
    finalCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas to Blob conversion failed.'));
          return;
        }
        // Use URL.createObjectURL instead of toDataURL for better performance
        const objectUrl = URL.createObjectURL(blob);
        resolve({ blob, dataUrl: objectUrl });
      },
      mimeType,
      quality
    );
  });
}