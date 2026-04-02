import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

const PING_INTERVAL_MS = 5000;  // Check every 5 seconds
const PING_TIMEOUT_MS = 3000;   // Timeout after 3 seconds
export const useNetworkState = () => {
    const [isOnline, setIsOnline] = useState(true);
    const [isInitialized, setIsInitialized] = useState(false);
    const pingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    /**
     * Ping a public endpoint to confirm actual internet reachability.
     * Google's connectivity check endpoint is designed for exactly this —
     * it returns a 204 with no body, very fast.
     * We can't ping localhost because it uses the loopback interface and
     * always succeeds regardless of WiFi state.
     */
    const pingInternet = useCallback(async (): Promise<boolean> => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

            const response = await fetch(
                'https://connectivitycheck.gstatic.com/generate_204',
                {
                    method: 'HEAD',
                    signal: controller.signal,
                    cache: 'no-store',
                    mode: 'no-cors', // Avoid CORS issues — opaque response is fine, we just need it to not throw
                }
            );
            clearTimeout(timeout);
            return true; // If fetch didn't throw, we have internet
        } catch {
            return false;
        }
    }, []);

    useEffect(() => {
        if (Platform.OS === 'web') {
            // WEB: Use browser events as hints, but verify with actual pings.
            // Browser online/offline events fire unreliably and can be inverted.

            const checkAndUpdate = async () => {
                const reachable = await pingInternet();
                console.log(
                    `[Network] navigator.onLine=${navigator.onLine} ` +
                    `ping=${reachable} → isOnline=${reachable}`
                );
                setIsOnline(reachable);
                setIsInitialized(true);
            };

            // Initial check
            checkAndUpdate();

            // Periodic polling — reliable ground truth
            pingTimer.current = setInterval(checkAndUpdate, PING_INTERVAL_MS);

            // Also listen to browser events as quick hints to trigger a re-check
            const handleOnline = () => {
                console.log('[Network] browser "online" event fired, verifying...');
                checkAndUpdate();
            };
            const handleOffline = () => {
                console.log('[Network] browser "offline" event fired, verifying...');
                checkAndUpdate();
            };

            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            return () => {
                if (pingTimer.current) clearInterval(pingTimer.current);
                window.removeEventListener('online', handleOnline);
                window.removeEventListener('offline', handleOffline);
            };
        } else {
            // NATIVE: NetInfo works reliably on iOS/Android
            let timeoutId = setTimeout(() => setIsInitialized(true), 1500); // Fallback

            const unsubscribe = NetInfo.addEventListener(state => {
                // If it's an initial event and says disconnected, wait just a moment.
                // But we don't want to ignore valid offline events.
                const online = !!state.isConnected && state.isInternetReachable !== false;
                console.log(
                    `[Network] type=${state.type} isConnected=${state.isConnected} ` +
                    `isReachable=${state.isInternetReachable} → isOnline=${online}`
                );
                setIsOnline(online);
                setIsInitialized(true);
                clearTimeout(timeoutId);
            });
            return () => {
                unsubscribe();
                clearTimeout(timeoutId);
            };
        }
    }, [pingInternet]);

    return { isOnline, isInitialized };
};
