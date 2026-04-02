import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';

export default function SuccessScreen() {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const job = route.params?.job;

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* Checkmark circle */}
                <View style={styles.checkCircle}>
                    <Text style={styles.checkmark}>✓</Text>
                </View>

                <Text style={styles.title}>Job Submitted!</Text>
                <Text style={styles.subtitle}>
                    The job referral has been saved successfully.
                </Text>

                {job && (
                    <View style={styles.summaryCard}>
                        <Text style={styles.cardTitle}>Summary</Text>
                        {job.homeowner_name ? (
                            <Text style={styles.cardItem}>👤  {job.homeowner_name}</Text>
                        ) : null}
                        {job.homeowner_phone ? (
                            <Text style={styles.cardItem}>📞  {job.homeowner_phone}</Text>
                        ) : null}
                        {job.service_sector && job.service_sector !== 'UNKNOWN' ? (
                            <Text style={styles.cardItem}>🔧  {job.service_sector}</Text>
                        ) : null}
                        {job.homeowner_address ? (
                            <Text style={styles.cardItem}>📍  {job.homeowner_address}</Text>
                        ) : null}
                    </View>
                )}

                <TouchableOpacity
                    style={styles.button}
                    onPress={() => navigation.reset({
                        index: 0,
                        routes: [{ name: 'Recording' }],
                    })}
                    activeOpacity={0.8}
                >
                    <Text style={styles.buttonText}>Start New Job</Text>
                </TouchableOpacity>
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
    checkCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(76, 175, 80, 0.15)',
        borderWidth: 3,
        borderColor: '#4caf50',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 30,
    },
    checkmark: {
        fontSize: 48,
        color: '#4caf50',
        fontWeight: '700',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#ffffff',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#8892b0',
        textAlign: 'center',
        marginBottom: 30,
    },
    summaryCard: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        marginBottom: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    cardTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#5a6689',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
    },
    cardItem: {
        fontSize: 16,
        color: '#ccd6f6',
        marginBottom: 8,
        lineHeight: 22,
    },
    button: {
        backgroundColor: '#00d4ff',
        paddingHorizontal: 40,
        paddingVertical: 16,
        borderRadius: 30,
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0a0e27',
    },
});
