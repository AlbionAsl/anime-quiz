// src/navigation/PlayNavigator.tsx

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import PlayScreen from '../screens/PlayScreen';
import CategoryScreen from '../screens/CategoryScreen';
import QuizScreen from '../screens/QuizScreen';

export type PlayStackParamList = {
  PlayHome: {
    refresh?: boolean;
    completedCategory?: string;
    score?: number;
    totalQuestions?: number;
  } | undefined;
  Category: {
    animeId: number | null;
    animeName: string;
  };
  Quiz: {
    animeId: number | null;
    animeName: string;
    date?: string;
    isPractice?: boolean;
  };
};

const Stack = createStackNavigator<PlayStackParamList>();

const PlayNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="PlayHome" component={PlayScreen} />
      <Stack.Screen name="Category" component={CategoryScreen} />
      <Stack.Screen name="Quiz" component={QuizScreen} />
    </Stack.Navigator>
  );
};

export default PlayNavigator;