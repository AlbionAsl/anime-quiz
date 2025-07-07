import os

def extract_and_combine_files(project_folder, file_paths, output_file='full_code.txt'):
    with open(output_file, 'w', encoding='utf-8') as outfile:
        for file_path in file_paths:
            full_path = os.path.join(project_folder, file_path)
            if os.path.exists(full_path):
                file_name = os.path.basename(full_path)
                outfile.write(f"{file_name}<\n\n")

                try:
                    with open(full_path, 'r', encoding='utf-8') as infile:
                        content = infile.read()
                        outfile.write(content)
                except UnicodeDecodeError:
                    outfile.write(f"Error: Unable to read {full_path} due to encoding issues.\n")
                except Exception as e:
                    outfile.write(f"Error: An unexpected error occurred while reading {file_name}: {str(e)}\n")

                outfile.write(f"\n\nEND OF {file_name}>\n\n")
            else:
                outfile.write(f"Error: File not found - {full_path}\n\n")

    print(f"File extraction complete. Output saved to {output_file}")

# Example usage:
project_folder = "C:\\Users\\Albion\\Documents\\AlbionsLocal\\Projects\\DAILYQUIZ\\"
# project_folder = "D:\\Albion\\Projects\\ANIMEQUIZ\\" # LaniKamer
file_paths = [
    
    "src/components/AnimeCard.tsx",
    "src/components/DailyQuizStatus.tsx",
    "src/navigation/AppNavigator.tsx",
    "src/navigation/MainTabNavigator.tsx",
    "src/navigation/PlayNavigator.tsx",
    "src/navigation/types.ts",
    "src/screens/PlayScreen.tsx",
    "src/screens/QuizScreen.tsx",
    "src/screens/RankingsScreen.tsx",
    "src/screens/LoginScreen.tsx",
    "src/screens/RegisterScreen.tsx",
    "src/screens/UserCreationScreen.tsx",
    "src/screens/ProfileScreen.tsx",
    # "src/types/types.ts",
    # "src/types/popup.ts",
    # "src/utils/logger.ts",
    "src/utils/firebase.ts",
    "src/utils/quizUtils.ts",
    "src/utils/rankingUtils.ts",
    # "src/utils/retry.ts",
    "src/themes/theme.ts",
    "App.tsx",
    # "app.config.ts"
]
extract_and_combine_files(project_folder, file_paths)