import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useNetworkState } from '../hooks/useNetworkState';

const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || `http://${DEFAULT_HOST}:8000`;

export default function SummaryScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { isOnline } = useNetworkState();

    const [details, setDetails] = useState(route.params?.jobDetails || {
        homeowner_name: '',
        homeowner_phone: '',
        homeowner_address: '',
        job_description: '',
        service_sector: 'UNKNOWN',
        homeowner_approved: false
    });

    const missingFields: string[] = route.params?.missingFields || [];
    const fromOffline: boolean = route.params?.fromOffline || false;

    // Notification state
    const [notification, setNotification] = useState<{ type: 'error' | 'warning' | 'info'; message: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Show missing fields notification on mount if coming from offline sync
    useEffect(() => {
        if (fromOffline && missingFields.length > 0) {
            const friendly = missingFields.map(f => f.replace(/_/g, ' ')).join(', ');
            setNotification({
                type: 'warning',
                message: `Some fields could not be extracted from your recording: ${friendly}. Please fill them in below.`,
            });
        }
    }, []);

    const handleChange = (field: string, value: string) => {
        setDetails((prev: any) => ({ ...prev, [field]: value }));
    };

    const submitJob = async () => {
        if (!isOnline) {
            setNotification({
                type: 'error',
                message: 'You are currently offline. Please try again when connected.',
            });
            return;
        }

        setIsSubmitting(true);
        setNotification(null);

        try {
            const response = await fetch(`${BACKEND_URL}/api/jobs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(details),
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => null);
                if (errData?.detail?.missingFields) {
                    const friendly = errData.detail.missingFields.map((f: string) => f.replace(/_/g, ' ')).join(', ');
                    setNotification({
                        type: 'error',
                        message: `Missing required fields: ${friendly}`,
                    });
                } else {
                    setNotification({
                        type: 'error',
                        message: `Server error (${response.status}). Please try again.`,
                    });
                }
                return;
            }

            const data = await response.json();
            // Success! Navigate to success screen
            navigation.reset({
                index: 0,
                routes: [{ name: 'Success', params: { job: data.job } }],
            });
        } catch (err: any) {
            console.error("Failed to submit job", err);
            setNotification({
                type: 'error',
                message: 'Network error. Please check your connection and try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const isFieldMissing = (field: string) => missingFields.includes(field);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>Review Job Details</Text>
                
                {fromOffline && (
                    <View style={styles.infoBanner}>
                        <Text style={styles.infoBannerText}>
                            ℹ️  This form was auto-filled from your offline recording.
                        </Text>
                    </View>
                )}

                {/* Notification Banner */}
                {notification && (
                    <View style={[
                        styles.notification,
                        notification.type === 'error' && styles.notifError,
                        notification.type === 'warning' && styles.notifWarning,
                        notification.type === 'info' && styles.notifInfo,
                    ]}>
                        <Text style={styles.notifText}>{notification.message}</Text>
                        <TouchableOpacity onPress={() => setNotification(null)}>
                            <Text style={styles.notifDismiss}>✕</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <Text style={styles.label}>Homeowner Name:</Text>
                <TextInput 
                    style={[styles.input, isFieldMissing('homeowner_name') && styles.inputMissing]} 
                    value={details.homeowner_name} 
                    onChangeText={(v) => handleChange('homeowner_name', v)}
                    placeholder="Enter homeowner name"
                    placeholderTextColor="#999"
                />

                <Text style={styles.label}>Phone:</Text>
                <TextInput 
                    style={[styles.input, isFieldMissing('homeowner_phone') && styles.inputMissing]} 
                    value={details.homeowner_phone} 
                    onChangeText={(v) => handleChange('homeowner_phone', v)}
                    placeholder="Enter phone number"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                />

                <Text style={styles.label}>Address:</Text>
                <TextInput 
                    style={[styles.input, isFieldMissing('homeowner_address') && styles.inputMissing]} 
                    value={details.homeowner_address} 
                    onChangeText={(v) => handleChange('homeowner_address', v)}
                    placeholder="Enter address"
                    placeholderTextColor="#999"
                />

                <Text style={styles.label}>Service Sector:</Text>
                <TextInput 
                    style={[styles.input, isFieldMissing('service_sector') && styles.inputMissing]} 
                    value={details.service_sector} 
                    onChangeText={(v) => handleChange('service_sector', v)}
                    placeholder="e.g. PLUMBING, HVAC, ELECTRICAL"
                    placeholderTextColor="#999"
                />

                <Text style={styles.label}>Description:</Text>
                <TextInput 
                    style={[styles.input, styles.inputMultiline, isFieldMissing('job_description') && styles.inputMissing]} 
                    value={details.job_description} 
                    onChangeText={(v) => handleChange('job_description', v)} 
                    multiline 
                    numberOfLines={4}
                    placeholder="Describe the job"
                    placeholderTextColor="#999"
                />

                {/* Submit Button */}
                <TouchableOpacity
                    style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
                    onPress={submitJob}
                    disabled={isSubmitting}
                    activeOpacity={0.8}
                >
                    {isSubmitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Submit Job</Text>
                    )}
                </TouchableOpacity>

                {/* Cancel / Go Back */}
                <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={() => navigation.navigate('Recording')}
                    activeOpacity={0.7}
                >
                    <Text style={styles.cancelButtonText}>← Back to Recording</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0a0e27' },
    content: { padding: 20 },
    title: { 
        fontSize: 26, 
        fontWeight: '700', 
        marginBottom: 20, 
        color: '#ffffff',
    },
    infoBanner: {
        backgroundColor: 'rgba(0, 212, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(0, 212, 255, 0.3)',
        borderRadius: 10,
        padding: 12,
        marginBottom: 15,
    },
    infoBannerText: {
        color: '#00d4ff',
        fontSize: 13,
    },
    notification: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 10,
        marginBottom: 20,
    },
    notifError: {
        backgroundColor: 'rgba(244, 67, 54, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(244, 67, 54, 0.4)',
    },
    notifWarning: {
        backgroundColor: 'rgba(255, 152, 0, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 152, 0, 0.4)',
    },
    notifInfo: {
        backgroundColor: 'rgba(33, 150, 243, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(33, 150, 243, 0.4)',
    },
    notifText: {
        flex: 1,
        color: '#ccd6f6',
        fontSize: 14,
        lineHeight: 20,
    },
    notifDismiss: {
        color: '#8892b0',
        fontSize: 18,
        marginLeft: 10,
        paddingHorizontal: 5,
    },
    label: { 
        fontSize: 14, 
        marginBottom: 6, 
        color: '#8892b0', 
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    input: { 
        borderWidth: 1, 
        borderColor: 'rgba(255,255,255,0.15)', 
        borderRadius: 10, 
        padding: 14, 
        marginBottom: 16, 
        fontSize: 16,
        color: '#ccd6f6',
        backgroundColor: 'rgba(255,255,255,0.04)',
    },
    inputMultiline: {
        minHeight: 100,
        textAlignVertical: 'top',
    },
    inputMissing: {
        borderColor: 'rgba(255, 152, 0, 0.6)',
        backgroundColor: 'rgba(255, 152, 0, 0.05)',
    },
    submitButton: {
        backgroundColor: '#00d4ff',
        paddingVertical: 16,
        borderRadius: 30,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 12,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0a0e27',
    },
    cancelButton: {
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 40,
    },
    cancelButtonText: {
        color: '#5a6689',
        fontSize: 14,
    },
});
