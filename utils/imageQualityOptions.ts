import { CameraView } from 'expo-camera';
import { RefObject } from 'react';

interface ImageQualityOption {
  label: string;
  value: string;
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
  console.log('Available picture sizes in generateImageQualityOptions:', sizes); // Print sizes first
  if (!sizes || sizes.length === 0) {
    throw new Error('No picture sizes available from camera');
  }

  const parsedSizes = sizes
    .map(size => {
      const [width, height] = size.split('x').map(Number);
      return { size, area: width * height };
    })
    .sort((a, b) => a.area - b.area);

  const selectedSizes = selectSizes(parsedSizes);

  return [
    {
      label: 'Low (Small size)',
      value: 'low',
      maxSize: selectedSizes[0].size,
      quality: 0.4,
      description: `${selectedSizes[0].size} resolution, 40% quality – fastest to upload`,
      icon: '🚀',
    },
    {
      label: 'Medium (Recommended)',
      value: 'medium',
      maxSize: selectedSizes[1].size,
      quality: 0.6,
      description: `${selectedSizes[1].size} resolution, 60% quality – good balance`,
      icon: '⚡',
    },
    {
      label: 'High (Better details)',
      value: 'high',
      maxSize: selectedSizes[2].size,
      quality: 0.8,
      description: `${selectedSizes[2].size} resolution, 80% quality – slower to upload`,
      icon: '✨',
    },
    {
      label: 'Original (No compression)',
      value: 'original',
      maxSize: selectedSizes[3].size,
      quality: 1.0,
      description: `${selectedSizes[3].size} resolution, 100% quality – large files`,
      icon: '💎',
    },
  ];
};

const selectSizes = (sizes: { size: string; area: number }[]): { size: string; area: number }[] => {
  const total = sizes.length;
  if (total < 4) {
    const largest = sizes[total - 1];
    return [...sizes, ...Array(4 - total).fill(largest)];
  }
  return [
    sizes[0],
    sizes[Math.floor(total / 3)],
    sizes[Math.floor((2 * total) / 3)],
    sizes[total - 1],
  ];
};