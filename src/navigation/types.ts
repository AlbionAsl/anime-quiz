// src/navigation/types.ts

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  UserCreation: undefined;
  MainTabs: undefined;
};

export type MainTabParamList = {
  Play: undefined;
  Rankings: undefined;
  Profile: undefined;
};

export type PlayStackParamList = {
  PlayHome: undefined;
  Quiz: {
    animeId: number | null;
    animeName: string;
  };
};