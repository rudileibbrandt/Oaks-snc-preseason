import { RosterPlayer } from '../types';

// Player roster data for 2026 season
// Photos should be placed in public/photos/ directory
export const ROSTER_PLAYERS: RosterPlayer[] = [
  // Everyone trains in the Gold group (from Nov 2026). Earlier Black/Silver/Bronze splits are in git history.
  { name: "Andrew Campbell", trainingGroup: "Gold", height: "5'9\"", weight: 186, bestPosition: 6, secondPosition: 7, thirdPosition: 12 },
  { name: "Armando Hall", trainingGroup: "Gold", height: "6'1\"", weight: 211, bestPosition: 8, secondPosition: 6, thirdPosition: 7 },
  { name: "Asher Ball", trainingGroup: "Gold", height: "6'0\"", weight: 211, bestPosition: 14, secondPosition: 13, thirdPosition: 6 },
  { name: "Brandon Levyash", trainingGroup: "Gold", height: "6'1\"", weight: 241, bestPosition: 2, secondPosition: 1, thirdPosition: 6 },
  { name: "Chris Leibbrandt", trainingGroup: "Gold", height: "5'11\"", weight: 187, kicker: true, bestPosition: 9, secondPosition: 10, thirdPosition: 15 },
  { name: "Jack Younger", trainingGroup: "Gold", height: "5'8\"", weight: 159, kicker: true, bestPosition: 10, secondPosition: 9, thirdPosition: 15 },
  { name: "Jackson Evans", trainingGroup: "Gold", grade: 10, classYear: "Sophomore", bestPosition: 1, secondPosition: 2, thirdPosition: 3 },
  { name: "Jared Randall", trainingGroup: "Gold", height: "5'7\"", weight: 185, kicker: true, bestPosition: 12, secondPosition: 10, thirdPosition: 15 },
  { name: "Jules Prevot", trainingGroup: "Gold", height: "6'2\"", weight: 202, bestPosition: 4, secondPosition: 5, thirdPosition: 6 },
  { name: "Kai Stone", trainingGroup: "Gold", height: "6'3\"", weight: 249, bestPosition: 3, secondPosition: 4, thirdPosition: 6 },
  { name: "Kayvon Foreman", trainingGroup: "Gold", height: "5'9\"", weight: 174, bestPosition: 13, secondPosition: 12, thirdPosition: 11 },
  { name: "Luke Choochagi", trainingGroup: "Gold" },
  { name: "Rowan Hester", trainingGroup: "Gold", height: "6'7\"", weight: 237, bestPosition: 5, secondPosition: 4, thirdPosition: 6 },
  { name: "Ryan Vaupen", trainingGroup: "Gold", height: "5'10\"", weight: 183, grade: 12, classYear: "Senior", bestPosition: 7, secondPosition: 6, thirdPosition: 8 },
  { name: "Stephen Cordano", trainingGroup: "Gold", height: "5'10\"", weight: 168, bestPosition: 11, secondPosition: 14, thirdPosition: 13 },
  { name: "Tanner Gates", trainingGroup: "Gold", height: "5'8\"", weight: 177, bestPosition: 14, secondPosition: 11, thirdPosition: 9 },
  { name: "Walker French", trainingGroup: "Gold", height: "5'7\"", weight: 245, bestPosition: 2, secondPosition: 3, thirdPosition: 1 },
  { name: "Rohit Mareddy", trainingGroup: "Gold", height: "6'0\"", weight: 251, bestPosition: 1, secondPosition: 2, thirdPosition: 3 },
  { name: "Dante Pickens", trainingGroup: "Gold", height: "5'10\"", weight: 210, bestPosition: 1, secondPosition: 6, thirdPosition: 2 },
  { name: "Nathan Hoge", trainingGroup: "Gold", height: "6'3\"", weight: 226, bestPosition: 5, secondPosition: 4, thirdPosition: 3 },
  { name: "Adam Holroyd", trainingGroup: "Gold", bestPosition: 15, secondPosition: 11, thirdPosition: 14 },
  { name: "Johann Turk", trainingGroup: "Gold", height: "5'9\"", weight: 165, grade: 12, classYear: "Senior", bestPosition: 11, secondPosition: 14, thirdPosition: 15 },
  { name: "Thomas Eldridge", trainingGroup: "Gold", height: "5'9\"", weight: 166, bestPosition: 14, secondPosition: 11, thirdPosition: 13 },

  { name: "Zachary Filal", trainingGroup: "Gold", height: "5'8\"", weight: 159, bestPosition: 10, secondPosition: 15, thirdPosition: 9 },
  { name: "Rudy Duggineni", trainingGroup: "Gold", height: "6'6\"", weight: 207, bestPosition: 5, secondPosition: 4, thirdPosition: 6 },
  { name: "Benjamin Knauf", trainingGroup: "Gold", height: "6'3\"", weight: 155, bestPosition: 4, secondPosition: 5, thirdPosition: 6 },
  { name: "Chase Chippero", trainingGroup: "Gold", height: "6'0\"", weight: 216, bestPosition: 1, secondPosition: 4, thirdPosition: 6 },
  { name: "Eddie Westmoreland", trainingGroup: "Gold", height: "5'7\"", weight: 139, bestPosition: 9, secondPosition: 14, thirdPosition: 15 },
  { name: "Finn Hegarty", trainingGroup: "Gold", height: "5'8\"", weight: 235, bestPosition: 3, secondPosition: 1, thirdPosition: 2 },
  { name: "Gavin Carney", trainingGroup: "Gold", height: "5'9\"", weight: 191, bestPosition: 7, secondPosition: 6, thirdPosition: 12 },
  { name: "Givani Jimenez", trainingGroup: "Gold", height: "5'10\"", weight: 160, bestPosition: 11, secondPosition: 9, thirdPosition: 15 },
  { name: "Jack Kroha", trainingGroup: "Gold", height: "5'7\"", weight: 145, bestPosition: 11, secondPosition: 14, thirdPosition: 11 },
  { name: "Jackson Neufeld", trainingGroup: "Gold", height: "5'7\"", weight: 192, bestPosition: 7, secondPosition: 6, thirdPosition: 2 },
  { name: "Luke Cubiburu", trainingGroup: "Gold" },
  { name: "Nicholas Donnelly", trainingGroup: "Gold", height: "5'8\"", weight: 154, bestPosition: 14, secondPosition: 11, thirdPosition: 15 },
  { name: "Reed Schassberger", trainingGroup: "Gold", height: "6'2\"", weight: 290, bestPosition: 1, secondPosition: 3, thirdPosition: 4 },
  { name: "Robert Duncan Anderson", trainingGroup: "Gold", height: "6'0\"", weight: 190, kicker: true, bestPosition: 10, secondPosition: 12, thirdPosition: 7 },
  { name: "Sean Mallie-Ramos", trainingGroup: "Gold", height: "6'2\"", weight: 185, bestPosition: 6, secondPosition: 4, thirdPosition: 8 },
  { name: "Tyler Leary", trainingGroup: "Gold", height: "6'1\"", weight: 182, bestPosition: 6, secondPosition: 4, thirdPosition: 11 },
  { name: "Vincenzo Uang", trainingGroup: "Gold", height: "5'10\"", weight: 149, bestPosition: 15, secondPosition: 9, thirdPosition: 10 },
  { name: "Xerxes Irani", trainingGroup: "Gold", height: "5'8\"", weight: 125, bestPosition: 11, secondPosition: 14, thirdPosition: 15 },
  { name: "Zayn Fassi-Fihri", trainingGroup: "Gold", bestPosition: 14, secondPosition: 11, thirdPosition: 13 },
  { name: "Aden Riley", trainingGroup: "Gold", height: "5'7\"", weight: 134, bestPosition: 15, secondPosition: 11, thirdPosition: 14 },
  { name: "Madden Casson", trainingGroup: "Gold", height: "5'9\"", weight: 142, bestPosition: 14, secondPosition: 11, thirdPosition: 13 },
  { name: "Ruston Safehashemi", trainingGroup: "Gold", height: "5'8\"", weight: 158, grade: 11, classYear: "Junior", bestPosition: 11, secondPosition: 14, thirdPosition: 15 },

  { name: "Caleb Henderson", trainingGroup: "Gold", height: "6'2\"", weight: 176, bestPosition: 13, secondPosition: 11, thirdPosition: 6 },
  { name: "Lincoln Hester", trainingGroup: "Gold", height: "6'2\"", weight: 192, bestPosition: 4, secondPosition: 5, thirdPosition: 6 },
  { name: "Maxwell Ardelean", trainingGroup: "Gold", height: "6'0\"", weight: 186, bestPosition: 5, secondPosition: 4, thirdPosition: 6 },
  { name: "Duke Chiosso", trainingGroup: "Gold", height: "6'1\"", weight: 162, grade: 9, classYear: "Freshman", bestPosition: 8 },
  { name: "Easton Popick", trainingGroup: "Gold", height: "5'9\"", weight: 154 },
  { name: "Frank Macias", trainingGroup: "Gold", height: "5'8\"", weight: 156, grade: 9, classYear: "Freshman" },
  { name: "Gabriel Parsons", trainingGroup: "Gold", height: "6'1\"", weight: 246 },
  { name: "Josh Davis", trainingGroup: "Gold", height: "5'9\"", weight: 156, kicker: true, bestPosition: 10 },
  { name: "Joshua Boudreau", trainingGroup: "Gold", grade: 9, classYear: "Freshman", bestPosition: 12 },
  { name: "Julian Gomez", trainingGroup: "Gold", height: "5'11\"", weight: 142 },
  { name: "Matteus Drozdowicz", trainingGroup: "Gold", height: "5'8\"", weight: 179 },
  { name: "Yuvraj Lamba", trainingGroup: "Gold", bestPosition: 4, secondPosition: 5, thirdPosition: 6 },
  { name: "Finn Little", trainingGroup: "Gold", height: "6'0\"", weight: 163, bestPosition: 12 },
  { name: "Garret Hamilton", trainingGroup: "Gold" },
  { name: "Noah Ball", trainingGroup: "Gold", grade: 9, classYear: "Freshman" },
  { name: "Rudy Carrasco", trainingGroup: "Gold", height: "5'9\"", weight: 202, grade: 9, classYear: "Freshman" },
  { name: "Samuel Call", trainingGroup: "Gold", height: "5'10\"", weight: 180, grade: 9, classYear: "Freshman" },

  { name: "Johnnie Tunstall", trainingGroup: "Gold", height: "5'6\"", weight: 120, bestPosition: 11, secondPosition: 14, thirdPosition: 15 },
  { name: "Christian Sisneroz", trainingGroup: "Gold", height: "5'9\"", weight: 176, bestPosition: 6, secondPosition: 7 },
  { name: "Grey Brinton", trainingGroup: "Gold", height: "5'9\"", weight: 133 },
  { name: "Lincoln Hines", trainingGroup: "Gold" },
  { name: "Luc Purcell", trainingGroup: "Gold", height: "5'5\"", weight: 107, bestPosition: 10, secondPosition: 15, thirdPosition: 9 },
  { name: "Aiden Tabatabai", trainingGroup: "Gold", height: "5'9\"", weight: 134, bestPosition: 11, secondPosition: 14, thirdPosition: 11 },
  { name: "Carter White", trainingGroup: "Gold", height: "5'4\"", weight: 115, grade: 9, classYear: "Freshman" },
  { name: "Dean Fernandes", trainingGroup: "Gold", height: "5'11\"", weight: 147, grade: 9, classYear: "Freshman" },
  { name: "Dominic Splendorio", trainingGroup: "Gold" },
  { name: "Grant Phillips", trainingGroup: "Gold", height: "5'8\"", weight: 115 },
  { name: "Andrew Born", trainingGroup: "Gold", bestPosition: 11, secondPosition: 14 },
  { name: "Dylan Boydon", trainingGroup: "Gold" },
  { name: "Luke Dorrington", trainingGroup: "Gold", height: "5'8\"", weight: 125 },
  { name: "Otto Maher", trainingGroup: "Gold", height: "6'0\"", weight: 228 },

  // On the 2027 roster sheet with 25 Oct 2026 test results (added Nov 2026; positions not known yet).
  { name: "Frank Tucker", trainingGroup: "Gold" },
  { name: "Jaden Selha", trainingGroup: "Gold" },
  { name: "Thunder Hazen", trainingGroup: "Gold" },
  { name: "Tristan Comiskey", trainingGroup: "Gold" }, // 40m on 8 Nov 2026; position not known yet
];

// Photo filename mappings (name in roster -> filename)
export const PHOTO_MAPPINGS: Record<string, string> = {
  "Nicholas Donnelly": "Nick Donnelly.jpg",
  "Benjamin Knauf": "Benji Knauf.jpg",
  "Rudy Duggineni": "Anirudh Dugguneni.jpg",
  "Robert Duncan Anderson": "Robert Duncan Ryan.jpg",
  "Luc Purcell": "Lucas Purcell.jpg",
  "Gabriel Parsons": "Gabe Parsons.jpg",
  "Givani Jimenez": "Givani Jiminez.jpg",
  "Asher Ball": "Demetrius Ball.jpg",
  "Johnnie Tunstall": "Johnnie Turnstall.jpg",
};

// Get photo URL for a player
export function getPhotoUrl(playerName: string): string | undefined {
  const filename = PHOTO_MAPPINGS[playerName] || `${playerName}.jpg`;
  return `photos/${filename}`;
}

// Training group colors
export const GROUP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Black: { bg: 'bg-neutral-900', text: 'text-white', border: 'border-neutral-700' },
  Gold: { bg: 'bg-amber-500', text: 'text-black', border: 'border-amber-400' },
  Silver: { bg: 'bg-neutral-400', text: 'text-black', border: 'border-neutral-300' },
  Bronze: { bg: 'bg-amber-700', text: 'text-white', border: 'border-amber-600' },
};

// Training group descriptions
export const GROUP_DESCRIPTIONS: Record<string, string> = {
  Black: '1st XV Core',
  Gold: '1st/2nd XV Squad',
  Silver: 'Development',
  Bronze: 'Foundation',
};
