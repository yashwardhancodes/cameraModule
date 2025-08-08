import { useAudioPlayer } from 'expo-audio';
import { BlurView } from "expo-blur";
import {
	CameraType,
	CameraView,
	FlashMode,
	useCameraPermissions,
	useMicrophonePermissions,
} from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useVideoPlayer, VideoView } from 'expo-video';
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
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	Dimensions,
	Image,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View
} from "react-native";
import { deleteFile, getFileSize, saveImage, saveVideoToGallery } from "../../utils/MediaUtils";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const imageQualityOptions = [
	{
		label: "Low (Small size)",
		value: "low",
		maxSize: "640x480",
		quality: 0.4,
		description: "640x480 resolution, 40% quality – fastest to upload",
		icon: "🚀",
	},
	{
		label: "Medium (Recommended)",
		value: "medium",
		maxSize: "1024x768",
		quality: 0.6,
		description: "1024x768 resolution, 60% quality – good balance",
		icon: "⚡",
	},
	{
		label: "High (Better details)",
		value: "high",
		maxSize: "1600x1200",
		quality: 0.8,
		description: "1600x1200 resolution, 80% quality – slower to upload",
		icon: "✨",
	},
	{
		label: "Original (No compression)",
		value: "original",
		maxSize: "1920x1440", // or max your device supports
		quality: 1.0,
		description: "1920x1440 resolution, 100% quality – large files",
		icon: "💎",
	},
];

// OPTIMIZED: Better video quality presets for performance
type VideoQuality = '4:3' | '480p' | '720p' | '1080p' | '2160p';

const videoQualityOptions: { label: string; value: VideoQuality; description: string; icon: string }[] = [
	{
		label: "Very Low",
		value: '4:3',
		description: "Minimal file size, fastest upload, low clarity",
		icon: "🚀",
	},
	{
		label: "Low (480p)",
		value: '480p',
		description: "Faster upload, basic visibility",
		icon: "📱",
	},
	{
		label: "Medium (720p)",
		value: '720p',
		description: "Good balance of quality and file size",
		icon: "⚡",
	},
	{
		label: "High (1080p)",
		value: '1080p',
		description: "Sharp quality, larger file size",
		icon: "✨",
	},
	{
		label: "Ultra (4K)",
		value: '2160p',
		description: "Best quality, largest file size",
		icon: "💎",
	},
];




const audioSource = require('../../assets/shutter.mp3');
const audioSource1 = require('../../assets/recording.mp3');

const CameraScreen = () => {
	const cameraRef = useRef<CameraView | null>(null);
	const containerRef = useRef<View | null>(null);
	const router = useRouter();
	const { t } = useTranslation();
	const [permission, requestPermission] = useCameraPermissions();
	const [micPermission, requestMicPermission] = useMicrophonePermissions();
	const player = useAudioPlayer(audioSource);
	const player1 = useAudioPlayer(audioSource1);

	const rawParams = useLocalSearchParams();
	const mode = (rawParams.mode as "picture" | "video") ?? "picture";
	const mediaPath = rawParams.path as string | undefined;
	const mediaType = rawParams.type as "picture" | "video" | undefined;
	const mediaSize = rawParams.size as string | undefined;

	const [selectedQuality, setSelectedQuality] = useState(imageQualityOptions[1]);
	const [selectedVideoQuality, setSelectedVideoQuality] = useState(videoQualityOptions[2]);

	// OPTIMIZED: Memoize quality values to prevent recalculations
	const { quality, maxSizePx, videoPreset } = useMemo(() => ({
		quality: selectedQuality.quality,
		maxSizePx: selectedQuality.maxSize,
		videoPreset: selectedVideoQuality.value
	}), [selectedQuality, selectedVideoQuality]);

	const [cameraReady, setCameraReady] = useState(false);
	const [isCameraMounted, setIsCameraMounted] = useState(true);
	const [flash, setFlash] = useState<FlashMode>("off");
	const [cameraType, setCameraType] = useState<CameraType>("back");
	const [isRecording, setIsRecording] = useState<boolean>(false);
	const [isCameraLoading, setIsCameraLoading] = useState<boolean>(false);
	const [previewUri, setPreviewUri] = useState<string | null>(null);
	const [previewType, setPreviewType] = useState<"picture" | "video" | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [recordingTime, setRecordingTime] = useState<number>(0);
	const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
	const [showQualitySelector, setShowQualitySelector] = useState<boolean>(false);
	const [showFocus, setShowFocus] = useState<boolean>(false);
	const currentModeRef = useRef(mode);
	const isRecordingRef = useRef(false);
	const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

	// OPTIMIZED: Refs for video player management
	const videoPlayerRef = useRef<any>(null);
	const lastVideoUriRef = useRef<string | null>(null);

	// OPTIMIZED: Create video player only when needed and reuse
	const videoPlayer = useVideoPlayer(
		previewUri && previewType === "video" ? previewUri : null,
		useCallback((player: any) => {
			videoPlayerRef.current = player;
			if (previewUri && previewType === "video") {
				// OPTIMIZED: Add error handling and performance settings
				try {
					player.loop = true;
					player.volume = 0; // Mute to improve performance
					player.playbackRate = 1.0; // Ensure normal playback rate
					// Don't auto-play immediately, wait for user interaction or explicit call
				} catch (error) {
					console.warn("Video player setup error:", error);
				}
			}
		}, [previewUri, previewType])
	);

	const canStopRecording = useCallback(() => {
		if (!recordingStartTime) return false;
		return Date.now() - recordingStartTime >= 1000;
	}, [recordingStartTime]);

	useEffect(() => {
		currentModeRef.current = mode;
		isRecordingRef.current = isRecording;
	}, [mode, isRecording]);

	// OPTIMIZED: Use useCallback for recording timer
	useEffect(() => {
		let interval: ReturnType<typeof setInterval> | null = null;
		if (isRecording) {
			interval = setInterval(() => {
				setRecordingTime((prev) => prev + 1);
			}, 1000);
		} else {
			setRecordingTime(0);
		}
		return () => {
			if (interval) clearInterval(interval);
		};
	}, [isRecording]);

	// OPTIMIZED: Better camera mounting with cleanup
	useEffect(() => {
		setCameraReady(false);
		setIsCameraMounted(false);
		setPreviewUri(mediaPath || null);
		setPreviewType(mediaType || null);

		// Stop any ongoing recording when mode changes
		if (isRecordingRef.current) {
			handleStopRecording(true);
		}

		// OPTIMIZED: Shorter timeout for faster camera mounting
		const timeout = setTimeout(() => {
			setIsCameraMounted(true);
		}, 100);

		return () => {
			clearTimeout(timeout);
			if (isRecordingRef.current) {
				handleStopRecording(true);
			}
		};
	}, [mode, mediaPath, mediaType]);

	// OPTIMIZED: Better video player management with performance improvements
	useEffect(() => {
		if (previewType === "video" && previewUri && videoPlayer && previewUri !== lastVideoUriRef.current) {
			lastVideoUriRef.current = previewUri;

			const setupVideo = async () => {
				try {
					// OPTIMIZED: Clean up previous video first
					if (videoPlayerRef.current) {
						try {
							await videoPlayerRef.current.pause();
						} catch (e) {
							// Ignore pause errors
						}
					}

					// OPTIMIZED: Use requestAnimationFrame for smoother transition
					requestAnimationFrame(async () => {
						try {
							await videoPlayer.replaceAsync(previewUri);
							// OPTIMIZED: Only play after a short delay to ensure smooth loading
							setTimeout(() => {
								if (videoPlayerRef.current) {
									videoPlayerRef.current.play();
								}
							}, 100);
						} catch (error) {
							console.warn("Video player replace error:", error);
						}
					});
				} catch (error) {
					console.warn("Video setup error:", error);
				}
			};

			setupVideo();
		}

		// Cleanup when preview is removed
		return () => {
			if (!previewUri && videoPlayerRef.current) {
				try {
					videoPlayerRef.current.pause();
				} catch (e) {
					// Ignore cleanup errors
				}
			}
		};
	}, [previewUri, previewType, videoPlayer]);

	const toggleMode = useCallback(() => {
		router.setParams({
			mode: mode === "picture" ? "video" : "picture",
			path: previewUri || mediaPath,
			type: previewType || mediaType,
			size: mediaSize,
		});
	}, [mode, previewUri, mediaPath, previewType, mediaType, mediaSize, router]);

	const handleFocus = useCallback((event: any) => {
		const { nativeEvent } = event;
		const { locationX, locationY, pageX, pageY } = nativeEvent;
		let x = locationX || pageX;
		let y = locationY || pageY;
		const clampedX = Math.max(50, Math.min(screenWidth - 50, x));
		const clampedY = Math.max(50, Math.min(screenHeight - 50, y));

		setFocusPoint({ x: clampedX, y: clampedY });
		Haptics.selectionAsync();
		setShowFocus(true);
		setTimeout(() => {
			setShowFocus(false);
			setFocusPoint(null);
		}, 1200);
	}, []);

	const toggleFlash = useCallback(() => {
		setFlash((prev) => (prev === "off" ? "on" : prev === "on" ? "auto" : "off"));
	}, []);

	const toggleCamera = useCallback(() => {
		setCameraType((prev) => (prev === "back" ? "front" : "back"));
	}, []);

	const handleStopRecording = useCallback(async (discard: boolean = false) => {
		if (!cameraRef.current || !isRecordingRef.current) {
			return;
		}
		try {
			await cameraRef.current.stopRecording();
		} catch (error) {
			console.warn("Error stopping recording:", error);
		} finally {
			setIsRecording(false);
			isRecordingRef.current = false;
			setRecordingStartTime(null);
		}
	}, []);

	const handleShutter = useCallback(async () => {
		setIsCameraLoading(true);
		if (!cameraRef.current) {
			setIsCameraLoading(false);
			return;
		}
		await Haptics.selectionAsync();



		if (currentModeRef.current === "picture") {
			try {
			
				try {
					player.play();
				} catch (error) {
					console.warn("Failed to play shutter sound:", error);
				}

				// OPTIMIZED: Better picture capture settings
				const picture = await cameraRef.current.takePictureAsync({
					quality: 0.9, // Slightly reduced for performance
					skipProcessing: false, // Enable processing for better quality
					exif: false, // Disable EXIF for smaller files
				});
				if (picture) {
					setLoading(true);
					const savedPath = await saveImage(picture.uri);
					console.log("Resolution : " + savedPath.width + " X " + savedPath.height);
					setPreviewUri(savedPath.uri);
					setPreviewType("picture");
					setLoading(false);
				}
			} catch (error) {
				console.error("picture capture error:", error);
				setLoading(false);
			} finally {
				setIsCameraLoading(false);
			}
		} else {
			if (!micPermission?.granted) {
				await requestMicPermission();
				setIsCameraLoading(false);
				return;
			}
			if (isRecordingRef.current) {
				console.log("reached here")
				const now = Date.now();
				if (recordingStartTime && now - recordingStartTime < 1000) {
					setIsCameraLoading(false);
									console.log("reached here")

					return;
				}
				// Play recording sound when stopping recording
				try {
					player1.play();
				} catch (error) {
					console.warn("Failed to play recording sound:", error);
				}
				await handleStopRecording();
				setIsCameraLoading(false);
				return;
			}
			// Play recording sound when starting recording
			try {
				player1.play();
			} catch (error) {
				console.warn("Failed to play recording sound:", error);
			}
			setRecordingStartTime(Date.now());
			setIsRecording(true);
			isRecordingRef.current = true;
			try {
				// OPTIMIZED: Better video recording settings
				const video = await cameraRef.current.recordAsync({
					maxDuration: 300, // 5 minutes max to prevent huge files
					mirror: cameraType === "front", // Mirror front camera recordings
				});
				if (currentModeRef.current === "video" && video) {
 				console.log("CurrentModeRef:", currentModeRef); // Check if it's undefined/null
					const savedUri = await saveVideoToGallery(video.uri);
					const finalUri = savedUri.startsWith("file://")
						? savedUri
						: `file://${savedUri}`;
					setPreviewUri(finalUri);
					setPreviewType("video");
				} else if (video?.uri) {
					await FileSystem.deleteAsync(video.uri);
				}
			} catch (error) {
				console.error("Video record error:", error);
			} finally {
				setIsRecording(false);
				isRecordingRef.current = false;
				setIsCameraLoading(false);
				setRecordingStartTime(null);
			}
		}
	}, [quality, maxSizePx, videoPreset, cameraType, micPermission, recordingStartTime, player, player1, handleStopRecording]);

	const handleConfirm = useCallback(async () => {
		if (!previewUri || !previewType) return;
		try {
			const fileSize = await getFileSize(previewUri);
			router.replace({
				pathname: "/",
				params: {
					...rawParams,
					path: previewUri,
					type: previewType,
					size: fileSize.toString(),
				},
			});
		} catch (error) {
			console.error("Failed to get file size:", error);
		}
	}, [previewUri, previewType, rawParams, router]);

	const handleRetake = useCallback(async () => {
		if (videoPlayerRef.current && previewType === "video") {
			try {
				videoPlayerRef.current.pause();
			} catch (e) {
				// Ignore errors
			}
		}

		if (previewUri) {
			try {
				await deleteFile(previewUri);
				console.log('File deleted successfully:', previewUri);
			} catch (error) {
				console.error('Failed to delete file:', previewUri, error);
				// Continue with cleanup even if deletion fails
			}
		}

		setPreviewUri(null);
		setPreviewType(null);
		setRecordingTime(0);
		lastVideoUriRef.current = null;
	}, [previewType, previewUri]);


	const formatTime = useCallback((seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
	}, []);

	const getFlashIcon = useCallback(() => {
		switch (flash) {
			case "on":
				return <Zap size={24} color="white" />;
			case "auto":
				return <Sun size={24} color="white" />;
			default:
				return <ZapOff size={24} color="white" />;
		}
	}, [flash]);

	if (!permission?.granted) {
		return (
			<View style={styles.permissionContainer}>
				<View style={styles.permissionContent}>
					<Camera size={48} color="white" style={styles.permissionIcon} />
					<Text style={styles.permissionTitle}>
						{t("camera.permissionTitle") || "Camera Access Required"}
					</Text>
					<Text style={styles.permissionMessage}>
						{t("camera.permissionMessage") ||
							"This app needs camera access to take pictures and videos. Please enable it in settings."}
					</Text>
					<TouchableOpacity onPress={requestPermission} style={styles.permissionButton}>
						<Text style={styles.permissionButtonText}>
							{t("camera.grantPermission") || "Grant Permission"}
						</Text>
					</TouchableOpacity>
					<TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
						<Text style={styles.backButtonText}>{t("camera.back") || "Go Back"}</Text>
					</TouchableOpacity>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container} ref={containerRef}>
			{!previewUri ? (
				<>

					<TouchableOpacity
						style={styles.cameraTouchable}
						activeOpacity={1}
						onPress={handleFocus}
					>
						{isCameraMounted && (
							<CameraView
								ref={cameraRef}
								style={styles.camera}
								facing={cameraType}
								flash={flash}
								mode={mode}
								onCameraReady={() => setCameraReady(true)}
								videoQuality={videoPreset as VideoQuality}
								pictureSize={maxSizePx}
								// OPTIMIZED: Add responsiveOrientationWhenOrientationLocked for better performance
								responsiveOrientationWhenOrientationLocked={true}
								// OPTIMIZED: Enable autofocus for better video quality
								autofocus="on"
							/>
						)}
						{focusPoint && showFocus && (
							<View
								style={[
									styles.focusBox,
									{ left: focusPoint.x - 40, top: focusPoint.y - 40 },
								]}
							>
								<View style={styles.focusRing} />
							</View>
						)}
						<LinearGradient
							colors={["rgba(0,0,0,0.6)", "transparent"]}
							style={styles.topOverlay}
						>
							<View style={styles.topControls}>
								<TouchableOpacity
									onPress={() => router.back()}
									style={styles.topButton}
								>
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
										{mode === "picture"
											? selectedQuality.icon
											: selectedVideoQuality.icon}
									</Text>
								</TouchableOpacity>
							</View>
						</LinearGradient>
						{showQualitySelector && (
							<BlurView intensity={50} style={styles.qualityOverlay}>
								<View style={styles.qualityHeader}>
									<Text style={styles.qualityTitle}>
										{mode === "picture" ? "picture Quality" : "Video Quality"}
									</Text>
									<TouchableOpacity onPress={() => setShowQualitySelector(false)}>
										<X size={20} color="white" />
									</TouchableOpacity>
								</View>
								<ScrollView
									style={styles.qualityList}
									showsVerticalScrollIndicator={false}
								>
									{(mode === "picture"
										? imageQualityOptions
										: videoQualityOptions
									).map((option, index) => {
										const isSelected =
											mode === "picture"
												? selectedQuality.value === option.value
												: selectedVideoQuality.value === option.value;
										return (
											<TouchableOpacity
												key={`${mode}-${option.value}-${index}`} // Enhanced key for uniqueness
												onPress={() => {
													if (mode === "picture") {
														setSelectedQuality(option);
													} else {
														setSelectedVideoQuality(option);
													}
													setShowQualitySelector(false);
												}}
												style={[
													styles.qualityOption,
													isSelected && styles.qualityOptionSelected,
												]}
											>
												<Text style={styles.qualityIcon}>
													{option.icon}
												</Text>
												<View style={styles.qualityText}>
													<Text
														style={[
															styles.qualityLabel,
															isSelected &&
															styles.qualityLabelSelected,
														]}
													>
														{option.label}
													</Text>
													<Text
														style={[
															styles.qualityDescription,
															isSelected &&
															styles.qualityDescriptionSelected,
														]}
													>
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
						<LinearGradient
							colors={["transparent", "rgba(0,0,0,0.8)"]}
							style={styles.bottomOverlay}
						>
							<View style={styles.bottomControls}>
								<TouchableOpacity onPress={toggleMode} style={styles.modeButton}>
									<BlurView intensity={20} style={styles.modeButtonBlur}>
										{mode === "picture" ? (
											<VideoIcon size={20} color="white" />
										) : (
											<Camera size={20} color="white" />
										)}
									</BlurView>
									<Text style={styles.modeText}>
										{mode === "picture" ? "Video" : "picture"}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									onPress={handleShutter}
									disabled={
										(isCameraLoading && mode === "picture") ||
										(mode === "video" && isRecording && !canStopRecording())
									}
									style={[
										styles.shutterButton,
										isRecording && styles.shutterButtonRecording,
										((isCameraLoading && mode === "picture") ||
											(mode === "video" &&
												isRecording &&
												!canStopRecording())) && { opacity: 0.5 },
									]}
								>
									<View
										style={[
											styles.shutterInner,
											isRecording && styles.shutterInnerRecording,
										]}
									>
										{isCameraLoading && mode === "picture" ? (
											<Loader size={28} color="white" />
										) : mode === "picture" ? (
											<Camera size={28} color="white" />
										) : isRecording ? (
											<View style={styles.stopIcon} />
										) : (
											<VideoIcon size={28} color="white" />
										)}
									</View>
								</TouchableOpacity>
								<View style={styles.settingsColumn}>
									<TouchableOpacity
										onPress={toggleFlash}
										style={styles.settingButton}
									>
										<BlurView intensity={20} style={styles.settingButtonBlur}>
											{getFlashIcon()}
										</BlurView>
									</TouchableOpacity>
									<TouchableOpacity
										onPress={toggleCamera}
										style={styles.settingButton}
									>
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
					<LinearGradient colors={["#000", "#1a1a1a"]} style={styles.previewBackground}>
						{previewType === "picture" && previewUri && (
							<Image
								source={{ uri: previewUri }}
								style={styles.previewMedia}
								resizeMode="contain"
							/>
						)}
						{previewType === "video" && previewUri && (
							<VideoView
								style={styles.previewMedia}
								player={videoPlayer}
								allowsFullscreen={false} // OPTIMIZED: Disable fullscreen for better performance
								allowsPictureInPicture={false} // OPTIMIZED: Disable PiP for better performance
								contentFit="contain"
								// OPTIMIZED: Add nativeControls for better performance
								nativeControls={true}
							/>
						)}
						<LinearGradient
							colors={["transparent", "rgba(0,0,0,0.9)"]}
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
										{t("camera.retake") || "Retake"}
									</Text>
								</TouchableOpacity>
								<TouchableOpacity
									onPress={handleConfirm}
									style={[styles.previewButton, styles.confirmButton]}
								>
									<LinearGradient
										colors={["#007AFF", "#0056CC"]}
										style={styles.confirmButtonGradient}
									>
										<Check size={24} color="white" />
									</LinearGradient>
									<Text style={styles.previewButtonText}>
										{t("camera.confirm") || "Use picture"}
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
		backgroundColor: "#000",
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
		position: "absolute",
		width: 80,
		height: 80,
		justifyContent: "center",
		alignItems: "center",
		pointerEvents: "none",
	},
	focusRing: {
		width: 60,
		height: 60,
		borderRadius: 30,
		borderWidth: 2,
		borderColor: "#007AFF",
		backgroundColor: "transparent",
	},

	// Overlays
	topOverlay: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		paddingTop: 50,
		paddingBottom: 30,
		paddingHorizontal: 20,
		pointerEvents: "box-none",
	},
	topControls: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	topCenter: {
		flex: 1,
		alignItems: "center",
	},
	topButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: "rgba(0,0,0,0.3)",
		justifyContent: "center",
		alignItems: "center",
	},

	// Recording indicator
	recordingIndicator: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderRadius: 20,
		overflow: "hidden",
	},
	recordingDot: {
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: "#FF3B30",
		marginRight: 8,
	},
	recordingTime: {
		color: "white",
		fontWeight: "700",
		fontSize: 16,
		fontFamily: "System",
	},

	// Quality selector
	qualityOverlay: {
		position: "absolute",
		backgroundColor: "rgba(0,0,0,0.8)",
		top: 100,
		left: 20,
		right: 20,
		maxHeight: 400,
		borderRadius: 16,
		overflow: "hidden",
	},
	qualityHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 20,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255,255,255,0.1)",
	},
	qualityTitle: {
		color: "white",
		fontSize: 18,
		fontWeight: "700",
	},
	qualityList: {
		maxHeight: 300,
	},
	qualityOption: {
		flexDirection: "row",
		alignItems: "center",
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255,255,255,0.05)",
	},
	qualityOptionSelected: {
		backgroundColor: "rgba(0,122,255,0.2)",
	},
	qualityIcon: {
		fontSize: 20,
		marginRight: 12,
		width: 24,
		textAlign: "center",
	},
	qualityText: {
		flex: 1,
	},
	qualityLabel: {
		color: "white",
		fontSize: 16,
		fontWeight: "600",
		marginBottom: 2,
	},
	qualityLabelSelected: {
		color: "#007AFF",
	},
	qualityDescription: {
		color: "rgba(255,255,255,0.7)",
		fontSize: 13,
	},
	qualityDescriptionSelected: {
		color: "rgba(0,122,255,0.8)",
	},

	// Bottom controls
	bottomOverlay: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		paddingTop: 40,
		paddingBottom: 50,
		paddingHorizontal: 20,
		pointerEvents: "box-none",
	},
	bottomControls: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},

	// Mode button
	modeButton: {
		alignItems: "center",
		width: 80,
	},
	modeButtonBlur: {
		width: 50,
		height: 50,
		borderRadius: 25,
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
		marginBottom: 8,
	},
	modeText: {
		color: "white",
		fontSize: 12,
		fontWeight: "600",
	},

	// Shutter button
	shutterButton: {
		width: 80,
		height: 80,
		borderRadius: 40,
		backgroundColor: "white",
		justifyContent: "center",
		alignItems: "center",
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 8,
	},
	shutterButtonRecording: {
		backgroundColor: "#FF3B30",
	},
	shutterInner: {
		width: 68,
		height: 68,
		borderRadius: 34,
		backgroundColor: "#007AFF",
		justifyContent: "center",
		alignItems: "center",
	},
	shutterInnerRecording: {
		backgroundColor: "white",
		borderRadius: 8,
		width: 32,
		height: 32,
	},
	stopIcon: {
		width: 20,
		height: 20,
		backgroundColor: "#FF3B30",
		borderRadius: 2,
	},

	// Settings column
	settingsColumn: {
		alignItems: "center",
		width: 80,
	},
	settingButton: {
		marginBottom: 16,
	},
	settingButtonBlur: {
		width: 44,
		height: 44,
		borderRadius: 22,
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
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
		width: "100%",
	},
	previewOverlay: {
		position: "absolute",
		bottom: 0,
		left: 0,
		right: 0,
		paddingTop: 40,
		paddingBottom: 50,
		paddingHorizontal: 20,
	},
	previewActions: {
		flexDirection: "row",
		justifyContent: "space-around",
		alignItems: "center",
	},
	previewButton: {
		alignItems: "center",
	},
	previewButtonBlur: {
		width: 60,
		height: 60,
		borderRadius: 30,
		justifyContent: "center",
		alignItems: "center",
		overflow: "hidden",
		marginBottom: 8,
	},
	confirmButton: {
		alignItems: "center",
	},
	confirmButtonGradient: {
		width: 60,
		height: 60,
		borderRadius: 30,
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 8,
	},
	previewButtonText: {
		color: "white",
		fontSize: 14,
		fontWeight: "600",
	},

	// Permission screen
	permissionContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	permissionContent: {
		alignItems: "center",
		paddingHorizontal: 40,
	},
	permissionIcon: {
		marginBottom: 20,
	},
	permissionTitle: {
		color: "white",
		fontSize: 24,
		fontWeight: "700",
		marginBottom: 16,
		textAlign: "center",
	},
	permissionMessage: {
		color: "rgba(255,255,255,0.8)",
		fontSize: 16,
		textAlign: "center",
		marginBottom: 32,
		lineHeight: 22,
	},
	permissionButton: {
		backgroundColor: "white",
		paddingHorizontal: 32,
		paddingVertical: 16,
		borderRadius: 12,
		marginBottom: 16,
	},
	permissionButtonText: {
		color: "#007AFF",
		fontSize: 16,
		fontWeight: "600",
	},
	backButton: {
		paddingHorizontal: 32,
		paddingVertical: 16,
	},
	backButtonText: {
		color: "rgba(255,255,255,0.7)",
		fontSize: 16,
		fontWeight: "500",
	},

	// Loading screen
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	loadingContent: {
		alignItems: "center",
	},
	loadingText: {
		color: "white",
		fontSize: 16,
		fontWeight: "500",
		marginTop: 20,
		marginBottom: 30,
	},
	loadingProgress: {
		width: 200,
		height: 4,
		backgroundColor: "rgba(255,255,255,0.2)",
		borderRadius: 2,
		overflow: "hidden",
	},
	loadingBar: {
		height: "100%",
		backgroundColor: "#007AFF",
		borderRadius: 2,
		width: "60%",
	},
});

export default CameraScreen;