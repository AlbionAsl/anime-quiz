// src/components/AnimeCard.tsx - RESPONSIVE VERSION

import React from 'react';
import {
  StyleSheet,
  Image,
  View,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import {
  Card,
  Text,
  useTheme,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getCardDimensions, getGridColumns, responsiveFontSize, responsiveSpacing } from '../utils/responsive';

interface AnimeCardProps {
  anime: {
    id: number | null;
    title: string;
    coverImage: string | { uri: string };
  };
  onPress: () => void;
  hasPlayedToday?: boolean;
  todayScore?: number;
  totalQuestions?: number;
}

const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  onPress,
  hasPlayedToday,
  todayScore,
  totalQuestions = 10,
}) => {
  const theme = useTheme();
  const numColumns = getGridColumns(3);
  const cardWidth = getCardDimensions(numColumns, 16, 8);

  const imageSource = typeof anime.coverImage === 'string' 
    ? { uri: anime.coverImage }
    : anime.coverImage;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <Card style={[styles.card, { width: cardWidth }]}>
        <View style={[styles.imageContainer, { height: cardWidth * 1.4 }]}>
          <Image
            source={imageSource}
            style={styles.image}
            resizeMode="cover"
          />
          
          {hasPlayedToday && (
            <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
              <MaterialCommunityIcons
                name="check-circle"
                size={responsiveSpacing(40)}
                color={theme.colors.primary}
              />
              <Text style={styles.scoreText}>
                {todayScore}/{totalQuestions}
              </Text>
              <Text style={styles.playedText}>Played Today</Text>
            </View>
          )}
          
          {anime.id === null && (
            <View style={[styles.allBadge, { backgroundColor: theme.colors.primary }]}>
              <MaterialCommunityIcons name="infinity" size={responsiveSpacing(20)} color="white" />
            </View>
          )}
        </View>
        
        <Card.Content style={styles.content}>
          <Text 
            style={[styles.title, { color: theme.colors.onSurface }]} 
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {anime.title}
          </Text>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginVertical: responsiveSpacing(4),
    elevation: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreText: {
    color: 'white',
    fontSize: responsiveFontSize(24),
    fontWeight: 'bold',
    marginTop: responsiveSpacing(8),
  },
  playedText: {
    color: 'white',
    fontSize: responsiveFontSize(12),
    marginTop: responsiveSpacing(4),
    opacity: 0.9,
  },
  allBadge: {
    position: 'absolute',
    top: responsiveSpacing(8),
    right: responsiveSpacing(8),
    borderRadius: 20,
    padding: responsiveSpacing(8),
  },
  content: {
    paddingVertical: responsiveSpacing(12),
    paddingHorizontal: responsiveSpacing(8),
    minHeight: 60,
    justifyContent: 'center',
  },
  title: {
    fontSize: responsiveFontSize(14),
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: responsiveFontSize(18),
  },
});

export default AnimeCard;