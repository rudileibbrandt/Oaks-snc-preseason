import { InjuryRecord } from '../types';
import { db } from './db';

// Hardcoded injury records for migration
const HARDCODED_INJURIES: InjuryRecord[] = [
  {
    id: 'inj-001',
    playerName: 'Johann Turk',
    coachSubmitting: 'Kort Schubert',
    grade: 12,
    team: 'Varsity',
    classYear: 'Senior',
    positions: 'Flyhalf, Center, Fullback',
    dateOfInjury: 'TBD',
    injuryType: ['Muscle'],
    areaOnBody: 'Bilateral',
    bodyPart: ['Back'],
    diagnosis: ['Strain', 'Sore'],
    currentStatus: 'Day to Day',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-002',
    playerName: 'Ryan Vaupen',
    coachSubmitting: 'Kort Schubert',
    grade: 12,
    team: 'Varsity',
    classYear: 'Senior',
    positions: 'Flanker',
    dateOfInjury: '2026-01-24',
    daysInjured: 7,
    injuryType: ['Soft Tissue', 'Muscle'],
    areaOnBody: 'Left',
    bodyPart: ['Knee'],
    diagnosis: ['Sore'],
    currentStatus: 'Day to Day',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-003',
    playerName: 'Jackson Evans',
    coachSubmitting: 'Kort Schubert',
    grade: 10,
    team: 'Varsity',
    classYear: 'Sophomore',
    positions: 'Prop, Hooker',
    dateOfInjury: '2026-01-24',
    daysInjured: 7,
    injuryType: ['Soft Tissue', 'Bone'],
    areaOnBody: 'Left',
    bodyPart: ['Knee'],
    diagnosis: ['Sore', 'Strain'],
    currentStatus: 'Day to Day',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-004',
    playerName: 'Samuel Call',
    coachSubmitting: 'Simon Davis',
    grade: 9,
    team: 'Academy',
    classYear: 'Freshman',
    positions: 'Lock, Flanker',
    dateOfInjury: '2026-01-22',
    daysInjured: 9,
    injuryType: ['Soft Tissue'],
    areaOnBody: 'Left',
    bodyPart: ['Knee'],
    diagnosis: ['Strain'],
    currentStatus: 'IR / Out',
    estimatedReturnDate: 'TBD',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-005',
    playerName: 'Rudy Carrasco',
    coachSubmitting: 'Simon Davis',
    grade: 9,
    team: 'Academy',
    classYear: 'Freshman',
    positions: 'Hooker, Prop',
    dateOfInjury: '2026-01-19',
    daysInjured: 12,
    injuryType: ['Soft Tissue'],
    areaOnBody: 'Left',
    bodyPart: ['Ankle'],
    diagnosis: ['Strain'],
    currentStatus: 'Questionable',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-006',
    playerName: 'Dean Fernandes',
    coachSubmitting: 'Simon Davis',
    grade: 9,
    team: 'Academy',
    classYear: 'Freshman',
    positions: 'Lock',
    dateOfInjury: '2026-01-01',
    daysInjured: 30,
    injuryType: ['Soft Tissue'],
    areaOnBody: 'Left',
    bodyPart: ['Wrist'],
    diagnosis: ['Strain'],
    currentStatus: 'Questionable',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-007',
    playerName: 'Noah Ball',
    coachSubmitting: 'Simon Davis',
    grade: 9,
    team: 'Academy',
    classYear: 'Freshman',
    positions: 'Center',
    dateOfInjury: '2026-01-24',
    daysInjured: 7,
    injuryType: ['Bone'],
    areaOnBody: '',
    bodyPart: ['Finger'],
    diagnosis: ['Break'],
    currentStatus: 'Questionable',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-008',
    playerName: 'Duke Chiosso',
    coachSubmitting: 'Simon Davis',
    grade: 9,
    team: 'Academy',
    classYear: 'Freshman',
    positions: '#8',
    dateOfInjury: '2026-01-16',
    daysInjured: 15,
    injuryType: ['Muscle'],
    areaOnBody: 'Bilateral',
    bodyPart: ['Back'],
    diagnosis: ['Strain'],
    currentStatus: 'Returned to Play',
    returnToPlayDate: '2026-01-22',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-009',
    playerName: 'Joshua Boudreau',
    coachSubmitting: 'Simon Davis',
    grade: 9,
    team: 'Academy',
    classYear: 'Freshman',
    positions: 'Center',
    dateOfInjury: '2026-01-13',
    daysInjured: 18,
    injuryType: ['Muscle'],
    areaOnBody: 'Bilateral',
    bodyPart: ['Back'],
    diagnosis: ['Strain'],
    currentStatus: 'Returned to Play',
    returnToPlayDate: '2026-01-22',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-010',
    playerName: 'Frank Macias',
    coachSubmitting: 'Kort Schubert',
    grade: 9,
    team: 'Academy',
    classYear: 'Freshman',
    positions: 'Wing',
    dateOfInjury: '2026-01-24',
    daysInjured: 7,
    injuryType: ['Soft Tissue', 'Muscle'],
    areaOnBody: 'Right',
    bodyPart: ['Shoulder', 'Back'],
    diagnosis: ['Sore', 'Strain'],
    currentStatus: 'Day to Day',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-011',
    playerName: 'Carter White',
    coachSubmitting: 'Simon Davis',
    grade: 9,
    team: 'Academy',
    classYear: 'Freshman',
    positions: 'Center, Wing',
    dateOfInjury: '2026-01-24',
    daysInjured: 7,
    injuryType: ['Soft Tissue'],
    areaOnBody: 'Bilateral',
    bodyPart: ['Head'],
    diagnosis: ['Concussion'],
    currentStatus: 'Questionable',
    notes: '2 weeks for contact - injured in wrestling',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-012',
    playerName: 'Ruston Safehashemi',
    coachSubmitting: 'Kort Schubert',
    grade: 11,
    team: 'Varsity',
    classYear: 'Junior',
    positions: 'Wing',
    dateOfInjury: '2026-01-24',
    daysInjured: 7,
    injuryType: ['Muscle', 'Soft Tissue'],
    areaOnBody: '',
    bodyPart: ['Foot', 'Ankle'],
    diagnosis: ['Sore', 'Strain'],
    currentStatus: 'Day to Day',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-013',
    playerName: 'Thunder Hazen',
    coachSubmitting: 'Kort Schubert',
    grade: 10,
    team: 'Varsity',
    classYear: 'Sophomore',
    positions: 'Flanker, Lock',
    dateOfInjury: '2025-12-15',
    daysInjured: 47,
    injuryType: ['Muscle'],
    areaOnBody: 'Left',
    bodyPart: ['Knee'],
    diagnosis: ['Strain'],
    currentStatus: 'IR / Out',
    updatedAt: Date.now(),
  },
  {
    id: 'inj-014',
    playerName: 'Frank Tucker',
    coachSubmitting: 'Kort Schubert',
    grade: 10,
    team: 'Varsity',
    classYear: 'Sophomore',
    positions: 'Flanker, Wing',
    dateOfInjury: '2025-11-03',
    daysInjured: 89,
    injuryType: ['Soft Tissue', 'Bone'],
    areaOnBody: 'Right',
    bodyPart: ['Shoulder'],
    diagnosis: ['Break'],
    currentStatus: 'IR / Out',
    notes: 'Surgically repaired shoulder',
    updatedAt: Date.now(),
  },
];

// Cache for injuries loaded from database
let injuriesCache: InjuryRecord[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 30000; // 30 seconds

// Migrate hardcoded injuries to database (adds missing ones by ID)
export async function migrateHardcodedInjuries(): Promise<void> {
  try {
    console.log('[injuryData] Starting migration check...');
    const existingInjuries = await db.getInjuries();
    console.log('[injuryData] Found', existingInjuries.length, 'injuries in database');

    if (existingInjuries.length > 0) {
      console.log('[injuryData] Existing IDs:', existingInjuries.map(i => i.id).join(', '));
    }

    const existingIds = new Set(existingInjuries.map(i => i.id));

    // Find injuries that are in hardcoded but not in database
    const missingInjuries = HARDCODED_INJURIES.filter(i => !existingIds.has(i.id));

    if (missingInjuries.length > 0) {
      console.log('[injuryData] Adding missing injuries:', missingInjuries.length);
      console.log('[injuryData] Missing:', missingInjuries.map(i => `${i.id}:${i.playerName}`).join(', '));

      // Add createdAt to each injury based on dateOfInjury or current time
      const injuriesWithCreatedAt = missingInjuries.map(injury => ({
        ...injury,
        createdAt: injury.dateOfInjury && injury.dateOfInjury !== 'TBD'
          ? new Date(injury.dateOfInjury).getTime()
          : Date.now(),
      }));

      // Use setInjuries to preserve IDs
      await db.setInjuries(injuriesWithCreatedAt);
      console.log('[injuryData] Successfully added:', injuriesWithCreatedAt.map(i => i.playerName).join(', '));

      // Invalidate cache so fresh data is loaded
      injuriesCache = null;
      cacheTimestamp = 0;
    } else {
      console.log('[injuryData] All injuries already in database');
    }
  } catch (error) {
    console.error('[injuryData] Migration failed:', error);
  }
}

// Load injuries from database with caching
export async function loadInjuries(): Promise<InjuryRecord[]> {
  const now = Date.now();
  if (injuriesCache && (now - cacheTimestamp) < CACHE_TTL) {
    console.log('[injuryData] Returning cached injuries:', injuriesCache.length);
    return injuriesCache;
  }

  try {
    console.log('[injuryData] Loading injuries from database...');
    injuriesCache = await db.getInjuries();
    cacheTimestamp = now;
    return injuriesCache;
  } catch (error) {
    console.error('[injuryData] Failed to load injuries:', error);
    // Fall back to hardcoded data
    return HARDCODED_INJURIES;
  }
}

// Invalidate cache (call after add/update operations)
export function invalidateInjuryCache(): void {
  injuriesCache = null;
  cacheTimestamp = 0;
}

// Get active injuries (not returned to play) - async version
export async function getActiveInjuriesAsync(): Promise<InjuryRecord[]> {
  const injuries = await loadInjuries();
  return injuries.filter(r => r.currentStatus !== 'Returned to Play');
}

// Get injury by player name - async version
export async function getPlayerInjuryAsync(playerName: string): Promise<InjuryRecord | undefined> {
  const injuries = await loadInjuries();
  const normalized = playerName.toLowerCase().trim();
  return injuries.find(r =>
    r.playerName.toLowerCase().trim() === normalized &&
    r.currentStatus !== 'Returned to Play'
  );
}

// Legacy synchronous functions (use cached data or hardcoded fallback)
export function getActiveInjuries(): InjuryRecord[] {
  const injuries = injuriesCache || HARDCODED_INJURIES;
  return injuries.filter(r => r.currentStatus !== 'Returned to Play');
}

export function getPlayerInjury(playerName: string): InjuryRecord | undefined {
  const injuries = injuriesCache || HARDCODED_INJURIES;
  const normalized = playerName.toLowerCase().trim();
  return injuries.find(r =>
    r.playerName.toLowerCase().trim() === normalized &&
    r.currentStatus !== 'Returned to Play'
  );
}

// Check if player is currently injured
export function isPlayerInjured(playerName: string): boolean {
  return !!getPlayerInjury(playerName);
}

// Get all injuries for a player (including returned to play) - for history
export async function getPlayerInjuryHistory(playerName: string): Promise<InjuryRecord[]> {
  return db.getPlayerInjuries(playerName);
}

// Export hardcoded data for reference
export const INJURY_RECORDS = HARDCODED_INJURIES;

// Status colors
export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'Day to Day': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'Questionable': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  'IR / Out': { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  'Returned to Play': { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
};

// Format date for display
export function formatInjuryDate(dateStr?: string): string {
  if (!dateStr || dateStr === 'TBD') return 'TBD';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

// Calculate days since injury
export function daysSinceInjury(dateStr?: string): number | null {
  if (!dateStr || dateStr === 'TBD') return null;
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  } catch {
    return null;
  }
}
