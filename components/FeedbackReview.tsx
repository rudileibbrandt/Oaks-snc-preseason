import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, Filter, Trophy } from 'lucide-react';
import { PlayerRating, PlayerRatings } from '../types';
import { RATING_SKILLS, RATING_COLORS } from '../services/ratingData';
import { ROSTER_PLAYERS, GROUP_COLORS } from '../services/rosterData';
import { isSelfRating, calculateVarianceLevel, VARIANCE_COLORS } from '../services/ratingAnalytics';

interface Props {
  allRatings: PlayerRating[];
}

type TrainingGroupFilter = 'All' | 'Black' | 'Gold' | 'Silver' | 'Bronze';

const GROUP_ORDER: TrainingGroupFilter[] = ['All', 'Black', 'Gold', 'Silver', 'Bronze'];

const CORE_SKILLS = RATING_SKILLS.filter(s => !s.specialist);
const SPECIALIST_SKILLS = RATING_SKILLS.filter(s => s.specialist);

// Build a set of kicker names for quick lookup
const KICKER_NAMES = new Set(
  ROSTER_PLAYERS.filter(p => p.kicker).map(p => p.name.toLowerCase().trim())
);

function isKicker(playerName: string): boolean {
  return KICKER_NAMES.has(playerName.toLowerCase().trim());
}

interface CoachCalibration {
  raterId: string;
  raterName: string;
  average: number;
  playerCount: number;
  deviation: number;
  level: 'aligned' | 'slightly-off' | 'significantly-off';
}

interface SkillProfile {
  key: keyof PlayerRatings;
  label: string;
  average: number;
  ratingLevel: number;
  flagged: boolean;
  specialist: boolean;
}

interface PlayerDevArea {
  skill: string;
  mean: number;
  stdDev: number;
  consensus: 'clear' | 'mixed';
}

interface PlayerSkillStat {
  skill: string;
  mean: number;
  stdDev: number;
  consensus: 'clear' | 'mixed';
  specialist: boolean;
}

interface PlayerDev {
  name: string;
  trainingGroup: string;
  overallAvg: number;
  kickingAvg: number | null;
  isKicker: boolean;
  devAreas: PlayerDevArea[];
  allSkills: PlayerSkillStat[];
}

const FeedbackReview: React.FC<Props> = ({ allRatings }) => {
  const [groupFilter, setGroupFilter] = useState<TrainingGroupFilter>('All');
  const [expandedPlayers, setExpandedPlayers] = useState<Set<string>>(new Set());

  // Filter out self-ratings once
  const peerRatings = useMemo(() => {
    return allRatings.filter(r => !isSelfRating(r));
  }, [allRatings]);

  // ===== SECTION 1: Coach Calibration =====
  // Uses only core skills so kicking doesn't skew coach averages
  const coachCalibration = useMemo(() => {
    if (peerRatings.length === 0) return { teamAverage: 0, coaches: [] as CoachCalibration[], groupAverages: new Map<string, number>() };

    // Global team average across core skills only
    const allValues: number[] = [];
    peerRatings.forEach(r => {
      CORE_SKILLS.forEach(skill => {
        const val = r.ratings[skill.key];
        if (val !== undefined && val > 0) allValues.push(val);
      });
    });
    const teamAverage = allValues.length > 0
      ? allValues.reduce((a, b) => a + b, 0) / allValues.length
      : 0;

    // Group by raterId
    const coachMap = new Map<string, { raterName: string; values: number[]; playerSet: Set<string> }>();
    peerRatings.forEach(r => {
      if (!coachMap.has(r.raterId)) {
        coachMap.set(r.raterId, { raterName: r.raterName, values: [], playerSet: new Set() });
      }
      const entry = coachMap.get(r.raterId)!;
      entry.playerSet.add(r.playerName.toLowerCase().trim());
      CORE_SKILLS.forEach(skill => {
        const val = r.ratings[skill.key];
        if (val !== undefined && val > 0) entry.values.push(val);
      });
    });

    const coaches: CoachCalibration[] = Array.from(coachMap.entries()).map(([raterId, data]) => {
      const avg = data.values.length > 0
        ? data.values.reduce((a, b) => a + b, 0) / data.values.length
        : 0;
      const deviation = avg - teamAverage;
      const absDev = Math.abs(deviation);
      const level: CoachCalibration['level'] =
        absDev < 0.3 ? 'aligned' :
        absDev < 0.6 ? 'slightly-off' :
        'significantly-off';

      return {
        raterId,
        raterName: data.raterName,
        average: Math.round(avg * 100) / 100,
        playerCount: data.playerSet.size,
        deviation: Math.round(deviation * 100) / 100,
        level,
      };
    });

    // Sort by absolute deviation descending
    coaches.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));

    // Per-group average breakdown
    const groupAverages = new Map<string, number>();
    const groupValues = new Map<string, number[]>();
    peerRatings.forEach(r => {
      const rosterPlayer = ROSTER_PLAYERS.find(
        p => p.name.toLowerCase().trim() === r.playerName.toLowerCase().trim()
      );
      const group = rosterPlayer?.trainingGroup || 'Unknown';
      if (!groupValues.has(group)) groupValues.set(group, []);
      CORE_SKILLS.forEach(skill => {
        const val = r.ratings[skill.key];
        if (val !== undefined && val > 0) groupValues.get(group)!.push(val);
      });
    });
    groupValues.forEach((vals, group) => {
      if (vals.length > 0) {
        groupAverages.set(group, Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100);
      }
    });

    return { teamAverage: Math.round(teamAverage * 100) / 100, coaches, groupAverages };
  }, [peerRatings]);

  // ===== SECTION 1B: Skill Leaders =====
  // Who is the highest-rated player in each skill category? (peer ratings only)
  const [leaderSquadFilter, setLeaderSquadFilter] = useState<'all' | '1sts and 2nds' | 'Academy'>('1sts and 2nds');

  const skillLeaders = useMemo(() => {
    if (peerRatings.length === 0) return [];

    // Group peer ratings by player, filtering by squad
    const playerMap = new Map<string, PlayerRating[]>();
    peerRatings.forEach(r => {
      const key = r.playerName.toLowerCase().trim();
      const rosterPlayer = ROSTER_PLAYERS.find(p => p.name.toLowerCase().trim() === key);
      const squad = rosterPlayer?.squad || 'Unknown';
      if (leaderSquadFilter !== 'all' && squad !== leaderSquadFilter) return;

      if (!playerMap.has(key)) playerMap.set(key, []);
      playerMap.get(key)!.push(r);
    });

    return RATING_SKILLS.map(skill => {
      let bestPlayer = '';
      let bestAvg = 0;
      let bestCount = 0;
      let bestGroup = '';
      const runners: { name: string; avg: number; group: string }[] = [];

      playerMap.forEach((ratings, _key) => {
        // For specialist skills, only include kickers
        if (skill.specialist && !isKicker(ratings[0].playerName)) return;

        const values = ratings
          .map(r => r.ratings[skill.key])
          .filter((v): v is number => v !== undefined && v > 0);

        if (values.length < 2) return; // Require at least 2 raters for validity

        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const rosterPlayer = ROSTER_PLAYERS.find(
          p => p.name.toLowerCase().trim() === _key
        );
        const group = rosterPlayer?.trainingGroup || 'Unknown';

        runners.push({ name: ratings[0].playerName, avg, group });

        if (avg > bestAvg) {
          bestAvg = avg;
          bestPlayer = ratings[0].playerName;
          bestCount = values.length;
          bestGroup = group;
        }
      });

      // Find runner-up
      const sortedRunners = runners.sort((a, b) => b.avg - a.avg);
      const runnerUp = sortedRunners.length > 1 ? sortedRunners[1] : null;

      return {
        skill: skill.key,
        label: skill.label,
        specialist: !!skill.specialist,
        leader: bestPlayer,
        leaderAvg: Math.round(bestAvg * 100) / 100,
        leaderCount: bestCount,
        leaderGroup: bestGroup,
        runnerUp: runnerUp ? {
          name: runnerUp.name,
          avg: Math.round(runnerUp.avg * 100) / 100,
          group: runnerUp.group,
        } : null,
      };
    }).filter(s => s.leader !== '');
  }, [peerRatings, leaderSquadFilter]);

  // ===== SECTION 2: Team Skill Profile =====
  const buildProfile = (skills: typeof RATING_SKILLS, ratings: PlayerRating[]): SkillProfile[] => {
    return skills.map(skill => {
      const values = ratings
        .map(r => r.ratings[skill.key])
        .filter((v): v is number => v !== undefined && v > 0);

      const average = values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 0;

      return {
        key: skill.key,
        label: skill.label,
        average: Math.round(average * 100) / 100,
        ratingLevel: Math.round(average),
        flagged: average > 0 && average < 2.5,
        specialist: !!skill.specialist,
      };
    }).filter(s => s.average > 0);
  };

  // Single-group profile (used when a specific group is selected)
  const { coreProfile, specialistProfile } = useMemo(() => {
    if (groupFilter === 'All') {
      return { coreProfile: [], specialistProfile: [] };
    }

    const groupPlayerNames = new Set(
      ROSTER_PLAYERS
        .filter(p => p.trainingGroup === groupFilter)
        .map(p => p.name.toLowerCase().trim())
    );
    const ratingsToUse = peerRatings.filter(r =>
      groupPlayerNames.has(r.playerName.toLowerCase().trim())
    );

    const kickerRatings = ratingsToUse.filter(r => isKicker(r.playerName));

    const core = buildProfile(CORE_SKILLS, ratingsToUse);
    core.sort((a, b) => a.average - b.average);

    const specialist = buildProfile(SPECIALIST_SKILLS, kickerRatings);
    specialist.sort((a, b) => a.average - b.average);

    return { coreProfile: core, specialistProfile: specialist };
  }, [peerRatings, groupFilter]);

  // Per-group profiles (used when "All" is selected — side-by-side view)
  const groupProfiles = useMemo(() => {
    if (groupFilter !== 'All') return [];

    const groups = ['Black', 'Gold', 'Silver', 'Bronze'];
    return groups.map(group => {
      const groupPlayerNames = new Set(
        ROSTER_PLAYERS
          .filter(p => p.trainingGroup === group)
          .map(p => p.name.toLowerCase().trim())
      );
      const ratingsToUse = peerRatings.filter(r =>
        groupPlayerNames.has(r.playerName.toLowerCase().trim())
      );

      if (ratingsToUse.length === 0) return null;

      const core = buildProfile(CORE_SKILLS, ratingsToUse);
      core.sort((a, b) => a.average - b.average);

      return { group, coreProfile: core };
    }).filter((g): g is NonNullable<typeof g> => g !== null && g.coreProfile.length > 0);
  }, [peerRatings, groupFilter]);

  // ===== SECTION 3: Player Development Areas =====
  const playerDevData = useMemo(() => {
    // Group ratings by player
    const playerMap = new Map<string, PlayerRating[]>();
    peerRatings.forEach(r => {
      const key = r.playerName.toLowerCase().trim();
      if (!playerMap.has(key)) playerMap.set(key, []);
      playerMap.get(key)!.push(r);
    });

    const players: PlayerDev[] = [];

    playerMap.forEach((ratings, _key) => {
      const playerName = ratings[0].playerName;
      const rosterPlayer = ROSTER_PLAYERS.find(
        p => p.name.toLowerCase().trim() === _key
      );
      const trainingGroup = rosterPlayer?.trainingGroup || 'Unknown';
      const playerIsKicker = isKicker(playerName);

      // Compute per-skill mean and stdDev
      const skillStats: PlayerSkillStat[] = RATING_SKILLS.map(skill => {
        const values = ratings
          .map(r => r.ratings[skill.key])
          .filter((v): v is number => v !== undefined && v > 0);

        if (values.length === 0) return null;

        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.length > 1
          ? values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
          : 0;
        const stdDev = Math.sqrt(variance);
        const varLevel = calculateVarianceLevel(stdDev);

        return {
          skill: skill.label,
          mean: Math.round(mean * 100) / 100,
          stdDev: Math.round(stdDev * 100) / 100,
          consensus: (varLevel === 'low' ? 'clear' : 'mixed') as 'clear' | 'mixed',
          specialist: !!skill.specialist,
        };
      }).filter((s): s is NonNullable<typeof s> => s !== null);

      // Overall avg always uses core skills only (for all players including kickers)
      const coreSkills = skillStats.filter(s => !s.specialist);
      const coreMeans = coreSkills.map(s => s.mean);
      const overallAvg = coreMeans.length > 0
        ? Math.round((coreMeans.reduce((a, b) => a + b, 0) / coreMeans.length) * 100) / 100
        : 0;

      // Kicking avg for kickers (specialist skills only)
      const specialistSkills = skillStats.filter(s => s.specialist);
      const kickingAvg = playerIsKicker && specialistSkills.length > 0
        ? Math.round((specialistSkills.reduce((a, b) => a + b.mean, 0) / specialistSkills.length) * 100) / 100
        : null;

      // Dev areas = bottom 3 from core skills only (never kicking)
      const sorted = [...coreSkills].sort((a, b) => a.mean - b.mean);
      const devAreas = sorted.slice(0, 3);

      players.push({
        name: playerName,
        trainingGroup,
        overallAvg,
        kickingAvg,
        isKicker: playerIsKicker,
        devAreas,
        allSkills: [...skillStats].sort((a, b) => a.mean - b.mean),
      });
    });

    // Group by training group
    const groupOrder = ['Black', 'Gold', 'Silver', 'Bronze', 'Unknown'];
    const grouped = new Map<string, PlayerDev[]>();
    groupOrder.forEach(g => grouped.set(g, []));

    players.forEach(p => {
      const group = grouped.get(p.trainingGroup) || grouped.get('Unknown')!;
      group.push(p);
    });

    // Sort players within each group by overall avg descending
    grouped.forEach(group => group.sort((a, b) => b.overallAvg - a.overallAvg));

    // Remove empty groups
    const result: { group: string; players: PlayerDev[] }[] = [];
    groupOrder.forEach(g => {
      const groupPlayers = grouped.get(g);
      if (groupPlayers && groupPlayers.length > 0) {
        result.push({ group: g, players: groupPlayers });
      }
    });

    return result;
  }, [peerRatings]);

  const togglePlayerExpanded = (name: string) => {
    setExpandedPlayers(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const getCalibrationColor = (level: CoachCalibration['level']) => {
    switch (level) {
      case 'aligned': return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' };
      case 'slightly-off': return { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' };
      case 'significantly-off': return { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' };
    }
  };

  const getCalibrationLabel = (level: CoachCalibration['level']) => {
    switch (level) {
      case 'aligned': return 'Aligned';
      case 'slightly-off': return 'Slightly Off';
      case 'significantly-off': return 'Significantly Off';
    }
  };

  const renderSkillBar = (skill: SkillProfile, height: string = 'h-5') => {
    const pct = (skill.average / 5) * 100;
    const ratingLevel = Math.max(1, Math.min(5, skill.ratingLevel)) as 1 | 2 | 3 | 4 | 5;
    const colors = RATING_COLORS[ratingLevel];
    return (
      <div key={skill.key} className="flex items-center gap-3">
        <div className="w-28 text-xs text-neutral-400 text-right flex items-center justify-end gap-1">
          {skill.flagged && <AlertTriangle size={12} className="text-amber-400" />}
          <span className={skill.flagged ? 'text-amber-400' : ''}>{skill.label}</span>
        </div>
        <div className={`flex-1 bg-neutral-800 rounded-full ${height} relative overflow-hidden`}>
          <div
            className={`h-full rounded-full ${colors.bg} border ${colors.border} transition-all duration-300`}
            style={{ width: `${pct}%` }}
          />
          <span className={`absolute inset-0 flex items-center justify-center text-xs font-medium ${colors.text}`}>
            {skill.average.toFixed(2)}
          </span>
        </div>
      </div>
    );
  };

  if (peerRatings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-neutral-500">
        <AlertTriangle size={48} className="mb-4" />
        <p>No peer feedback data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ===== SECTION 1: Coach Calibration ===== */}
      <section>
        <h2 className="text-lg font-bold text-white mb-1">Coach Calibration</h2>
        <p className="text-xs text-neutral-500 mb-2">
          Are coaches aligned? Team avg: {coachCalibration.teamAverage.toFixed(2)} (core skills only)
        </p>
        {coachCalibration.groupAverages.size > 0 && (
          <div className="flex flex-wrap gap-2 mb-4 text-xs text-neutral-400">
            {['Black', 'Gold', 'Silver', 'Bronze'].map(group => {
              const avg = coachCalibration.groupAverages.get(group);
              if (avg === undefined) return null;
              const colors = GROUP_COLORS[group];
              return (
                <span key={group} className={`px-2 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                  {group}: {avg.toFixed(2)}
                </span>
              );
            })}
          </div>
        )}

        <div className="space-y-2">
          {coachCalibration.coaches.map(coach => {
            const colors = getCalibrationColor(coach.level);
            const isPositive = coach.deviation > 0;
            return (
              <div
                key={coach.raterId}
                className={`p-3 rounded-lg border ${colors.border} ${colors.bg}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-white">{coach.raterName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} border ${colors.border}`}>
                    {getCalibrationLabel(coach.level)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-neutral-400">
                  <span>Avg: <span className="text-white">{coach.average.toFixed(2)}</span></span>
                  <span>
                    Dev: <span className={colors.text}>
                      {isPositive ? '+' : ''}{coach.deviation.toFixed(2)}
                    </span>
                  </span>
                  <span>
                    Coverage: <span className="text-white">{coach.playerCount}</span>
                    <span className="text-neutral-600"> / {ROSTER_PLAYERS.length}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ===== SECTION 1B: Skill Leaders ===== */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Trophy size={18} className="text-amber-400" />
          <h2 className="text-lg font-bold text-white">Skill Leaders</h2>
        </div>
        <p className="text-xs text-neutral-500 mb-3">
          Highest-rated player in each category (peer ratings only, min 2 raters). Do these match your expectations?
        </p>
        <div className="flex gap-1 mb-4 bg-neutral-900 rounded-lg p-1 border border-neutral-800 w-fit">
          {([['1sts and 2nds', '1sts & 2nds'], ['Academy', 'Academy'], ['all', 'All']] as const).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setLeaderSquadFilter(value as typeof leaderSquadFilter)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                leaderSquadFilter === value
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-neutral-400 hover:text-neutral-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {skillLeaders.length > 0 ? (
          <div className="space-y-2">
            {/* Core Skills */}
            {skillLeaders.filter(s => !s.specialist).map(leader => {
              const ratingLevel = Math.max(1, Math.min(5, Math.round(leader.leaderAvg))) as 1 | 2 | 3 | 4 | 5;
              const colors = RATING_COLORS[ratingLevel];
              const groupColors = GROUP_COLORS[leader.leaderGroup] || GROUP_COLORS.Bronze;
              return (
                <div
                  key={leader.skill}
                  className="p-3 rounded-lg border border-neutral-800 bg-neutral-900/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400 w-28">{leader.label}</span>
                    <div className="flex-1 flex items-center gap-2 ml-2">
                      <span className="text-sm font-medium text-white">{leader.leader}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${groupColors.bg} ${groupColors.text}`}>
                        {leader.leaderGroup}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${colors.text}`}>
                        {leader.leaderAvg.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-neutral-600">
                        ({leader.leaderCount} raters)
                      </span>
                    </div>
                  </div>
                  {leader.runnerUp && (
                    <div className="flex items-center justify-between mt-1 pl-28 ml-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500">2nd</span>
                        <span className="text-xs text-neutral-400">{leader.runnerUp.name}</span>
                        <span className={`text-[10px] px-1 py-0.5 rounded ${(GROUP_COLORS[leader.runnerUp.group] || GROUP_COLORS.Bronze).bg} ${(GROUP_COLORS[leader.runnerUp.group] || GROUP_COLORS.Bronze).text}`}>
                          {leader.runnerUp.group}
                        </span>
                      </div>
                      <span className="text-xs text-neutral-500">{leader.runnerUp.avg.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Specialist Skills */}
            {skillLeaders.some(s => s.specialist) && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Kicking (Specialists Only)</span>
                </div>
                {skillLeaders.filter(s => s.specialist).map(leader => {
                  const ratingLevel = Math.max(1, Math.min(5, Math.round(leader.leaderAvg))) as 1 | 2 | 3 | 4 | 5;
                  const colors = RATING_COLORS[ratingLevel];
                  const groupColors = GROUP_COLORS[leader.leaderGroup] || GROUP_COLORS.Bronze;
                  return (
                    <div
                      key={leader.skill}
                      className="p-3 rounded-lg border border-neutral-800 bg-neutral-900/50 mb-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-400 w-28">{leader.label}</span>
                        <div className="flex-1 flex items-center gap-2 ml-2">
                          <span className="text-sm font-medium text-white">{leader.leader}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${groupColors.bg} ${groupColors.text}`}>
                            {leader.leaderGroup}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${colors.text}`}>
                            {leader.leaderAvg.toFixed(1)}
                          </span>
                          <span className="text-[10px] text-neutral-600">
                            ({leader.leaderCount} raters)
                          </span>
                        </div>
                      </div>
                      {leader.runnerUp && (
                        <div className="flex items-center justify-between mt-1 pl-28 ml-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-500">2nd</span>
                            <span className="text-xs text-neutral-400">{leader.runnerUp.name}</span>
                            <span className={`text-[10px] px-1 py-0.5 rounded ${(GROUP_COLORS[leader.runnerUp.group] || GROUP_COLORS.Bronze).bg} ${(GROUP_COLORS[leader.runnerUp.group] || GROUP_COLORS.Bronze).text}`}>
                              {leader.runnerUp.group}
                            </span>
                          </div>
                          <span className="text-xs text-neutral-500">{leader.runnerUp.avg.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-neutral-500 text-center py-4">
            Not enough data — need at least 2 raters per player
          </p>
        )}
      </section>

      {/* ===== SECTION 2: Team Skill Profile ===== */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-white">Team Skill Profile</h2>
          <Filter size={14} className="text-neutral-500" />
        </div>
        <p className="text-xs text-neutral-500 mb-3">
          Weakest to strongest — where does the team need work?
        </p>

        {/* Group filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {GROUP_ORDER.map(group => {
            const isActive = groupFilter === group;
            if (group === 'All') {
              return (
                <button
                  key={group}
                  onClick={() => setGroupFilter(group)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  All
                </button>
              );
            }
            const colors = GROUP_COLORS[group];
            return (
              <button
                key={group}
                onClick={() => setGroupFilter(group)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors whitespace-nowrap ${
                  isActive
                    ? `${colors.bg} ${colors.text} ${colors.border}`
                    : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {group}
              </button>
            );
          })}
        </div>

        {/* "All" mode: groups side-by-side */}
        {groupFilter === 'All' && (
          <>
            {groupProfiles.length > 0 ? (
              <div className="space-y-5">
                {groupProfiles.map(({ group, coreProfile: profile }) => {
                  const colors = GROUP_COLORS[group];
                  return (
                    <div key={group}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-xs font-bold rounded ${colors.bg} ${colors.text}`}>
                          {group}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {profile.map(skill => renderSkillBar(skill, 'h-4'))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-neutral-500 text-center py-4">
                No data available
              </p>
            )}
          </>
        )}

        {/* Single group mode: core skill bars */}
        {groupFilter !== 'All' && (
          <>
            <div className="space-y-2">
              {coreProfile.map(skill => renderSkillBar(skill))}
            </div>

            {coreProfile.length === 0 && (
              <p className="text-sm text-neutral-500 text-center py-4">
                No data for selected group
              </p>
            )}

            {/* Specialist (kicking) skills - separate section */}
            {specialistProfile.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Kicking (Specialists Only)</span>
                  <span className="text-[10px] text-neutral-600">
                    {KICKER_NAMES.size} kickers
                  </span>
                </div>
                <div className="space-y-2">
                  {specialistProfile.map(skill => renderSkillBar(skill))}
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ===== SECTION 3: Player Development Areas ===== */}
      <section>
        <h2 className="text-lg font-bold text-white mb-1">Player Development Areas</h2>
        <p className="text-xs text-neutral-500 mb-4">
          What should each player focus on? Overall avg uses core skills only; kicking shown separately for kickers.
        </p>

        {playerDevData.map(({ group, players }) => {
          const groupColors = GROUP_COLORS[group] || GROUP_COLORS.Bronze;
          return (
            <div key={group} className="mb-6">
              {/* Group header */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${groupColors.bg} ${groupColors.text}`}>
                  {group}
                </span>
                <span className="text-xs text-neutral-600">{players.length} players</span>
              </div>

              <div className="space-y-2">
                {players.map(player => {
                  const isExpanded = expandedPlayers.has(player.name);
                  return (
                    <div
                      key={player.name}
                      className="border border-neutral-800 rounded-lg overflow-hidden"
                    >
                      {/* Player row */}
                      <button
                        onClick={() => togglePlayerExpanded(player.name)}
                        className="w-full p-3 flex items-center gap-3 hover:bg-neutral-900/50 transition-colors"
                      >
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{player.name}</span>
                            {player.isKicker && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                Kicker
                              </span>
                            )}
                            <span className="text-xs text-neutral-500">
                              avg {player.overallAvg.toFixed(1)}
                              {player.kickingAvg !== null && (
                                <span className="text-blue-400"> | kicking {player.kickingAvg.toFixed(1)}</span>
                              )}
                            </span>
                          </div>
                          {/* Dev areas inline */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {player.devAreas.map(area => {
                              const varColors = area.consensus === 'clear'
                                ? VARIANCE_COLORS.low
                                : VARIANCE_COLORS.medium;
                              return (
                                <span
                                  key={area.skill}
                                  className={`text-xs px-1.5 py-0.5 rounded ${varColors.bg} ${varColors.text} border ${varColors.border}`}
                                  title={area.consensus === 'clear' ? 'Clear dev area (coaches agree)' : 'Coaches disagree on this skill'}
                                >
                                  {area.skill} {area.mean.toFixed(1)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        {isExpanded
                          ? <ChevronUp size={16} className="text-neutral-500 shrink-0" />
                          : <ChevronDown size={16} className="text-neutral-500 shrink-0" />
                        }
                      </button>

                      {/* Expanded skill breakdown */}
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-neutral-800">
                          <div className="pt-2 space-y-1.5">
                            {player.allSkills.map(skill => {
                              const pct = (skill.mean / 5) * 100;
                              const ratingLevel = Math.max(1, Math.min(5, Math.round(skill.mean))) as 1 | 2 | 3 | 4 | 5;
                              const colors = RATING_COLORS[ratingLevel];
                              const varColors = skill.consensus === 'clear'
                                ? VARIANCE_COLORS.low
                                : VARIANCE_COLORS.medium;
                              const isSpecialistSkill = skill.specialist;
                              const dimmed = isSpecialistSkill && !player.isKicker;
                              return (
                                <div key={skill.skill} className={`flex items-center gap-2 ${dimmed ? 'opacity-40' : ''}`}>
                                  <div className="w-24 text-xs text-neutral-400 text-right truncate flex items-center justify-end gap-1">
                                    {isSpecialistSkill && (
                                      <span className="text-blue-500 text-[10px]" title="Specialist skill">*</span>
                                    )}
                                    <span>{skill.skill}</span>
                                  </div>
                                  <div className="flex-1 bg-neutral-800 rounded-full h-4 relative overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${colors.bg} border ${colors.border}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                    <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-medium ${colors.text}`}>
                                      {skill.mean.toFixed(1)}
                                    </span>
                                  </div>
                                  <span className={`text-[10px] w-10 text-right ${varColors.text}`} title={`StdDev: ${skill.stdDev.toFixed(2)}`}>
                                    {skill.consensus === 'clear' ? 'clear' : 'mixed'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          {player.allSkills.some(s => s.specialist) && (
                            <p className="text-[10px] text-neutral-600 mt-2">* Kicking skills excluded from overall avg and dev areas</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
};

export default FeedbackReview;
