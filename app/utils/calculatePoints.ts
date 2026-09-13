import { AssignResult } from "../judgement/func";
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
  const { participants, program } = args;

  const finishedParticipants = participants.filter(
    (p) => p.status === "finished"
  );

  const calculatedParticipants = assignRanksAndCalculatePoints({
    participants: finishedParticipants,
    program,
  });

  // Keep records that scored either a passing grade weight or an event placement point
  const gradedParticipants = calculatedParticipants.filter(
    (p) => p.points && p.points > 0
  );
  console.log("Graded Participants to be saved:", gradedParticipants);

  let allSavedSuccessfully = true;
  
  for (const participant of gradedParticipants) {
    const { student, code, rank, grade, points } = participant;

    const allStudentIds = student
      .split(/[&,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (allStudentIds.length === 0) {
      console.warn(
        `Skipping participant with an empty participant ID for code ${code}`
      );
      continue;
    }

    let studentIdsToSave: string[];

    // Save under the primary representative identity if it's a structural group event
    if (program.isGroup === 1) {
      studentIdsToSave = [allStudentIds[0]];
    } else {
      studentIdsToSave = allStudentIds;
    }

    for (const studentId of studentIdsToSave) {
      try {
        console.log(
          `Saving result for: ${studentId}, Rank: ${rank}, Grade: ${grade}, Points: ${points}`
        );
        const saveResult = await AssignResult(
          code,
          studentId,
          program.id,
          String(rank!),
          grade,
          String(points!)
        );

        if (!saveResult.success) {
          console.error(`Failed to save result for participant ${studentId}`);
          allSavedSuccessfully = false;
        }
      } catch (error: any) {
        console.error(
          `Error saving result for participant ${studentId}:`,
          error.message
        );
        allSavedSuccessfully = false;
      }
    }
  }

  return allSavedSuccessfully;
};