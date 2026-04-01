import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation } from '@react-navigation/native';
import { syncOfflineData } from '../services/OfflineStorage';
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
            // Trigger background offline sync just in case
            syncOfflineData(BACKEND_URL);
            Alert.alert("Success", "Job Submitted Online!");
        } else {
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
