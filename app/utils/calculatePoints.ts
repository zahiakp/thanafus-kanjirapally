import { pointsFor } from "./markingCriteria";

interface Participant {
  code: string;
  student: string; // Comma-separated IDs
  mark: number;
  mark2: number;
  mark3: number;
  status: "finished" | "pending" | "error";
  rank?: number;
  points?: number;
  grade?: string | null;
}

interface Program {
  id: string;
  isGroup: 0 | 1;
  members: number;
  [key: string]: any;
}

interface GenerateResultsArgs {
  participants: Participant[];
  program: Program;
}

export const assignRanksAndCalculatePoints = (args: {
  participants: Participant[];
  program: Program;
}): Participant[] => {
  const { participants } = args;

  // Step 1: Normalize total scores to a 100-point index percentage
  const participantsWithFinalMark = participants.map((p) => {
    let totalScore = p.mark || 0;
    let maxMark = 100;

    if (p.mark3 != null && p.mark3 > 0) {
      totalScore += (p.mark2 || 0) + (p.mark3 || 0);
      maxMark = 300;
    } else if (p.mark2 != null && p.mark2 > 0) {
      totalScore += p.mark2 || 0;
      maxMark = 200;
    }

    const finalMark = (totalScore / maxMark) * 100;
    return { ...p, finalMark };
  });

  // Step 2: Sort descending based on final marks
  const sortedParticipants = [...participantsWithFinalMark].sort(
    (a, b) => b.finalMark - a.finalMark
  );

  // Step 3: Compute ranks, grades, and cumulative points totals
  const rankedParticipants: Participant[] = [];
  let lastMark = -1;
  let lastRank = 0;

  sortedParticipants.forEach((participant, index) => {
    // Shared scores receive identical rank tiers
    const rank = participant.finalMark === lastMark ? lastRank : index + 1;
    const result = pointsFor(participant.finalMark, rank);

    const { finalMark, ...originalParticipant } = participant;

    rankedParticipants.push({
      ...originalParticipant,
      ...result,
    });

    lastMark = participant.finalMark;
    lastRank = rank;
  });

  return rankedParticipants;
};

export const generateFinalResults = async (
  args: GenerateResultsArgs
): Promise<boolean> => {
  const response = await fetch('/api/results/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ program: args.program.id }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.success !== true) {
    throw new Error(result?.message || 'Unable to confirm program results');
  }
  return true;
};
