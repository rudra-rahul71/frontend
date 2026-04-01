import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export const useNetworkState = () => {
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            // Treat as online if we can't be sure it's unreachable
            setIsOnline(!!state.isConnected && state.isInternetReachable !== false);
        });
        return () => unsubscribe();
    }, []);

    return { isOnline };
};
