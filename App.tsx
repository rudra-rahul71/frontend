import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RecordingScreen from './screens/RecordingScreen';
import SummaryScreen from './screens/SummaryScreen';

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
          options={{ title: 'Summary & Edits' }} 
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
