import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useNetworkState } from '../hooks/useNetworkState';
import { syncOfflineData, SyncResult } from '../services/OfflineStorage';

const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || `http://${DEFAULT_HOST}:8000`;

export default function WaitingScreen() {
    const { isOnline, isInitialized } = useNetworkState();
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const [status, setStatus] = useState<'waiting' | 'syncing' | 'error'>('waiting');
    const [errorMessage, setErrorMessage] = useState('');
    const hasSynced = useRef(false);

    // Attempt sync when connectivity is restored
    useEffect(() => {
        if (isInitialized && isOnline && !hasSynced.current) {
            hasSynced.current = true;
            performSync();
        }
    }, [isOnline, isInitialized]);

    const performSync = async () => {
        setStatus('syncing');
        try {
            const result: SyncResult = await syncOfflineData(BACKEND_URL);

            if (result.success) {
                if (result.isComplete) {
                    // Form is complete — go straight to success
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'Success', params: { job: result.job } }],
                    });
                } else {
                    // Form has missing fields — let the user fill them in
                    navigation.reset({
                        index: 0,
                        routes: [{
                            name: 'Summary',
                            params: {
                                jobDetails: result.job,
                                missingFields: result.missingFields,
                                fromOffline: true,
                            },
                        }],
                    });
                }
            } else {
                // Sync failed — allow retry
                setStatus('error');
                setErrorMessage(result.error || 'Failed to upload recording.');
                hasSynced.current = false; // allow re-attempt
            }
        } catch (e: any) {
            setStatus('error');
            setErrorMessage(e.message || 'Unexpected error during sync.');
            hasSynced.current = false;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Animated icon area */}
                <View style={styles.iconCircle}>
                    {status === 'waiting' && <Text style={styles.icon}>📡</Text>}
                    {status === 'syncing' && <ActivityIndicator size="large" color="#00d4ff" />}
                    {status === 'error' && <Text style={styles.icon}>⚠️</Text>}
                </View>

                {status === 'waiting' && (
                    <>
                        <Text style={styles.title}>Recording Saved</Text>
                        <Text style={styles.subtitle}>
                            Your recording has been saved locally and will be uploaded
                            automatically when you're back online.
                        </Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, styles.dotOffline]} />
                            <Text style={styles.statusText}>Waiting for connection…</Text>
                        </View>
                    </>
                )}

                {status === 'syncing' && (
                    <>
                        <Text style={styles.title}>Uploading…</Text>
                        <Text style={styles.subtitle}>
                            Connection restored! Processing your recording with AI…
                        </Text>
                        <View style={styles.statusRow}>
                            <View style={[styles.statusDot, styles.dotOnline]} />
                            <Text style={styles.statusText}>Connected — syncing data</Text>
                        </View>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <Text style={styles.title}>Upload Failed</Text>
                        <Text style={styles.subtitle}>{errorMessage}</Text>
                        <Text style={styles.retryHint}>
                            The app will retry automatically when connection is stable.
                        </Text>
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0e27',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(0, 212, 255, 0.1)',
        borderWidth: 2,
        borderColor: 'rgba(0, 212, 255, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    icon: {
        fontSize: 40,
    },
    title: {
        fontSize: 26,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#8892b0',
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 30,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 25,
    },
    statusDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: 10,
    },
    dotOffline: {
        backgroundColor: '#f44336',
    },
    dotOnline: {
        backgroundColor: '#4caf50',
    },
    statusText: {
        color: '#ccd6f6',
        fontSize: 14,
    },
    retryHint: {
        fontSize: 14,
        color: '#5a6689',
        textAlign: 'center',
        marginTop: 10,
        fontStyle: 'italic',
    },
});
