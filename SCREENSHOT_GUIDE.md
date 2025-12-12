# Screenshot Guide for Training Manual

This guide tells you exactly which screenshots to take and where to add them in the training manual.

## How to Add Screenshots

1. Take a screenshot of the screen described below
2. Save it with the filename suggested
3. Add it to the manual using this format:
   ```markdown
   ![Description](screenshots/filename.png)
   ```

## Required Screenshots

### 1. Login Screen
**File**: `01-login-screen.png`
**What to capture**: 
- The login page showing all three sign-in options (Google, Microsoft, Email/Password)
- Should show the "Sign Up" toggle option
- Location in manual: After "Step 1: Sign Up" section

### 2. Role Selection Screen
**File**: `02-role-selection.png`
**What to capture**:
- The role selection screen with "Player" selected
- Name input fields (First Name, Last Name)
- Position dropdown showing options (Forward, Back)
- Location in manual: After "Step 2: Complete Your Profile" section

### 3. Landing Page
**File**: `03-landing-page.png`
**What to capture**:
- The main landing page showing "MY WORKOUTS" and "STAT BOARD" buttons
- The Oaks logo/header
- Sign Out button in top right
- Location in manual: After "Step 3: Navig  ate the App" section

### 4. Workout Days List
**File**: `04-workout-days.png`
**What to capture**:
- The athlete view showing all 4 workout days (Day 1, Day 2, Day 3, Day 4)
- Week navigation controls
- Location in manual: After "Accessing the Workout Log" section

### 5. Workout Day Cards Close-up
**File**: `05-workout-day-cards.png`
**What to capture**:
- Close-up of the workout day cards showing titles and focus areas
- Location in manual: After "Understanding the Workout Days" section

### 6. Week Navigation
**File**: `06-week-navigation.png`
**What to capture**:
- Week navigation controls showing Previous/Next buttons
- Week identifier (e.g., "2025-W47")
- "Go to Current Week" button
- Location in manual: After "Week Navigation" section

### 7. Workout Session Screen
**File**: `07-workout-session.png`
**What to capture**:
- Full workout session screen showing:
  - Warm-up section (collapsed or expanded)
  - Main session exercises
  - Exercise cards with input fields
- Location in manual: After "Logging Your Exercises" section

### 8. Exercise Input Fields
**File**: `08-exercise-inputs.png`
**What to capture**:
- Close-up of exercise input fields showing:
  - Weight field (with "lbs" unit)
  - Sets field
  - Reps field
  - Large, easy-to-type input boxes
- Location in manual: After "Entering Your Data" section

### 9. Finish Workout Button
**File**: `09-finish-workout.png`
**What to capture**:
- The "Finish Workout" button at the bottom
- Completion confirmation (if possible, show the green checkmark state)
- Location in manual: After "Completing a Workout" section

### 10. Stat Board Header
**File**: `10-stat-board-header.png`
**What to capture**:
- Stat Board header showing view toggle buttons
- "Workouts Completed", "Best", "Analytics" buttons
- Location in manual: After "Accessing the Stat Board" section

### 11. Workouts Completed View
**File**: `11-workouts-completed-view.png`
**What to capture**:
- Stat Board in "Workouts Completed" view
- Table showing players with colored diamonds (green, amber, empty)
- Completion rate column
- Location in manual: After "Workouts Completed View" section

### 12. Best View
**File**: `12-best-view.png`
**What to capture**:
- Stat Board in "Best" view
- Table showing personal bests for each exercise
- Player names and scores
- Location in manual: After "Best View" section

### 13. Week Selector on Stat Board
**File**: `13-week-selector.png`
**What to capture**:
- Week selector controls on the Stat Board
- Current week displayed
- Previous/Next week buttons
- Location in manual: After "Week Navigation on Stat Board" section

### 14. Rankings Drill-in
**File**: `14-rankings-drill-in.png`
**What to capture**:
- Modal/drill-in view showing:
  - Top 10 players listed
  - Percentile groups (Top 25%, Top 50%, etc.)
  - Player rankings with numbers in brackets
- Location in manual: After "Understanding Your Ranking" section

### 15. Completion Rate Colors
**File**: `15-completion-rates.png`
**What to capture**:
- Close-up of completion rate column showing:
  - Green percentages (80%+)
  - Amber percentages (60-79%)
  - Red percentages (<60%)
- Location in manual: After "Completion Rate" section

## Tips for Taking Good Screenshots

1. **Use a clean browser window** - Close unnecessary tabs
2. **Use realistic data** - Make sure the screenshots show actual workout data (not empty states)
3. **Highlight important elements** - Consider adding arrows or highlights to point out key features
4. **Consistent sizing** - Try to keep screenshots similar sizes for consistency
5. **Mobile vs Desktop** - Consider taking both mobile and desktop versions if the app is responsive
6. **Hide sensitive data** - Blur out any real names/emails if needed for privacy

## Screenshot Tools

- **Mac**: Cmd + Shift + 4 (select area) or Cmd + Shift + 3 (full screen)
- **Windows**: Windows + Shift + S (Snipping Tool)
- **Browser Extensions**: 
  - Awesome Screenshot
  - Nimbus Screenshot
  - Full Page Screen Capture

## After Taking Screenshots

1. Create a `screenshots/` folder in the project root
2. Save all screenshots there with the filenames above
3. Update the markdown file to replace `📸 **Screenshot Placeholder**` with actual image tags
4. Consider creating a PDF version of the manual with embedded images

