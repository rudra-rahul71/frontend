import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RecordingScreen from './screens/RecordingScreen';
import SummaryScreen from './screens/SummaryScreen';
import WaitingScreen from './screens/WaitingScreen';
import SuccessScreen from './screens/SuccessScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Recording">
        <Stack.Screen 
          name="Recording" 
          component={RecordingScreen} 
          options={{ headerShown: false }} 
        />
        <Stack.Screen 
          name="Summary" 
          component={SummaryScreen} 
          options={{ 
            title: 'Review & Submit',
            headerStyle: { backgroundColor: '#0a0e27' },
            headerTintColor: '#ccd6f6',
          }} 
        />
        <Stack.Screen 
          name="Waiting" 
          component={WaitingScreen} 
          options={{ 
            headerShown: false,
            // Prevent going back to recording after saving offline
            gestureEnabled: false,
          }} 
        />
        <Stack.Screen 
          name="Success" 
          component={SuccessScreen} 
          options={{ 
            headerShown: false,
            // Prevent going back after successful submission
            gestureEnabled: false,
          }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
