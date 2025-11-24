import { WorkoutDay, ExerciseDef } from '../types';

const WARMUP: ExerciseDef[] = [
  { id: 'wu1', name: 'Skaters', reps: '2x20', videoUrl: 'https://youtu.be/9_jLW6VkU8A?si=XJA-qQVnFg9n4xmj', isMetric: false },
  { id: 'wu2', name: 'Single Leg Pogos', reps: '2x20', videoUrl: 'https://youtube.com/shorts/8BRYmMpgxHA?si=J8VgGiWsk9OXh-as', isMetric: false },
  { id: 'wu3', name: 'Two Leg Pogos', reps: '2x20', videoUrl: 'https://youtube.com/shorts/mOlZ8IIaAVo?si=EpeSYIBqoz3kfN_M', isMetric: false },
  { id: 'wu4', name: 'Vertical Bounds', reps: '2x10', videoUrl: 'https://youtube.com/shorts/OAhgPwTLJoo?si=NpXYFOOEA5G1_usq', isMetric: false },
  { id: 'wu5', name: 'Horizontal Bounds', reps: '2x10', videoUrl: 'https://youtu.be/xAk2tKNPsUw?si=LfC0pCiyJr2m1zCY', isMetric: false },
  { id: 'wu6', name: 'A-Skip', reps: '2x20', isMetric: false },
  { id: 'wu7', name: 'B-Skip', reps: '2x20', videoUrl: 'https://youtu.be/A7r6yCpmSrA?si=rG1ZF8wY7VsJoVBl', isMetric: false },
];

const DAY1: WorkoutDay = {
  id: 'day1',
  title: 'Day 1',
  focus: 'Force Production',
  exercises: [
    { id: 'd1_1', name: 'Hex Bar Deadlift', reps: '4x5', videoUrl: 'https://youtube.com/shorts/GFF0APu-m7I?si=9EQKMQ69xTwl1lWB', isMetric: true },
    { id: 'd1_2', name: 'Dips', reps: '3x8', videoUrl: 'https://youtube.com/shorts/SXBksC78v8M?si=ZhhhBMtX7I6UK4fW', isMetric: true },
    { id: 'd1_3', name: 'Lat Pull Down', reps: '3x8', videoUrl: 'https://youtube.com/shorts/z-lxcsIN4T4?si=Z9TuwWkdROshlGP0', isMetric: true },
    { id: 'd1_4', name: 'Barbell Ab Roll Out', reps: '4x8', videoUrl: 'https://youtube.com/shorts/YX2Pvb3Kn-k?si=dnhQ3uyMAe-kiWAX', isMetric: true },
    { id: 'd1_5', name: 'Back Extension', reps: '3x8', videoUrl: 'https://youtube.com/shorts/8rXdAAwm8Rs?si=XY157cWoQLtA4Ut1', isMetric: true },
  ]
};

const DAY2: WorkoutDay = {
  id: 'day2',
  title: 'Day 2',
  focus: 'Power & Stability',
  exercises: [
    { id: 'd2_1', name: 'Split Squat Jump', reps: '3x8 (Alt)', videoUrl: 'https://youtube.com/shorts/mIUIcuq1FcU?si=HR_Qjd7dMrm90vKo', isMetric: true },
    { id: 'd2_2', name: 'Split Squat Hold', reps: '2x60s (Toes)', videoUrl: 'https://youtube.com/shorts/k20dCuZ7MaM?si=NNq-rOLxqjd7RGmS', isMetric: true },
    { id: 'd2_3', name: 'Incline Bench Press', reps: '3x8', videoUrl: 'https://youtube.com/shorts/8fXfwG4ftaQ?si=g1shIgXrne4m-Tdj', isMetric: true },
    { id: 'd2_4', name: 'Seated Row', reps: '3x8', videoUrl: 'https://youtu.be/NYok5zjbDcw?si=TuWNHHZ_KNPdXgwz', isMetric: true },
  ]
};

const DAY3: WorkoutDay = {
  id: 'day3',
  title: 'Day 3',
  focus: 'Work Capacity (Grit)',
  exercises: [
    { id: 'd3_1', name: 'Squat', reps: '5x5', videoUrl: 'https://youtube.com/shorts/MLoZuAkIyZI?si=fEpeWAHPuw8TD5rn', isMetric: true },
    { id: 'd3_2', name: 'Hang Cleans & Press', reps: '5x5', videoUrl: 'https://youtu.be/Kxm4UqA_g68?si=ZNiuauNzA5haOgrl', isMetric: true },
    { id: 'd3_3', name: 'Bear Crawls', reps: '4x30m', videoUrl: 'https://youtube.com/shorts/t105EdurTDA?si=BvV2iVwYbfdZtEIz', isMetric: true },
    { id: 'd3_4', name: 'Wall Sits', reps: '2x2min (Toes)', videoUrl: 'https://youtube.com/shorts/mvRT6o3D1iI?si=3xFcus2D3ihy3b5h', isMetric: true },
  ]
};

const DAY4: WorkoutDay = {
  id: 'day4',
  title: 'Day 4',
  focus: 'Speed',
  exercises: [
    { id: 'd4_1', name: 'Sprints (30m)', reps: '8x30m (100%)', isMetric: true, isSprint: true }, // No link provided in source for sprints specifically, handled generic description
  ]
};

export const PROGRAM = {
  WARMUP,
  DAYS: [DAY1, DAY2, DAY3, DAY4]
};
