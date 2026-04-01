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

export default function RecordingScreen() {
    const { isOnline } = useNetworkState();
    const navigation = useNavigation<any>();
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [micPermission, requestMicPermission] = useMicrophonePermissions();
    
    const [isRecording, setIsRecording] = useState(false);
    const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const wsClient = useRef<AudioWebSocketClient | null>(null);

    // Web Audio Capture Refs
    const webAudioContext = useRef<any>(null);
    const webMediaStream = useRef<any>(null);
    const webAudioProcessor = useRef<any>(null);

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
                // Gemini Live outputs PCM at 24kHz
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

            // Schedule chunks sequentially to avoid gaps/overlaps
            const now = ctx.currentTime;
            const startTime = Math.max(now, playbackNextTime.current);
            source.start(startTime);
            playbackNextTime.current = startTime + audioBuffer.duration;
        } catch (err) {
            console.error('Failed to play Gemini audio', err);
        }
    };

    useEffect(() => {
        wsClient.current = new AudioWebSocketClient(
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

        if (isOnline) {
            wsClient.current.connect();
        }

        return () => {
            wsClient.current?.disconnect();
            if (playbackContext.current) {
                playbackContext.current.close();
                playbackContext.current = null;
            }
        };
    }, [isOnline]);

    if (!cameraPermission) return <View />;
    if (!cameraPermission?.granted) return <View style={styles.permission}><Button title="Grant Camera" onPress={requestCameraPermission} /></View>;
    if (!micPermission?.granted) return <View style={styles.permission}><Button title="Grant Mic" onPress={requestMicPermission} /></View>;

    const startRecording = async () => {
        try {
            if (Platform.OS === 'web') {
                // WEB Audio Implementation using standard Web APIs for zero-latency PCM chunks
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
                    // Gemini requires 16-bit PCM arrays
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
                    }
                    
                    // Convert Int16Array to Base64 String
                    const uint8Array = new Uint8Array(pcmData.buffer);
                    let binary = '';
                    for (let i = 0; i < uint8Array.byteLength; i++) {
                        binary += String.fromCharCode(uint8Array[i]);
                    }
                    const base64Chunk = btoa(binary);
                    
                    // Fire WebSocket chunk
                    wsClient.current?.sendAudioChunk(base64Chunk);
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

    const stopRecording = async () => {
        setIsRecording(false);
        try {
            if (Platform.OS === 'web') {
                if (webAudioProcessor.current) webAudioProcessor.current.disconnect();
                if (webMediaStream.current) webMediaStream.current.getTracks().forEach((t: any) => t.stop());
                if (webAudioContext.current) webAudioContext.current.close();
                
                navigation.navigate('Summary', { jobDetails });
            } else {
                if (isRecording) {
                    await audioRecorder.stop();
                    const uri = audioRecorder.uri;
                    
                    if (!isOnline && uri) {
                        await saveOfflineData(uri, jobDetails);
                    }
                    
                    navigation.navigate('Summary', { jobDetails });
                }
            }
        } catch (e) {
            console.error("Stop error", e);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {!isOnline && <View style={styles.offlineBanner}><Text style={styles.offlineText}>Offline Mode - Media will be uploaded later.</Text></View>}
            
            <View style={styles.cameraContainer}>
                <CameraView style={styles.camera} facing="back" />
                <View style={[styles.overlay, StyleSheet.absoluteFillObject]}>
                    <ScrollView style={styles.checklist}>
                        <Text style={styles.checklistTitle}>Job Referral Details (Live Extraction)</Text>
                        <Text style={styles.checklistItem}>Name: {jobDetails.homeowner_name}</Text>
                        <Text style={styles.checklistItem}>Phone: {jobDetails.homeowner_phone}</Text>
                        <Text style={styles.checklistItem}>Address: {jobDetails.homeowner_address}</Text>
                        <Text style={styles.checklistItem}>Sector: {jobDetails.service_sector}</Text>
                        <Text style={styles.checklistItem}>Approved: {jobDetails.homeowner_approved ? 'Yes' : 'No'}</Text>
                        <Text style={styles.checklistItem}>Desc: {jobDetails.job_description}</Text>
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
    offlineBanner: { backgroundColor: '#d9534f', padding: 10, alignItems: 'center' },
    offlineText: { color: 'white', fontWeight: 'bold' }
});
