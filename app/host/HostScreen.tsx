import { useLocalSearchParams, useRouter } from 'expo-router';
import Video from "expo-video";
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const HostScreen = () => {
  const { path, type } = useLocalSearchParams();
  const [uploading, setUploading] = useState(true);
  const [uploadStatus, setUploadStatus] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!path || !type) {
      setUploadStatus('No media found.');
      setUploading(false);
      return;
    }

    const handleUpload = async () => {
      try {
        setUploading(true);
        setUploadStatus('Uploading...');

        // Simulate upload delay
        await new Promise(resolve => setTimeout(resolve, 1000));



        // Delete file after upload
         setUploadStatus('waiting to upload the file');
      } catch (error) {
        console.error('Upload error:', error);
        setUploadStatus('Upload failed.');
      } finally {
        setUploading(false);
      }
    };

    handleUpload();
  }, [path, type]);

  return (
    <View style={styles.container}>
      {uploading && <ActivityIndicator size="large" />}
      {uploadStatus !== '' && <Text style={styles.status}>{uploadStatus}</Text>}

      {type === 'photo' && path && (
        <Image source={{ uri: String(path) }} style={styles.preview} resizeMode="contain" />
      )}
      {type === 'video' && path && (
        <Video
          source={{ uri: String(path) }}
          style={styles.preview}
          useNativeControls
          resizeMode="contain"
          shouldPlay
        />
      )}

      <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/tabs')}>
        <Text style={styles.backText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
};

export default HostScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  status: {
    color: '#fff',
    marginVertical: 12,
  },
  preview: {
    width: '100%',
    height: 300,
    marginTop: 10,
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: '#1e90ff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backText: {
    color: 'white',
    fontSize: 16,
  },
});
