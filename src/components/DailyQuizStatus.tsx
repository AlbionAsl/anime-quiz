// src/components/DailyQuizStatus.tsx

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Surface, Text, useTheme, ProgressBar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface DailyAttempt {
  category: string;
  score: number;
  totalQuestions: number;
}

interface DailyQuizStatusProps {
  attempts: DailyAttempt[];
  timeUntilReset?: {
    hours: number;
    minutes: number;
    seconds: number;
  };
}

const DailyQuizStatus: React.FC<DailyQuizStatusProps> = ({ attempts, timeUntilReset }) => {
  const theme = useTheme();

  if (attempts.length === 0 && !timeUntilReset) {
    return null;
  }

  const totalScore = attempts.reduce((sum, attempt) => sum + attempt.score, 0);
  const totalPossible = attempts.reduce((sum, attempt) => sum + attempt.totalQuestions, 0);
  const percentage = totalPossible > 0 ? totalScore / totalPossible : 0;

  return (
    <Surface style={styles.container} elevation={1}>
      <View style={styles.header}>
        <MaterialCommunityIcons
          name="calendar-today"
          size={20}
          color={theme.colors.primary}
        />
        <Text style={styles.title}>Today's Progress</Text>
      </View>
      
      {attempts.length > 0 && (
        <>
          <View style={styles.content}>
            <Text style={styles.scoreText}>
              {totalScore} / {totalPossible} correct
            </Text>
            <Text style={styles.categoryText}>
              {attempts.length} quiz{attempts.length !== 1 ? 'zes' : ''} completed
            </Text>
          </View>
          
          <ProgressBar
            progress={percentage}
            color={theme.colors.primary}
            style={styles.progressBar}
          />
        </>
      )}
      
      {timeUntilReset && (
        <View style={styles.resetTimer}>
          <MaterialCommunityIcons
            name="clock-outline"
            size={16}
            color={theme.colors.onSurfaceVariant}
          />
          <Text style={styles.resetText}>
            Resets in {timeUntilReset.hours}h {timeUntilReset.minutes}m {timeUntilReset.seconds}s
          </Text>
        </View>
      )}
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  content: {
    marginBottom: 12,
  },
  scoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  categoryText: {
    fontSize: 14,
    opacity: 0.7,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  resetTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  resetText: {
    fontSize: 14,
    marginLeft: 6,
    opacity: 0.7,
  },
});

export default DailyQuizStatus;