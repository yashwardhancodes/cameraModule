// ../../utils/MediaUtils.ts
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';

/**
 * Save photo to internal storage and return a local file URI for preview
 */
export const compressAndSaveImage = async (
  uri: string,
  quality: number = 0.6,
  size: number = 1024
): Promise<string> => {
  // Ensure captures directory exists
  await ensureCaptureDirectory();

  // Compress the image
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: size } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  // Copy to persistent location for preview
  const persistentPath = `${FileSystem.documentDirectory}captures/${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: manipResult.uri, to: persistentPath });

  // Verify the file exists
  const fileInfo = await FileSystem.getInfoAsync(persistentPath);
  if (!fileInfo.exists) {
    throw new Error(`Failed to copy image to ${persistentPath}`);
  }

  // Return the persistent local path for preview
  const finalUri = persistentPath.startsWith('file://') ? persistentPath : `file://${persistentPath}`;
  return finalUri;
};

/**
 * Save video to internal storage and return a persistent URI
 */
export const saveVideoToGallery = async (uri: string): Promise<string> => {
  // Ensure captures directory exists
  await ensureCaptureDirectory();

  // Copy video to a persistent location
  const extension = uri.split('.').pop()?.split('?')[0] || 'mp4';
  const persistentPath = `${FileSystem.documentDirectory}captures/${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: persistentPath });

  // Verify the file exists
  const fileInfo = await FileSystem.getInfoAsync(persistentPath);
  if (!fileInfo.exists) {
    throw new Error(`Failed to copy video to ${persistentPath}`);
  }

  // Return the persistent path for preview
  const finalUri = persistentPath.startsWith('file://') ? persistentPath : `file://${persistentPath}`;
  return finalUri;
};

/**
 * Generate a video thumbnail.
 */
export const getVideoThumbnail = async (uri: string, timeMs = 1000): Promise<string> => {
  const { uri: thumbnailUri } = await VideoThumbnails.getThumbnailAsync(uri, {
    time: timeMs,
  });
  return thumbnailUri;
};

/**
 * Compress an image and return internal storage path
 */
export const compressImage = async (
  uri: string,
  quality: number = 0.6,
  size: number = 1024
): Promise<string> => {
  await ensureCaptureDirectory();
  
  const manipResult = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: size } }],
    {
      compress: quality,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  const newPath = `${FileSystem.documentDirectory}captures/${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: manipResult.uri, to: newPath });

  return newPath;
};

/**
 * Save video to internal storage and return new path
 */
export const saveVideo = async (uri: string): Promise<string> => {
  await ensureCaptureDirectory();
  
  const extension = uri.split('.').pop()?.split('?')[0] || 'mp4';
  const newPath = `${FileSystem.documentDirectory}captures/${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: newPath });
  return newPath;
};

/**
 * Delete a file from internal storage
 */
export const deleteFile = async (path: string): Promise<void> => {
  const fileInfo = await FileSystem.getInfoAsync(path);
  if (fileInfo.exists) {
    await FileSystem.deleteAsync(path, { idempotent: true });
  }
};

/**
 * Ensure internal capture directory exists
 */
export const ensureCaptureDirectory = async (): Promise<void> => {
  const dir = `${FileSystem.documentDirectory}captures`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
};


/**
 * Get the size of a file at a given URI (in bytes)
 */
export const getFileSize = async (uri: string): Promise<number> => {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists || typeof info.size !== 'number') {
    throw new Error(`Cannot get size for file: ${uri}`);
  }
  return info.size;
};
