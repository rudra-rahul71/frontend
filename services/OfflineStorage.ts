import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const PENDING_UPLOADS_KEY = 'pending_offline_uploads';

export interface OfflineUpload {
    audioUri?: string;         // Native: file URI
    audioBase64?: string;      // Web: base64-encoded WAV
    metadata: any;
    timestamp: number;
    platform: 'native' | 'web';
}

export interface SyncResult {
    success: boolean;
    job?: any;
    isComplete?: boolean;
    missingFields?: string[];
    error?: string;
}

/**
 * Save audio data for later upload when connectivity returns.
 * On native: saves the file URI.
 * On web: saves the base64-encoded WAV data directly.
 */
export const saveOfflineData = async (
    audioUri: string | null,
    metadata: any,
    audioBase64?: string
) => {
    try {
        const existing = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
        const uploads: OfflineUpload[] = existing ? JSON.parse(existing) : [];

        const entry: OfflineUpload = {
            metadata,
            timestamp: Date.now(),
            platform: Platform.OS === 'web' ? 'web' : 'native',
        };

        if (Platform.OS === 'web' && audioBase64) {
            entry.audioBase64 = audioBase64;
        } else if (audioUri) {
            entry.audioUri = audioUri;
        }

        uploads.push(entry);
        await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(uploads));
        console.log(`Saved offline audio (${entry.platform}). Queue size: ${uploads.length}`);
    } catch (e) {
        console.error("Failed to save offline data", e);
    }
};

/**
 * Check if there are pending uploads.
 */
export const hasPendingUploads = async (): Promise<boolean> => {
    try {
        const existing = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
        if (!existing) return false;
        const uploads = JSON.parse(existing);
        return uploads.length > 0;
    } catch {
        return false;
    }
};

/**
 * Sync all pending offline data to the server.
 * Returns the result of the LAST synced item (most relevant for UI navigation).
 */
export const syncOfflineData = async (serverUrl: string): Promise<SyncResult> => {
    let lastResult: SyncResult = { success: false, error: 'No pending uploads' };

    try {
        const existing = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
        if (!existing) return lastResult;

        const uploads: OfflineUpload[] = JSON.parse(existing);
        if (uploads.length === 0) return lastResult;

        const remaining: OfflineUpload[] = [];
        let consecutiveFailures = 0;

        for (const upload of uploads) {
            // Skip further attempts if we've encountered a failure to avoid spamming
            if (consecutiveFailures > 0) {
                remaining.push(upload);
                continue;
            }

            try {
                const formData = new FormData();

                if (upload.platform === 'web' && upload.audioBase64) {
                    // Web: convert base64 to Blob
                    const binaryStr = atob(upload.audioBase64);
                    const bytes = new Uint8Array(binaryStr.length);
                    for (let i = 0; i < binaryStr.length; i++) {
                        bytes[i] = binaryStr.charCodeAt(i);
                    }
                    const blob = new Blob([bytes], { type: 'audio/wav' });
                    formData.append('audio', blob, 'offline_audio.wav');
                } else if (upload.audioUri) {
                    // Native: use file URI
                    formData.append('audio', {
                        uri: upload.audioUri,
                        name: 'offline_audio.m4a',
                        type: 'audio/m4a',
                    } as any);
                } else {
                    console.warn('Skipping upload with no audio data');
                    continue;
                }

                formData.append('metadata', JSON.stringify(upload.metadata || {}));

                let attempt = 0;
                const maxRetries = 3;
                let backoffParams = { delay: 5000, factor: 2 };
                let response: any = null;
                let fetchError: any = null;

                while (attempt < maxRetries) {
                    try {
                        response = await fetch(`${serverUrl}/api/offline-upload`, {
                            method: 'POST',
                            body: formData,
                        });

                        if (response.ok) {
                            break; // Success, exit retry loop
                        }

                        // Do not retry on client errors (400-499) except Rate Limit (429)
                        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                            break;
                        }
                    } catch (e: any) {
                        fetchError = e;
                    }

                    attempt++;
                    if (attempt < maxRetries) {
                        console.log(`Sync request failed, retrying in ${backoffParams.delay}ms (Attempt ${attempt}/${maxRetries})...`);
                        await new Promise(resolve => setTimeout(resolve, backoffParams.delay));
                        backoffParams.delay *= backoffParams.factor;
                    }
                }

                if (response && response.ok) {
                    const data = await response.json();
                    console.log("Successfully synced offline audio:", data);
                    lastResult = {
                        success: true,
                        job: data.job,
                        isComplete: data.isComplete,
                        missingFields: data.missingFields,
                    };
                    consecutiveFailures = 0;
                    
                    // Stop processing further uploads to avoid UI appearing "stuck".
                    // Push the remaining items into the queue to process later.
                    const currentIndex = uploads.indexOf(upload);
                    for (let j = currentIndex + 1; j < uploads.length; j++) {
                        remaining.push(uploads[j]);
                    }
                    break;
                } else {
                    consecutiveFailures++;
                    remaining.push(upload);

                    if (response) {
                        const errText = await response.text();
                        console.error(`Sync failed after retries (${response.status}): ${errText}`);
                        lastResult = { success: false, error: `Server error: ${response.status}` };
                    } else if (fetchError) {
                        console.error(`Network error during sync: ${fetchError.message}`);
                        lastResult = { success: false, error: fetchError.message || 'Network error' };
                    }
                }
            } catch (e: any) {
                console.error("Failed to sync item", e);
                remaining.push(upload);
                lastResult = { success: false, error: e.message || 'Network error' };
                consecutiveFailures++;
            }
        }

        // Update storage: keep only failed items
        if (remaining.length > 0) {
            await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(remaining));
        } else {
            await AsyncStorage.removeItem(PENDING_UPLOADS_KEY);
        }

    } catch (e: any) {
        console.error("Offline sync error", e);
        lastResult = { success: false, error: e.message || 'Sync error' };
    }

    return lastResult;
};
