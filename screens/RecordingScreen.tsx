import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { AudioModule, useAudioRecorder, RecordingPresets } from 'expo-audio';
import { AudioWebSocketClient } from '../services/AudioWebSocketClient';
import { useNetworkState } from '../hooks/useNetworkState';
import { saveOfflineData } from '../services/OfflineStorage';
import { useNavigation } from '@react-navigation/native';

// Use env var or default for Android Emulator or iOS Simulator testing
const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || `http://${DEFAULT_HOST}:8000`;
const WS_URL = BACKEND_URL.replace('http', 'ws');

type SessionMode = 'pending' | 'online' | 'offline';

export default function RecordingScreen() {
    const { isOnline } = useNetworkState();
    const navigation = useNavigation<any>();
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    
    const [isRecording, setIsRecording] = useState(false);
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const wsClient = useRef<AudioWebSocketClient | null>(null);

    // Sticky offline mode: once offline is detected, stays offline for the session
    const sessionMode = useRef<SessionMode>('pending');
    const [displayMode, setDisplayMode] = useState<SessionMode>('pending');

    // Web Audio Capture Refs
    const webAudioContext = useRef<any>(null);
    const webMediaStream = useRef<any>(null);
    const webAudioProcessor = useRef<any>(null);
    
    // Web offline buffer: accumulate PCM chunks when offline on web
    const webOfflineBuffer = useRef<Int16Array[]>([]);

    const [jobDetails, setJobDetails] = useState({
        homeowner_name: '',
        homeowner_phone: '',
        homeowner_address: '',
        job_description: '',
        service_sector: 'UNKNOWN',
        homeowner_approved: false
    });

    // Playback Audio Context (24kHz to match Gemini output)
    const playbackContext = useRef<any>(null);
    const playbackNextTime = useRef<number>(0);

    const handleAudioResponse = (base64Audio: string, mimeType: string) => {
        try {
            if (Platform.OS !== 'web') return;

            // Create playback context on first audio (must be after user gesture)
            if (!playbackContext.current) {
                const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
                playbackContext.current = new AudioContextClass({ sampleRate: 24000 });
                playbackNextTime.current = 0;
            }

            const ctx = playbackContext.current;

            // Decode base64 to Int16 PCM
            const binaryStr = atob(base64Audio);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const int16Samples = new Int16Array(bytes.buffer);

            // Convert Int16 to Float32 for Web Audio
            const float32Samples = new Float32Array(int16Samples.length);
            for (let i = 0; i < int16Samples.length; i++) {
                float32Samples[i] = int16Samples[i] / 0x7FFF;
            }

            // Create audio buffer and schedule playback
            const audioBuffer = ctx.createBuffer(1, float32Samples.length, 24000);
            audioBuffer.getChannelData(0).set(float32Samples);

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);

            const now = ctx.currentTime;
            const startTime = Math.max(now, playbackNextTime.current);
            source.start(startTime);
            playbackNextTime.current = startTime + audioBuffer.duration;
        } catch (err) {
            console.error('Failed to play Gemini audio', err);
        }
    };

    // Determine session mode on mount and when network changes
    useEffect(() => {
        if (sessionMode.current === 'offline') {
            // Sticky: once offline, stays offline for this session
            return;
        }

        if (!isOnline) {
            // Switch to offline mode
            sessionMode.current = 'offline';
            setDisplayMode('offline');
            
            // If we had a WS connection, disconnect it
            wsClient.current?.disconnect();
            wsClient.current = null;
            
            console.log('Session mode: OFFLINE (sticky)');
        } else if (sessionMode.current === 'pending') {
            // First time online — set up the WebSocket
            sessionMode.current = 'online';
            setDisplayMode('online');
            
            const client = new AudioWebSocketClient(
                WS_URL,
                (funcName, args) => {
                    if (funcName === 'update_job_details') {
                        setJobDetails(prev => ({ ...prev, ...args }));
                    }
                },
                handleAudioResponse,
                (text) => console.log('Gemini says:', text),
                () => console.log('Gemini turn complete')
            );
            client.connect();
            wsClient.current = client;
            
            console.log('Session mode: ONLINE');
        }
    }, [isOnline]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            wsClient.current?.disconnect();
            if (playbackContext.current) {
                playbackContext.current.close();
                playbackContext.current = null;
            }
        };
    }, []);

    // Reset session mode when screen gains focus (for new recordings)
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            sessionMode.current = 'pending';
            setDisplayMode('pending');
            webOfflineBuffer.current = [];
            setJobDetails({
                homeowner_name: '',
                homeowner_phone: '',
                homeowner_address: '',
                job_description: '',
                service_sector: 'UNKNOWN',
                homeowner_approved: false
            });

            // Re-evaluate based on current network state
            if (!isOnline) {
                sessionMode.current = 'offline';
                setDisplayMode('offline');
            } else {
                sessionMode.current = 'online';
                setDisplayMode('online');
                const client = new AudioWebSocketClient(
                    WS_URL,
                    (funcName, args) => {
                        if (funcName === 'update_job_details') {
                            setJobDetails(prev => ({ ...prev, ...args }));
                        }
                    },
                    handleAudioResponse,
                    (text) => console.log('Gemini says:', text),
                    () => console.log('Gemini turn complete')
                );
                client.connect();
                wsClient.current = client;
            }
        });
        return unsubscribe;
    }, [navigation, isOnline]);

    // Permission checks — rendered in JSX instead of early returns to preserve hook order
    if (!cameraPermission) return <View />;
    if (!cameraPermission?.granted) return <View style={styles.permission}><Button title="Grant Camera" onPress={requestCameraPermission} /></View>;
    if (!micPermission?.granted) return <View style={styles.permission}><Button title="Grant Mic" onPress={requestMicPermission} /></View>;

    const startRecording = async () => {
        try {
            // Clear offline buffer for new recording
            webOfflineBuffer.current = [];

            if (Platform.OS === 'web') {
                const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
                const audioCtx = new AudioContextClass({ sampleRate: 16000 });
                webAudioContext.current = audioCtx;
                
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                webMediaStream.current = stream;
                
                const source = audioCtx.createMediaStreamSource(stream);
                const processor = audioCtx.createScriptProcessor(4096, 1, 1);
                webAudioProcessor.current = processor;
                
                source.connect(processor);
                processor.connect(audioCtx.destination);
                
                processor.onaudioprocess = (e: any) => {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
                    }
                    
                    if (sessionMode.current === 'online') {
                        // Stream to WebSocket
                        const uint8Array = new Uint8Array(pcmData.buffer);
                        let binary = '';
                        for (let i = 0; i < uint8Array.byteLength; i++) {
                            binary += String.fromCharCode(uint8Array[i]);
                        }
                        const base64Chunk = btoa(binary);
                        wsClient.current?.sendAudioChunk(base64Chunk);
                    }
                    
                    // Always buffer locally (for mid-recording offline transition)
                    webOfflineBuffer.current.push(new Int16Array(pcmData));
                };
                
                setIsRecording(true);
            } else {
                // NATIVE Implementation
                await AudioModule.setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
                await audioRecorder.prepareToRecordAsync();
                await audioRecorder.record();
                setIsRecording(true);
            }
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    /**
     * Convert buffered Int16 PCM chunks into a WAV file encoded as base64.
     */
    const buildWavBase64 = (): string => {
        // Calculate total sample count
        let totalSamples = 0;
        for (const chunk of webOfflineBuffer.current) {
            totalSamples += chunk.length;
        }

        const sampleRate = 16000;
        const numChannels = 1;
        const bitsPerSample = 16;
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);
        const dataSize = totalSamples * (bitsPerSample / 8);
        const headerSize = 44;

        const buffer = new ArrayBuffer(headerSize + dataSize);
        const view = new DataView(buffer);

        // WAV header
        const writeString = (offset: number, str: string) => {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);          // PCM format chunk size
        view.setUint16(20, 1, true);           // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Write PCM samples
        let offset = 44;
        for (const chunk of webOfflineBuffer.current) {
            for (let i = 0; i < chunk.length; i++) {
                view.setInt16(offset, chunk[i], true);
                offset += 2;
            }
        }

        // Convert to base64
        const uint8 = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) {
            binary += String.fromCharCode(uint8[i]);
        }
        return btoa(binary);
    };

    const stopRecording = async () => {
        setIsRecording(false);
        try {
            if (Platform.OS === 'web') {
                // Stop web audio capture
                if (webAudioProcessor.current) webAudioProcessor.current.disconnect();
                if (webMediaStream.current) webMediaStream.current.getTracks().forEach((t: any) => t.stop());
                if (webAudioContext.current) webAudioContext.current.close();
                
                if (sessionMode.current === 'offline') {
                    // Build WAV from buffer and save offline
                    const wavBase64 = buildWavBase64();
                    await saveOfflineData(null, jobDetails, wavBase64);
                    webOfflineBuffer.current = [];
                    navigation.navigate('Waiting');
                } else {
                    // Online web — go to Summary
                    navigation.navigate('Summary', { jobDetails });
                }
            } else {
                // Native
                if (audioRecorder) {
                    await audioRecorder.stop();
                    const uri = audioRecorder.uri;
                    
                    if (sessionMode.current === 'offline' && uri) {
                        await saveOfflineData(uri, jobDetails);
                        navigation.navigate('Waiting');
                    } else {
                        navigation.navigate('Summary', { jobDetails });
                    }
                }
            }
        } catch (e) {
            console.error("Stop error", e);
        }
    };



    return (
        <SafeAreaView style={styles.container}>
            {displayMode === 'offline' && (
                <View style={styles.offlineBanner}>
                    <Text style={styles.offlineText}>
                        ⚡ Offline Mode — Recording will be uploaded when you're back online
                    </Text>
                </View>
            )}
            
            <View style={styles.cameraContainer}>
                <CameraView style={styles.camera} facing="back" />
                <View style={[styles.overlay, StyleSheet.absoluteFillObject]}>
                    <ScrollView style={styles.checklist}>
                        <Text style={styles.checklistTitle}>
                            {displayMode === 'online' 
                                ? 'Job Referral Details (Live Extraction)' 
                                : 'Job Referral Details (Offline — will process later)'}
                        </Text>
                        <Text style={styles.checklistItem}>Name: {jobDetails.homeowner_name || '—'}</Text>
                        <Text style={styles.checklistItem}>Phone: {jobDetails.homeowner_phone || '—'}</Text>
                        <Text style={styles.checklistItem}>Address: {jobDetails.homeowner_address || '—'}</Text>
                        <Text style={styles.checklistItem}>Sector: {jobDetails.service_sector}</Text>
                        <Text style={styles.checklistItem}>Approved: {jobDetails.homeowner_approved ? 'Yes' : 'No'}</Text>
                        <Text style={styles.checklistItem}>Desc: {jobDetails.job_description || '—'}</Text>
                    </ScrollView>
                    
                    <View style={styles.controls}>
                        <Button 
                            title={isRecording ? "Stop Recording" : "Start Recording"} 
                            onPress={isRecording ? stopRecording : startRecording} 
                            color={isRecording ? 'red' : 'green'}
                        />
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'black' },
    cameraContainer: { flex: 1 },
    camera: { flex: 1 },
    overlay: { flex: 1, justifyContent: 'space-between', padding: 20 },
    checklist: { backgroundColor: 'rgba(0,0,0,0.7)', padding: 15, borderRadius: 10, maxHeight: 300 },
    checklistTitle: { color: '#00ffff', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
    checklistItem: { color: '#00ff00', fontSize: 16, marginBottom: 5 },
    controls: { marginBottom: 30 },
    permission: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    offlineBanner: { 
        backgroundColor: '#e65100', 
        padding: 12, 
        alignItems: 'center',
    },
    offlineText: { 
        color: 'white', 
        fontWeight: 'bold',
        fontSize: 13,
    },
});
