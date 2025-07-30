import { Audio, Video } from 'expo-av';
import { BlurView } from 'expo-blur';
import {
  CameraType,
  CameraView,
  FlashMode,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Camera,
  Check,
  Loader,
  RefreshCw,
  RotateCcw,
  Sun,
  Video as VideoIcon,
  X,
  Zap,
  ZapOff,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { compressAndSaveImage, getFileSize, saveVideoToGallery } from '../../utils/MediaUtils';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const imageQualityOptions = [
  {
    label: 'Low (Small size)',
    value: 'low',
    maxSize: 640,
    quality: 0.4,
    description: '640px max, 40% quality – fastest to upload',
    icon: '🚀',
  },
  {
    label: 'Medium (Recommended)',
    value: 'medium',
    maxSize: 1024,
    quality: 0.6,
    description: '1024px max, 60% quality – good balance',
    icon: '⚡',
  },
  {
    label: 'High (Better details)',
    value: 'high',
    maxSize: 1600,
    quality: 0.8,
    description: '1600px max, 80% quality – slower to upload',
    icon: '✨',
  },
  {
    label: 'Original (No compression)',
    value: 'original',
    maxSize: null,
    quality: 1.0,
    description: 'Original size and quality – large files',
    icon: '💎',
  },
];

const videoQualityOptions = [
  {
    label: 'Very Low',
    value: '4:3',
    description: 'Minimal file size, fastest upload, low clarity',
    icon: '🚀',
  },
  {
    label: 'Low (480p)',
    value: '480p',
    description: 'Faster upload, basic visibility',
    icon: '📱',
  },
  {
    label: 'Medium (720p)',
    value: '720p',
    description: 'Good balance of quality and file size',
    icon: '⚡',
  },
  {
    label: 'High (1080p)',
    value: '1080p',
    description: 'Sharp quality, larger file size',
    icon: '✨',
  },
  {
    label: 'Ultra (4K)',
    value: '2160p',
    description: 'Best quality, largest file size',
    icon: '💎',
  },
];

const DEFAULT_QUALITY = 0.6;
const DEFAULT_MAX_SIZE_PX = 1024;
const DEFAULT_VIDEO_PRESET = '480p';

const CameraScreen = () => {
  const cameraRef = useRef<CameraView | null>(null);
  const containerRef = useRef<View | null>(null);
  const router = useRouter();
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const rawParams = useLocalSearchParams();
  const mode = (rawParams.mode as 'photo' | 'video') ?? 'photo';

  const [selectedQuality, setSelectedQuality] = useState(imageQualityOptions[1]);
  const [selectedVideoQuality, setSelectedVideoQuality] = useState(videoQualityOptions[2]);
  const quality = selectedQuality.quality;
  const maxSizePx = selectedQuality.maxSize || DEFAULT_MAX_SIZE_PX;
  const videoPreset = selectedVideoQuality.value;
  const [cameraReady, setCameraReady] = useState(false);
  const [flash, setFlash] = useState<FlashMode>('off');
  const [cameraType, setCameraType] = useState<CameraType>('back');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'photo' | 'video' | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [recordingTime, setRecordingTime] = useState<number>(0);
  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const [showQualitySelector, setShowQualitySelector] = useState<boolean>(false);
  const [showFocus, setShowFocus] = useState<boolean>(false);
  const currentModeRef = useRef(mode);
  const isRecordingRef = useRef(false);

  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

  const startRecording = () => {
    setRecordingStartTime(Date.now());
    setIsRecording(true);
  };

  const canStopRecording = () => {
    if (!recordingStartTime) return false;
    return Date.now() - recordingStartTime >= 1000;
  };


  useEffect(() => {
    currentModeRef.current = mode;
    isRecordingRef.current = isRecording;
  }, [mode, isRecording]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording]);

  useEffect(() => {
    setPreviewUri(null);
    setPreviewType(null);
    setRecordingTime(0);

    if (isRecordingRef.current) {
      handleStopRecording(true);
    }

    return () => {
      if (isRecordingRef.current) {
        handleStopRecording(true);
      }
    };
  }, [mode]);

  const handleFocus = (event: any) => {
    const { nativeEvent } = event;
    const { locationX, locationY, pageX, pageY } = nativeEvent;

    // Use locationX and locationY for more accurate positioning
    let x = locationX;
    let y = locationY;

    // If locationX/locationY are not available, fall back to pageX/pageY
    if (x === undefined || y === undefined) {
      x = pageX;
      y = pageY;
    }

    // Ensure the focus point is within bounds
    const clampedX = Math.max(50, Math.min(screenWidth - 50, x));
    const clampedY = Math.max(50, Math.min(screenHeight - 50, y));

    setFocusPoint({ x: clampedX, y: clampedY });

    // Haptic feedback for better UX
    Haptics.selectionAsync();

    // COMPLETELY REPLACED: Simple timeout-based focus indicator
    setShowFocus(true);
    setTimeout(() => {
      setShowFocus(false);
      setFocusPoint(null);
    }, 1200);
  };

  const toggleFlash = () => {
    setFlash((prev: FlashMode) =>
      prev === 'off' ? 'on' : prev === 'on' ? 'auto' : 'off'
    );
  };

  const toggleCamera = () => {
    setCameraType((prev: CameraType) => (prev === 'back' ? 'front' : 'back'));
  };

  const handleStopRecording = async (discard: boolean = false) => {
    if (!cameraRef.current || !isRecordingRef.current) return;

    try {
      await cameraRef.current.stopRecording();
    } catch (error) {
      console.warn('Error stopping recording:', error);
    } finally {
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

 const handleShutter = async () => {
  setIsCameraLoading(true);

  if (!cameraRef.current) {
    setIsCameraLoading(false);
    return;
  }

  await Haptics.selectionAsync();

  if (currentModeRef.current === 'photo') {
    // PHOTO MODE
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 1,
        skipProcessing: true,
      });

      if (photo) {
        setLoading(true); // separate from camera loading
        const savedPath = await compressAndSaveImage(photo.uri, quality, maxSizePx);
        setPreviewUri(savedPath);
        setPreviewType('photo');
        setLoading(false);
      }
    } catch (error) {
      console.error('Photo capture error:', error);
      setLoading(false);
    } finally {
      setIsCameraLoading(false);
    }
  } else {
    // VIDEO MODE

    if (!micPermission?.granted) {
      await requestMicPermission();
      setIsCameraLoading(false);
      return;
    }

    if (isRecordingRef.current) {
      // STOP recording — but check if 1 second has passed
      const now = Date.now();
      if (recordingStartTime && now - recordingStartTime < 1000) {
         setIsCameraLoading(false);
        return;
      }

      await handleStopRecording(); // Your logic to stop recording
      setIsCameraLoading(false);
      return;
    }

    // START recording
    try {
      const { sound } = await Audio.Sound.createAsync(require('../../assets/shutter.mp3'));
      await sound.playAsync();
      sound.unloadAsync();
    } catch (error) {
      console.warn('Failed to play shutter sound:', error);
    }

    setRecordingStartTime(Date.now());
    setIsRecording(true);
    isRecordingRef.current = true;
    setRecordingTime(0);

    try {
      const video = await cameraRef.current.recordAsync({ quality: videoPreset });

      if (currentModeRef.current === 'video' && video) {
        const savedUri = await saveVideoToGallery(video.uri);
        const finalUri = savedUri.startsWith('file://') ? savedUri : `file://${savedUri}`;
        setPreviewUri(finalUri);
        setPreviewType('video');
      } else if (video?.uri) {
        try {
          await FileSystem.deleteAsync(video.uri);
        } catch (error) {
          console.warn('Failed to delete temp video:', error);
        }
      }
    } catch (error) {
      console.error('Video record error:', error);
    } finally {
      setIsRecording(false);
      isRecordingRef.current = false;
      setIsCameraLoading(false);
    }
  }
};



  const handleConfirm = async () => {
    if (!previewUri || !previewType) return;

    try {
      const fileSize = await getFileSize(previewUri);

      router.replace({
        pathname: '/',
        params: {
          path: previewUri,
          type: previewType,
          size: fileSize.toString(),
        },
      });
    } catch (error) {
      console.error('Failed to get file size:', error);
    }
  };

  const handleRetake = () => {
    setPreviewUri(null);
    setPreviewType(null);
    setRecordingTime(0);
  };


  if (loading) {
    return (
      <LinearGradient
        colors={['#000', '#1a1a1a']}
        style={styles.loadingContainer}
      >
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            {currentModeRef.current === 'photo' ? 'Processing photo...' : 'Processing video...'}
          </Text>
          <View style={styles.loadingProgress}>
            <View style={styles.loadingBar} />
          </View>
        </View>
      </LinearGradient>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getFlashIcon = () => {
    switch (flash) {
      case 'on': return <Zap size={24} color="white" />;
      case 'auto': return <Sun size={24} color="white" />;
      default: return <ZapOff size={24} color="white" />;
    }
  };

  return (
    <View style={styles.container} ref={containerRef}>
      {!previewUri ? (
        <>
          {!cameraReady && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading camera...</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.cameraTouchable}
            activeOpacity={1}
            onPress={handleFocus}
            onLayout={(event) => {
              const { width, height } = event.nativeEvent.layout;
             }}
          >
            <CameraView
              ref={cameraRef}
              style={styles.camera}
              facing={cameraType}
              flash={flash}
              mode={mode}
              onCameraReady={() => setCameraReady(true)}
              videoQuality={videoPreset}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
               }}
            />



            {/* COMPLETELY REPLACED FOCUS INDICATOR - NO ANIMATIONS */}
            {focusPoint && showFocus && (
              <View
                style={[
                  styles.focusBox,
                  {
                    left: focusPoint.x - 40,
                    top: focusPoint.y - 40,
                  },
                ]}
              >
                <View style={styles.focusRing} />
              </View>
            )}

            {/* Top overlay controls */}
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'transparent']}
              style={styles.topOverlay}
            >
              <View style={styles.topControls}>
                <TouchableOpacity onPress={() => router.back()} style={styles.topButton}>
                  <X size={24} color="white" />
                </TouchableOpacity>

                <View style={styles.topCenter}>
                  {isRecording && (
                    <BlurView intensity={20} style={styles.recordingIndicator}>
                      <View style={styles.recordingDot} />
                      <Text style={styles.recordingTime}>
                        {formatTime(recordingTime)}
                      </Text>
                    </BlurView>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => setShowQualitySelector(!showQualitySelector)}
                  style={styles.topButton}
                >
                  <Text style={styles.qualityLabel}>
                    {mode === 'photo' ? selectedQuality.icon : selectedVideoQuality.icon}
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>

            {/* Quality selector overlay */}
            {showQualitySelector && (
              <BlurView intensity={50} style={styles.qualityOverlay}>
                <View style={styles.qualityHeader}>
                  <Text style={styles.qualityTitle}>
                    {mode === 'photo' ? 'Photo Quality' : 'Video Quality'}
                  </Text>
                  <TouchableOpacity onPress={() => setShowQualitySelector(false)}>
                    <X size={20} color="white" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.qualityList} showsVerticalScrollIndicator={false}>
                  {(mode === 'photo' ? imageQualityOptions : videoQualityOptions).map((option) => {
                    const isSelected = mode === 'photo'
                      ? selectedQuality.value === option.value
                      : selectedVideoQuality.value === option.value;

                    return (
                      <TouchableOpacity
                        key={option.value}
                        onPress={() => {
                          if (mode === 'photo') {
                            setSelectedQuality(option);
                          } else {
                            setSelectedVideoQuality(option);
                          }
                          setShowQualitySelector(false);
                        }}
                        style={[styles.qualityOption, isSelected && styles.qualityOptionSelected]}
                      >
                        <Text style={styles.qualityIcon}>{option.icon}</Text>
                        <View style={styles.qualityText}>
                          <Text style={[styles.qualityLabel, isSelected && styles.qualityLabelSelected]}>
                            {option.label}
                          </Text>
                          <Text style={[styles.qualityDescription, isSelected && styles.qualityDescriptionSelected]}>
                            {option.description}
                          </Text>
                        </View>
                        {isSelected && <Check size={20} color="#007AFF" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </BlurView>
            )}

            {/* Bottom controls */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.8)']}
              style={styles.bottomOverlay}
            >
              <View style={styles.bottomControls}>
                {/* Mode switcher */}
                <TouchableOpacity
                  onPress={() =>
                    router.setParams({
                      mode: mode === 'photo' ? 'video' : 'photo',
                    })
                  }
                  style={styles.modeButton}
                >
                  <BlurView intensity={20} style={styles.modeButtonBlur}>
                    {mode === 'photo' ? (
                      <VideoIcon size={20} color="white" />
                    ) : (
                      <Camera size={20} color="white" />
                    )}
                  </BlurView>
                  <Text style={styles.modeText}>
                    {mode === 'photo' ? 'Video' : 'Photo'}
                  </Text>
                </TouchableOpacity>

                {/* Main shutter button */}

                <TouchableOpacity
                  onPress={handleShutter}
                  disabled={
                    (isCameraLoading && mode === 'photo') ||
                    (mode === 'video' && isRecording && !canStopRecording())
                  }
                  style={[
                    styles.shutterButton,
                    isRecording && styles.shutterButtonRecording,
                    ((isCameraLoading && mode === 'photo') ||
                      (mode === 'video' && isRecording && !canStopRecording())) && { opacity: 0.5 }
                  ]}
                >
                  <View
                    style={[
                      styles.shutterInner,
                      isRecording && styles.shutterInnerRecording
                    ]}
                  >
                    {isCameraLoading && mode === 'photo' ? (
                      <Loader size={28} color="white" />
                    ) : mode === 'photo' ? (
                      <Camera size={28} color="white" />
                    ) : isRecording ? (
                      <View style={styles.stopIcon} />
                    ) : (
                      <VideoIcon size={28} color="white" />
                    )}
                  </View>
                </TouchableOpacity>



                {/* Settings */}
                <View style={styles.settingsColumn}>
                  <TouchableOpacity onPress={toggleFlash} style={styles.settingButton}>
                    <BlurView intensity={20} style={styles.settingButtonBlur}>
                      {getFlashIcon()}
                    </BlurView>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={toggleCamera} style={styles.settingButton}>
                    <BlurView intensity={20} style={styles.settingButtonBlur}>
                      <RefreshCw size={20} color="white" />
                    </BlurView>
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.previewContainer}>
          <LinearGradient
            colors={['#000', '#1a1a1a']}
            style={styles.previewBackground}
          >
            {previewType === 'photo' && previewUri && (
              <Image
                source={{ uri: previewUri }}
                style={styles.previewMedia}
                resizeMode="contain"
              />
            )}

            {previewType === 'video' && previewUri && (
              <Video
                source={{ uri: previewUri }}
                style={styles.previewMedia}
                resizeMode="contain"
                useNativeControls
                shouldPlay
                isLooping
                onError={(e) => {
                  console.error('Video playback error:', JSON.stringify(e));
                  Alert.alert('Error', `Failed to play video: ${e.message || 'Unknown error'}`);
                }}
              />
            )}

            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.9)']}
              style={styles.previewOverlay}
            >
              <View style={styles.previewActions}>
                <TouchableOpacity
                  onPress={handleRetake}
                  style={styles.previewButton}
                >
                  <BlurView intensity={20} style={styles.previewButtonBlur}>
                    <RotateCcw size={24} color="white" />
                  </BlurView>
                  <Text style={styles.previewButtonText}>
                    {t('camera.retake') || 'Retake'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleConfirm}
                  style={[styles.previewButton, styles.confirmButton]}
                >
                  <LinearGradient
                    colors={['#007AFF', '#0056CC']}
                    style={styles.confirmButtonGradient}
                  >
                    <Check size={24} color="white" />
                  </LinearGradient>
                  <Text style={styles.previewButtonText}>
                    {t('camera.confirm') || 'Use Photo'}
                  </Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </LinearGradient>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Camera view
  camera: {
    flex: 1,
  },
  cameraTouchable: {
    flex: 1,
  },

  // Focus indicator - SIMPLIFIED WITHOUT ANIMATION
  focusBox: {
    position: 'absolute',
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  focusRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
    // Removed shadow properties that might cause issues
  },

  // Overlays
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    pointerEvents: 'box-none',
  },
  topControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
  },
  topButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Recording indicator
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF3B30',
    marginRight: 8,
  },
  recordingTime: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
    fontFamily: 'SF Pro Display',
  },

  // Quality selector
  qualityOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.8)',
    top: 100,
    left: 20,
    right: 20,
    maxHeight: 400,
    borderRadius: 16,
    overflow: 'hidden',
  },
  qualityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  qualityTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },
  qualityList: {
    maxHeight: 300,
  },
  qualityOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  qualityOptionSelected: {
    backgroundColor: 'rgba(0,122,255,0.2)',
  },
  qualityIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  qualityText: {
    flex: 1,
  },
  qualityLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  qualityLabelSelected: {
    color: '#007AFF',
  },
  qualityDescription: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  qualityDescriptionSelected: {
    color: 'rgba(0,122,255,0.8)',
  },

  // Bottom controls
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 20,
    pointerEvents: 'box-none',
  },
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  // Mode button
  modeButton: {
    alignItems: 'center',
    width: 80,
  },
  modeButtonBlur: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  modeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },

  // Shutter button
  shutterButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  shutterButtonRecording: {
    backgroundColor: '#FF3B30',
  },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shutterInnerRecording: {
    backgroundColor: 'white',
    borderRadius: 8,
    width: 32,
    height: 32,
  },
  stopIcon: {
    width: 20,
    height: 20,
    backgroundColor: '#FF3B30',
    borderRadius: 2,
  },

  // Settings column
  settingsColumn: {
    alignItems: 'center',
    width: 80,
  },
  settingButton: {
    marginBottom: 16,
  },
  settingButtonBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Preview
  previewContainer: {
    flex: 1,
  },
  previewBackground: {
    flex: 1,
  },
  previewMedia: {
    flex: 1,
    width: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 20,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  previewButton: {
    alignItems: 'center',
  },
  previewButtonBlur: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginBottom: 8,
  },
  confirmButton: {
    alignItems: 'center',
  },
  confirmButtonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },

  // Permission screen
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  permissionIcon: {
    marginBottom: 20,
  },
  permissionTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  permissionMessage: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: 'white',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
  },
  backButtonText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '500',
  },

  // Loading screen
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 20,
    marginBottom: 30,
  },
  loadingProgress: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
    width: '60%',
  },
});

export default CameraScreen;