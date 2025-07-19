# DAILYQUIZ - Anime Quiz App 🎌

A React Native mobile application that challenges users with daily anime trivia quizzes. Compete with other anime fans through daily, monthly, and all-time rankings while testing your knowledge across different anime series. Practice on past quizzes to improve your skills without affecting your rankings.

## 📱 Features

### 🎯 Quiz System
- **Daily Quiz**: Each anime category can only be played once per day for rankings (resets at UTC midnight)
- **Practice Mode**: Replay any past quiz without affecting rankings or statistics
- **Consistent Questions**: All users get the same questions for each category on the same day
- **Multiple Categories**: Choose from "All Anime" or specific anime series
- **Progress Tracking**: Visual progress indicators and completion status for both ranked and practice modes

### 🏆 Ranking System
- **Daily Rankings**: Compete for the highest score each day
- **Monthly Rankings**: Cumulative scores throughout the month
- **All-Time Rankings**: Overall performance across all quizzes
- **Average Score Rankings**: Top performers by average (minimum 20 quizzes required)
- **Real-time Updates**: Rankings update immediately after quiz completion
- **Practice Protection**: Only today's ranked quizzes count toward rankings and statistics

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
- **Intuitive Navigation**: Clear separation between ranked and practice modes

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
    │   ├── PlayScreen (Quiz category selection)
    │   ├── CategoryScreen (Date and mode selection)
    │   └── QuizScreen (Quiz gameplay)
    ├── RankingsScreen
    └── ProfileScreen
```

#### Core Utilities
- **quizUtils.ts**: Daily question generation, caching, and date-specific queries
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
  // Usage tracking fields
  lastUsed?: Date;
  timesUsed?: number;
  usedDates?: string[]; // Array of YYYY-MM-DD dates
  categories?: string[]; // Categories where used
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
  isPractice?: boolean; // true for practice mode, false/undefined for ranked
  answers: Array<{
    questionId: string;
    selectedOption: number;
    isCorrect: boolean;
  }>;
}
```

#### `dailyQuestions`
```typescript
{
  date: string; // YYYY-MM-DD UTC format
  category: string; // 'all' or animeId
  animeName: string;
  questions: Question[];
  generatedAt: Date;
  questionIds: string[]; // For easy tracking
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
3. **Select Category**: Choose from "All Anime" or specific anime categories
4. **Choose Mode**:
   - **Today's Quiz**: Play for rankings and statistics (once per day)
   - **Practice Mode**: Replay any past quiz without affecting your stats
5. **Answer Questions**: You have 10 questions per quiz
6. **View Results**: See your score and updated rankings (ranked mode only)
7. **Check Rankings**: Compare your performance with other players
8. **Practice & Improve**: Use practice mode to replay past quizzes and improve your skills

## 🔧 Development

### Key Features Implementation

#### Dual Quiz Modes
- **Ranked Mode**: Only today's quiz counts toward rankings and user statistics
- **Practice Mode**: Replay any past quiz without affecting rankings or stats
- **Visual Distinction**: Clear UI indicators showing which mode is active
- **Separate Tracking**: Independent completion tracking for ranked vs practice attempts

#### Daily Question System
- Uses deterministic seeding based on date and category
- Ensures all users get identical questions each day
- Implements efficient caching to reduce database queries
- Questions are pre-selected using random field indexing
- Supports historical question retrieval for practice mode

#### Ranking Algorithm
- Real-time leaderboard updates using Firestore transactions
- Separate ranking documents for different time periods
- Cached leaderboard data for optimal performance
- Support for both total score and average score rankings
- Practice mode exclusion from all ranking calculations

#### User Experience
- **Category Selection**: Browse available anime categories with completion status
- **Date Selection**: Choose between today's ranked quiz or past practice quizzes
- **Visual Hierarchy**: Clear separation between "Today" and "Replay old games" sections
- **Smart Button States**: Enabled/disabled states with completion scores displayed
- **Responsive Design**: Adapts to different screen sizes with grid layouts
- **Comprehensive Error Handling**: User-friendly feedback and error messages

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

## 🎯 Key Benefits

### For Users
- **Skill Improvement**: Practice on past quizzes without penalty
- **Fair Competition**: Only today's performance affects rankings
- **Progress Tracking**: Monitor both ranked and practice completions
- **Flexible Learning**: Choose when to compete vs when to practice
- **Historical Access**: Replay any past quiz date

### For Developers
- **Clean Architecture**: Separation between ranked and practice systems
- **Data Integrity**: Rankings only include legitimate daily attempts
- **Scalability**: Efficient question management and caching
- **Maintainability**: Clear code structure with TypeScript support
- **Extensibility**: Easy to add new features and quiz modes

This implementation provides a comprehensive quiz platform that balances competitive rankings with educational practice opportunities, ensuring users can improve their anime knowledge while maintaining fair competition standards.