import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { saveOfflineData } from '../services/OfflineStorage';
import { useNetworkState } from '../hooks/useNetworkState';

const DEFAULT_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || `http://${DEFAULT_HOST}:8000`;

export default function SummaryScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { isOnline } = useNetworkState();

    // Fallback in case route params are undefined
    const [details, setDetails] = useState(route.params?.jobDetails || {
        homeowner_name: '',
        homeowner_phone: '',
        homeowner_address: '',
        job_description: '',
        service_sector: 'UNKNOWN',
        homeowner_approved: false
    });

    const handleChange = (field: string, value: string) => {
        setDetails((prev: any) => ({ ...prev, [field]: value }));
    };

    const submitJob = async () => {
        if (isOnline) {
            try {
                const response = await fetch(`${BACKEND_URL}/api/jobs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(details),
                });
                if (!response.ok) throw new Error(`Server error: ${response.status}`);
                Alert.alert("Success", "Job submitted to server!");
            } catch (err) {
                console.error("Failed to submit job online, saving locally", err);
                await saveOfflineData('', details);
                Alert.alert("Error", "Upload failed. Job saved locally and will sync later.");
            }
        } else {
            await saveOfflineData('', details);
            Alert.alert("Offline", "Job saved locally. Will sync when online.");
        }
        navigation.navigate('Recording');
    };

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView style={styles.content}>
                <Text style={styles.title}>Review Job Details</Text>

                <Text style={styles.label}>Homeowner Name:</Text>
                <TextInput style={styles.input} value={details.homeowner_name} onChangeText={(v) => handleChange('homeowner_name', v)} />

                <Text style={styles.label}>Phone:</Text>
                <TextInput style={styles.input} value={details.homeowner_phone} onChangeText={(v) => handleChange('homeowner_phone', v)} />

                <Text style={styles.label}>Address:</Text>
                <TextInput style={styles.input} value={details.homeowner_address} onChangeText={(v) => handleChange('homeowner_address', v)} />

                <Text style={styles.label}>Service Sector:</Text>
                <TextInput style={styles.input} value={details.service_sector} onChangeText={(v) => handleChange('service_sector', v)} />

                <Text style={styles.label}>Description:</Text>
                <TextInput style={styles.input} value={details.job_description} onChangeText={(v) => handleChange('job_description', v)} multiline />

                <Button title="Submit Job" onPress={submitJob} color="#007bff" />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    content: { padding: 20 },
    title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    label: { fontSize: 16, marginBottom: 5, color: '#333', fontWeight: 'bold' },
    input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 12, marginBottom: 15, fontSize: 16 }
});
