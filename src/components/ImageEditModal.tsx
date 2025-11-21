import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area, Point } from 'react-easy-crop';
import { processImage } from '../lib/imageUtils';

export interface ImageEditResult {
  blob: Blob;
  dataUrl: string;
  meta: {
    crop: Area;
    zoom: number;
    rotation: number;
    targetWidth: number | null;
    format: 'webp' | 'png';
    quality: number;
  };
}

interface ImageEditModalProps {
  open: boolean;
  imageUrl: string;
  onClose: () => void;
  onConfirm: (result: ImageEditResult) => void;
}

const ImageEditModal: React.FC<ImageEditModalProps> = ({ open, imageUrl, onClose, onConfirm }) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const [targetWidth, setTargetWidth] = useState<number | null>(1200);
  const [quality, setQuality] = useState(80);
  const [format, setFormat] = useState<'webp' | 'png'>('webp');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    setError(null);
    try {
      const result = await processImage(imageUrl, {
        crop: croppedAreaPixels,
        rotation,
        targetWidth,
        quality,
        format,
      });

      onConfirm({
        blob: result.blob,
        dataUrl: result.dataUrl,
        meta: {
          crop: croppedAreaPixels,
          zoom,
          rotation,
          targetWidth,
          format,
          quality,
        },
      });
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to process image.');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onMouseDown={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onMouseDown={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Edit Image</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl font-light">&times;</button>
        </div>

        <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto">
          {/* Cropper */}
          <div className="md:col-span-2 relative bg-gray-200">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Controls */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Aspect Ratio</label>
              <div className="mt-1 flex gap-2">
                {[
                  { label: 'Free', value: undefined },
                  { label: '1:1', value: 1 },
                  { label: '4:3', value: 4 / 3 },
                  { label: '16:9', value: 16 / 9 },
                ].map(item => (
                  <button key={item.label} onClick={() => setAspect(item.value)} className={`px-2 py-1 text-xs rounded ${aspect === item.value ? 'bg-secondary text-white' : 'bg-gray-200'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Zoom ({zoom.toFixed(1)})</label>
              <input type="range" min="1" max="3" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Rotation ({rotation}°)</label>
              <input type="range" min="0" max="360" step="1" value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="w-full" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Output Size</label>
              <select value={targetWidth ?? 0} onChange={(e) => setTargetWidth(Number(e.target.value) || null)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                <option value="0">Original</option>
                <option value="1600">1600px wide</option>
                <option value="1200">1200px wide</option>
                <option value="800">800px wide</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Quality ({quality}%)</label>
              <input type="range" min="60" max="90" step="5" value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="w-full" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Format</label>
              <div className="mt-1 flex gap-2">
                <button onClick={() => setFormat('webp')} className={`px-2 py-1 text-xs rounded ${format === 'webp' ? 'bg-secondary text-white' : 'bg-gray-200'}`}>WebP</button>
                <button onClick={() => setFormat('png')} className={`px-2 py-1 text-xs rounded ${format === 'png' ? 'bg-secondary text-white' : 'bg-gray-200'}`}>PNG</button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 flex justify-between items-center">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex-grow"></div>
            <div className="flex gap-3">
                <button onClick={onClose} disabled={isProcessing} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300">Cancel</button>
                <button onClick={handleConfirm} disabled={isProcessing} className="px-4 py-2 bg-secondary text-white rounded-md hover:opacity-90 disabled:bg-gray-400">
                    {isProcessing ? 'Processing...' : 'Save Image'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ImageEditModal;
