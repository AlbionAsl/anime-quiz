# DAILYQUIZ - Anime Quiz App 🎌

A React Native mobile application that challenges users with daily anime trivia quizzes. Compete with other anime fans through daily, monthly, and all-time rankings while testing your knowledge across different anime series.

## 📱 Features

### 🎯 Daily Quiz System
- **One Quiz Per Day**: Each anime category can only be played once per day (resets at UTC midnight)
- **Consistent Questions**: All users get the same questions for each category on the same day
- **Multiple Categories**: Choose from "All Anime" or specific anime series
- **Progress Tracking**: Visual progress indicators and daily completion status

### 🏆 Ranking System
- **Daily Rankings**: Compete for the highest score each day
- **Monthly Rankings**: Cumulative scores throughout the month
- **All-Time Rankings**: Overall performance across all quizzes
- **Average Score Rankings**: Top performers by average (minimum 20 quizzes required)
- **Real-time Updates**: Rankings update immediately after quiz completion

### 👤 User Management
- **Email Authentication**: Secure sign-up and login with email verification
- **Custom Usernames**: Unique usernames with real-time availability checking
- **Profile Statistics**: Detailed performance analytics and category breakdowns
- **Achievement System**: Coming soon - unlock achievements for completing challenges

### 🎨 Modern UI/UX
- **Dark Theme**: Eye-friendly dark mode interface
- **Material Design**: Clean, intuitive interface using React Native Paper
- **Responsive Design**: Optimized for different screen sizes
- **Real-time Feedback**: Instant question feedback and progress indicators

## 🏗️ Technical Architecture

### Frontend Stack
- **React Native** with TypeScript
- **React Navigation** for navigation management
- **React Native Paper** for Material Design components
- **Expo** for development and build management

### Backend Services
- **Firebase Authentication** for user management
- **Cloud Firestore** for real-time data storage
- **Serverless Architecture** with efficient caching systems

### Key Components

#### Navigation Structure
```
App (Provider)
├── LoginScreen / RegisterScreen
├── EmailVerificationScreen
├── UserCreationScreen
└── MainTabNavigator
    ├── PlayNavigator
    │   ├── PlayScreen (Quiz selection)
    │   └── QuizScreen (Quiz gameplay)
    ├── RankingsScreen
    └── ProfileScreen
```

#### Core Utilities
- **quizUtils.ts**: Daily question generation and caching
- **rankingUtils.ts**: Leaderboard management and statistics
- **firebase.ts**: Firebase configuration and initialization

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI
- Firebase project with Firestore and Authentication enabled

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd DAILYQUIZ
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Environment Configuration**
   
   Create a `.env` file in the root directory:
   ```env
   FIREBASE_API_KEY=your_api_key
   FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   FIREBASE_PROJECT_ID=your_project_id
   FIREBASE_STORAGE_BUCKET=your_project.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   FIREBASE_APP_ID=your_app_id
   FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

4. **Firebase Setup**
   
   Configure your Firebase project with:
   - **Authentication**: Enable Email/Password provider
   - **Firestore**: Set up the required collections (see Database Schema)
   - **Security Rules**: Configure appropriate read/write permissions

5. **Start the development server**
   ```bash
   npx expo start
   ```

## 📊 Database Schema

### Collections Structure

#### `users`
```typescript
{
  uid: string;
  username: string; // lowercase for uniqueness
  displayUsername: string; // original case for display
  email: string;
  totalQuizzes: number;
  totalCorrectAnswers: number;
  createdAt: string;
  stats: {
    allTime: {
      totalQuizzes: number;
      totalCorrectAnswers: number;
      averageScore: number;
    };
    categories: {
      [categoryId]: {
        totalQuizzes: number;
        totalCorrectAnswers: number;
        averageScore: number;
      };
    };
  };
}
```

#### `questions`
```typescript
{
  id: string;
  question: string;
  options: string[];
  correctAnswer: number; // index of correct option
  animeId: number; // null for general questions
  animeName: string;
  random: number; // for efficient random selection
}
```

#### `animes`
```typescript
{
  id: number;
  title: string;
  coverImage: string;
  popularity: number; // for sorting
}
```

#### `dailyQuizzes`
```typescript
{
  userId: string;
  date: string; // YYYY-MM-DD UTC format
  category: string; // 'all' or animeId
  animeName: string;
  score: number;
  totalQuestions: number;
  completedAt: Date;
  answers: Array<{
    questionId: string;
    selectedOption: number;
    isCorrect: boolean;
  }>;
}
```

#### `rankings`
```typescript
{
  period: 'daily' | 'monthly' | 'allTime';
  periodValue: string; // date string or 'all'
  category: string;
  userId: string;
  username: string;
  score: number;
  totalQuestions: number;
  averageScore: number;
  quizCount: number;
  lastUpdated: Date;
}
```

## 🎮 How to Play

1. **Create Account**: Sign up with email and verify your account
2. **Choose Username**: Pick a unique username for the leaderboards
3. **Select Quiz**: Choose from "All Anime" or specific anime categories
4. **Answer Questions**: You have 10 questions per quiz
5. **View Results**: See your score and updated rankings
6. **Check Rankings**: Compare your performance with other players
7. **Come Back Tomorrow**: New questions are available each day!

## 🔧 Development

### Key Features Implementation

#### Daily Question System
- Uses deterministic seeding based on date and category
- Ensures all users get identical questions each day
- Implements efficient caching to reduce database queries
- Questions are pre-selected using random field indexing

#### Ranking Algorithm
- Real-time leaderboard updates using Firestore transactions
- Separate ranking documents for different time periods
- Cached leaderboard data for optimal performance
- Support for both total score and average score rankings

#### User Experience
- Responsive design adapting to different screen sizes
- Smooth animations and transitions
- Real-time progress tracking
- Comprehensive error handling and user feedback

### Testing
```bash
# Run tests (when implemented)
npm test

# Type checking
npx tsc --noEmit
```

### Building for Production
```bash
# Build for iOS
npx expo build:ios

# Build for Android
npx expo build:android

# Using EAS Build (recommended)
npx eas build --platform all
```
TEST