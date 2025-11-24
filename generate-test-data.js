// Script to generate test workout data for the last 8 weeks
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import 'firebase/compat/auth';

const firebaseConfig = {
  apiKey: "AIzaSyD7mPaCU8OVMGLJdPh7EcRSPgCepEszEWs",
  authDomain: "oaks-snc.firebaseapp.com",
  projectId: "oaks-snc",
  storageBucket: "oaks-snc.firebasestorage.app",
  messagingSenderId: "517477387458",
  appId: "1:517477387458:web:7067c6c41aaeedb9efff5b",
  measurementId: "G-KDQE66YWZS"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

// Exercise base weights (realistic starting points)
const exerciseBaseWeights = {
  'd1_1': 225, // Hex Bar Deadlift
  'd1_2': 0,   // Dips (bodyweight)
  'd1_3': 120, // Lat Pull Down
  'd1_4': 0,   // Ab Roll Out (bodyweight)
  'd1_5': 0,   // Back Extension (bodyweight)
  'd2_1': 0,   // Split Squat Jump (bodyweight)
  'd2_2': 0,   // Split Squat Hold (bodyweight)
  'd2_3': 135, // Incline Bench Press
  'd2_4': 100, // Seated Row
  'd3_1': 185, // Squat
  'd3_2': 95,  // Hang Cleans & Press
  'd3_3': 0,   // Bear Crawls (distance)
  'd3_4': 0,   // Wall Sits (time)
  'd4_1': 0,   // Sprints (time in seconds)
};

// Sprint base times (in seconds)
const sprintBaseTime = 4.8;

// Get ISO week number for a date
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week: weekNo };
}

// Get ISO week start (Monday)
function getISOWeekStart(year, week) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = simple.getUTCDay();
  const ISOweekStart = simple;
  if (dow <= 4) {
    ISOweekStart.setUTCDate(simple.getUTCDate() - simple.getUTCDay() + 1);
  } else {
    ISOweekStart.setUTCDate(simple.getUTCDate() + 8 - simple.getUTCDay());
  }
  return ISOweekStart;
}

// Generate realistic player names
const firstNames = [
  'Adam', 'Alex', 'Andrew', 'Ben', 'Blake', 'Brad', 'Brett', 'Brian', 'Cameron', 'Carter',
  'Chase', 'Chris', 'Cole', 'Connor', 'Daniel', 'David', 'Derek', 'Dylan', 'Ethan', 'Evan',
  'Garrett', 'Grant', 'Hunter', 'Jack', 'Jacob', 'James', 'Jason', 'Jake', 'Jared', 'Jesse',
  'John', 'Jordan', 'Josh', 'Justin', 'Kyle', 'Logan', 'Luke', 'Marcus', 'Mark', 'Matt',
  'Max', 'Michael', 'Mike', 'Nathan', 'Nick', 'Noah', 'Owen', 'Parker', 'Patrick', 'Paul',
  'Ryan', 'Sam', 'Sean', 'Seth', 'Shane', 'Shawn', 'Spencer', 'Steven', 'Tanner', 'Taylor',
  'Thomas', 'Tim', 'Todd', 'Travis', 'Trent', 'Trey', 'Tristan', 'Tyler', 'Will', 'Zach',
  'Zachary', 'Aaron', 'Anthony', 'Brandon', 'Brendan', 'Brent', 'Brody', 'Bryce', 'Caleb', 'Chad'
];

const lastNames = [
  'Anderson', 'Baker', 'Brown', 'Campbell', 'Carter', 'Clark', 'Collins', 'Davis', 'Edwards', 'Evans',
  'Foster', 'Garcia', 'Green', 'Hall', 'Harris', 'Hernandez', 'Hill', 'Jackson', 'Johnson', 'Jones',
  'Kelly', 'King', 'Lee', 'Lewis', 'Martin', 'Martinez', 'Miller', 'Mitchell', 'Moore', 'Morris',
  'Murphy', 'Nelson', 'Parker', 'Patterson', 'Phillips', 'Roberts', 'Robinson', 'Rodriguez', 'Scott', 'Smith',
  'Stewart', 'Taylor', 'Thomas', 'Thompson', 'Turner', 'Walker', 'White', 'Williams', 'Wilson', 'Wright',
  'Young', 'Adams', 'Allen', 'Bailey', 'Bell', 'Bennett', 'Brooks', 'Butler', 'Cook', 'Cooper',
  'Cox', 'Cruz', 'Diaz', 'Flores', 'Gonzalez', 'Gray', 'Griffin', 'Hayes', 'Hughes', 'James',
  'Jenkins', 'Kennedy', 'Kim', 'Lopez', 'Morgan', 'Ortiz', 'Perry', 'Reed', 'Richardson', 'Rivera'
];

async function generateTestData() {
  try {
    // Sign in anonymously
    await auth.signInAnonymously();
    console.log('✅ Authenticated');

    // Get existing players
    const playersSnapshot = await db.collection('roster').get();
    const existingPlayers = [];
    playersSnapshot.forEach((doc) => {
      existingPlayers.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📋 Found ${existingPlayers.length} existing players`);

    // Generate players if we don't have enough
    const targetPlayerCount = 80;
    const playersToCreate = targetPlayerCount - existingPlayers.length;
    
    if (playersToCreate > 0) {
      console.log(`👥 Creating ${playersToCreate} new players...`);
      
      // Create players with realistic names
      const usedNames = new Set(existingPlayers.map(p => p.name.toLowerCase()));
      
      for (let i = 0; i < playersToCreate; i++) {
        let firstName, lastName, fullName;
        let attempts = 0;
        
        // Generate unique name
        do {
          firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
          lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
          fullName = `${firstName} ${lastName}`;
          attempts++;
        } while (usedNames.has(fullName.toLowerCase()) && attempts < 100);
        
        usedNames.add(fullName.toLowerCase());
        
        // Random position for players
        const position = Math.random() > 0.5 ? 'Forward' : 'Back';
        
        const playerData = {
          name: fullName,
          role: 'Player',
          position: position,
          userId: `test_${Date.now()}_${i}`, // Test user ID
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@test.oaks.com`
        };
        
        try {
          const docRef = await db.collection('roster').add(playerData);
          existingPlayers.push({ id: docRef.id, ...playerData });
          
          if ((i + 1) % 10 === 0) {
            console.log(`   Created ${i + 1}/${playersToCreate} players...`);
            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`   ⚠️  Error creating player ${i + 1}:`, error.message);
          // Continue with next player
        }
      }
      
      console.log(`✅ Created ${playersToCreate} new players`);
    }

    const players = existingPlayers.filter(p => p.role === 'Player');
    console.log(`📋 Total players: ${players.length}`);

    // Get current week
    const now = new Date();
    const currentWeek = getISOWeek(now);

    // Generate data for last 5 weeks
    const weeksToGenerate = [];
    for (let i = 4; i >= 0; i--) {
      const weekStart = getISOWeekStart(currentWeek.year, currentWeek.week);
      weekStart.setUTCDate(weekStart.getUTCDate() - (i * 7));
      const week = getISOWeek(weekStart);
      weeksToGenerate.push(week);
    }

    console.log(`📅 Generating data for ${weeksToGenerate.length} weeks (last 5 weeks)`);

    const days = [
      { id: 'day1', exercises: ['d1_1', 'd1_2', 'd1_3', 'd1_4', 'd1_5'] },
      { id: 'day2', exercises: ['d2_1', 'd2_2', 'd2_3', 'd2_4'] },
      { id: 'day3', exercises: ['d3_1', 'd3_2', 'd3_3', 'd3_4'] },
      { id: 'day4', exercises: ['d4_1'] }, // Sprint
    ];

    let totalLogs = 0;

    // Categorize players into groups based on completion rate
    const totalPlayers = players.length;
    const top5Percent = Math.max(1, Math.floor(totalPlayers * 0.05));
    const bottom5Percent = Math.max(1, Math.floor(totalPlayers * 0.05));
    
    console.log(`📊 Player distribution: Top 5% (${top5Percent}), Middle 90% (${totalPlayers - top5Percent - bottom5Percent}), Bottom 5% (${bottom5Percent})`);

    // Shuffle players to randomize who gets which category
    const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
    
    let playerIndex = 0;
    for (const player of shuffledPlayers) {
      if (player.role !== 'Player') continue; // Skip coaches
      playerIndex++;

      // Assign completion rate based on player category
      let playerConsistency;
      if (playerIndex <= top5Percent) {
        // Top 5%: 100% completion rate
        playerConsistency = 1.0;
      } else if (playerIndex > totalPlayers - bottom5Percent) {
        // Bottom 5%: 40-60% completion rate (worse than others)
        playerConsistency = 0.4 + (Math.random() * 0.2);
      } else {
        // Middle 90%: ~90% completion rate (85-95% range)
        playerConsistency = 0.85 + (Math.random() * 0.1);
      }
      
      for (const week of weeksToGenerate) {
        // Use player consistency for workout logging
        const shouldLog = Math.random() < playerConsistency;

        if (!shouldLog) continue;

        for (const day of days) {
          // For top performers, always log all days. For others, use consistency
          const dayLogChance = playerConsistency === 1.0 ? 1.0 : playerConsistency + (Math.random() * 0.1);
          const shouldLogDay = Math.random() < dayLogChance;
          if (!shouldLogDay) continue;

          const weekStart = getISOWeekStart(week.year, week.week);
          const dayOffset = days.indexOf(day);
          const logDate = new Date(weekStart);
          logDate.setUTCDate(weekStart.getUTCDate() + dayOffset);
          // Realistic workout times: morning (6-9 AM) or afternoon (2-6 PM)
          const isMorning = Math.random() > 0.6;
          if (isMorning) {
            logDate.setUTCHours(6 + Math.floor(Math.random() * 3));
          } else {
            logDate.setUTCHours(14 + Math.floor(Math.random() * 4));
          }
          logDate.setUTCMinutes(Math.floor(Math.random() * 60));

          const weekNumber = weeksToGenerate.indexOf(week);
          // Vary progress - some players improve faster, some slower
          const playerProgressRate = 0.01 + (Math.random() * 0.03); // 1-4% improvement per week
          const progressFactor = 1 + (weekNumber * playerProgressRate);

          const data = {};
          let exercisesWithData = 0;
          const totalExercises = day.exercises.length;

          for (const exerciseId of day.exercises) {
            const baseWeight = exerciseBaseWeights[exerciseId];
            const isSprint = exerciseId === 'd4_1';

            if (isSprint) {
              // Sprint: sets and time
              const sets = 8;
              const time = (sprintBaseTime - (weekNumber * 0.05) + (Math.random() * 0.3 - 0.15)).toFixed(2);
              data[`${exerciseId}_sets`] = sets.toString();
              data[`${exerciseId}_time`] = time;
              exercisesWithData++;
            } else if (baseWeight > 0) {
              // Weighted exercise
              const weight = Math.round((baseWeight * progressFactor + (Math.random() * 10 - 5)) / 5) * 5;
              const sets = exerciseId === 'd1_1' || exerciseId === 'd3_1' ? 4 : 3;
              const reps = exerciseId === 'd1_1' || exerciseId === 'd3_1' ? 5 : 8;
              data[`${exerciseId}_weight`] = weight.toString();
              data[`${exerciseId}_sets`] = sets.toString();
              data[`${exerciseId}_reps`] = reps.toString();
              exercisesWithData++;
            } else {
              // Bodyweight exercise - just log sets/reps
              const sets = exerciseId === 'd1_4' ? 4 : exerciseId === 'd3_4' ? 2 : 3;
              const reps = exerciseId === 'd3_4' ? 120 : 8; // Wall sits in seconds
              data[`${exerciseId}_sets`] = sets.toString();
              if (exerciseId !== 'd3_4') {
                data[`${exerciseId}_reps`] = reps.toString();
              }
              exercisesWithData++;
            }
          }

          // Mark as complete if all exercises have data
          const completed = exercisesWithData === totalExercises;

          const logId = `${player.id}_${day.id}_${week.year}-W${week.week}`;
          const log = {
            playerId: player.id,
            dayId: day.id,
            timestamp: logDate.getTime(),
            weekYear: week.year,
            week: week.week,
            data: data,
            completed: completed
          };

          try {
            await db.collection('logs').doc(logId).set(log);
            totalLogs++;
          } catch (error) {
            // Skip this log if there's an error (might be duplicate or permission issue)
            console.error(`   ⚠️  Error creating log for ${player.name} ${day.id} week ${week.year}-W${week.week}:`, error.message);
          }
        }
      }
    }

    console.log(`✅ Generated ${totalLogs} workout logs`);
    console.log('🎉 Test data generation complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating test data:', error);
    process.exit(1);
  }
}

generateTestData();

