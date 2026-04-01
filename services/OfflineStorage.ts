import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_UPLOADS_KEY = 'pending_offline_uploads';

export const saveOfflineData = async (audioUri: string, metadata: any) => {
    try {
        const existing = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
        const uploads = existing ? JSON.parse(existing) : [];
        uploads.push({ audioUri, metadata, timestamp: Date.now() });
        await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(uploads));
        console.log("Saved offline audio to local storage.");
    } catch (e) {
        console.error("Failed to save offline data", e);
    }
};

export const syncOfflineData = async (serverUrl: string) => {
    try {
        const existing = await AsyncStorage.getItem(PENDING_UPLOADS_KEY);
        if (!existing) return;
        
        const uploads = JSON.parse(existing);
        const remaining = [];
        
        for (const upload of uploads) {
            try {
                const formData = new FormData();
                formData.append('audio', {
                    uri: upload.audioUri,
                    name: 'offline_audio.native_file',
                    type: 'audio/m4a', // depends on device
                } as any);
                formData.append('metadata', JSON.stringify(upload.metadata));
                
                const response = await fetch(`${serverUrl}/api/offline-upload`, {
                    method: 'POST',
                    body: formData,
                });
                
                if (!response.ok) {
                    remaining.push(upload);
                } else {
                    console.log("Successfully synced offline audio.");
                }
            } catch (e) {
                console.error("Failed to sync item", e);
                remaining.push(upload);
            }
        }
        
        if (remaining.length !== uploads.length) {
            if (remaining.length > 0) {
                await AsyncStorage.setItem(PENDING_UPLOADS_KEY, JSON.stringify(remaining));
            } else {
                await AsyncStorage.removeItem(PENDING_UPLOADS_KEY);
            }
        }
    } catch (e) {
        console.error("Offline sync error", e);
    }
};
