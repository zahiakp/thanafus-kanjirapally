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
  markParticipants?: Pick<Participant, "mark2" | "mark3">[];
}): Participant[] => {
  const { participants } = args;

  // Select each optional judge column once across the entire program.
  const markParticipants = args.markParticipants ?? participants;
  const includeMark2 = markParticipants.some(p => Number(p.mark2) > 0);
  const includeMark3 = markParticipants.some(p => Number(p.mark3) > 0);
  const judgeCount = 1 + Number(includeMark2) + Number(includeMark3);
  const participantsWithFinalMark = participants.map((p) => {
    const totalScore = Number(p.mark || 0)
      + (includeMark2 ? Number(p.mark2 || 0) : 0)
      + (includeMark3 ? Number(p.mark3 || 0) : 0);
    return { ...p, finalMark: totalScore / judgeCount };
  });

  // Step 2: Sort descending based on final marks
  const sortedParticipants = [...participantsWithFinalMark].sort(
    (a, b) => b.finalMark - a.finalMark
  );

  // Step 3: Compute ranks, grades, and cumulative points totals
  const rankedParticipants: Participant[] = [];
  let lastMark = -1;
  let lastRank = 0;

  sortedParticipants.forEach((participant) => {
    // Shared scores receive identical rank tiers
    const rank = participant.finalMark === lastMark ? lastRank : lastRank + 1;
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
