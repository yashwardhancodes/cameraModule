import { CameraView } from 'expo-camera';
import { RefObject } from 'react';

interface ImageQualityOption {
  maxSize: string;
  quality: number;
  description: string;
  icon: string;
}

export const generateImageQualityOptions = async (cameraRef: RefObject<CameraView | null>): Promise<ImageQualityOption[]> => {
  if (!cameraRef.current) {
    throw new Error('Camera reference is not available');
  }

  const sizes = await cameraRef.current.getAvailablePictureSizesAsync();
  console.log('Available picture sizes in generateImageQualityOptions:', sizes);
  if (!sizes || sizes.length === 0) {
    throw new Error('No picture sizes available from camera');
  }

  return sizes.map((size, index) => ({
    maxSize: size,
    quality: Math.min(0.4 + (index * 0.2), 1.0),
    description: `${size} resolution, ${Math.round((0.4 + (index * 0.2)) * 100)}% quality`,
    icon: '📸',
  }));
};