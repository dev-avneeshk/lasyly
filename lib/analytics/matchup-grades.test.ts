import { describe, it, expect } from "vitest";
import {
  computeMatchupGrade,
  percentileToGrade,
  getGradeColor,
  type MatchupGrade,
} from "./matchup-grades";

describe("computeMatchupGrade", () => {
  it("returns null when fewer than 5 teams in dataset", () => {
    const result = computeMatchupGrade(100, [100, 90, 80, 70]);
    expect(result).toBeNull();
  });

  it("returns null when opponent has fewer than 3 games", () => {
    const result = computeMatchupGrade(100, [100, 90, 80, 70, 60], 2);
    expect(result).toBeNull();
  });

  it("returns a grade when opponent has 3 or more games", () => {
    const result = computeMatchupGrade(100, [100, 90, 80, 70, 60], 3);
    expect(result).not.toBeNull();
  });

  it("does not check games played when opponentGamesPlayed is undefined", () => {
    const result = computeMatchupGrade(100, [100, 90, 80, 70, 60]);
    expect(result).not.toBeNull();
  });

  it("assigns A grade to the highest defensive value (top 20%)", () => {
    // 10 teams, sorted desc: [100, 90, 80, 70, 60, 50, 40, 30, 20, 10]
    // Rank 1 out of 10 = percentile 0.1 → A
    const allValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = computeMatchupGrade(100, allValues);
    expect(result).toBe("A");
  });

  it("assigns F grade to the lowest defensive value (bottom 20%)", () => {
    // 10 teams, rank 10 out of 10 = percentile 1.0 → F
    const allValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = computeMatchupGrade(10, allValues);
    expect(result).toBe("F");
  });

  it("assigns B grade to 21st-40th percentile", () => {
    // 10 teams, rank 3 out of 10 = percentile 0.3 → B
    const allValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = computeMatchupGrade(80, allValues);
    expect(result).toBe("B");
  });

  it("assigns C grade to 41st-60th percentile", () => {
    // 10 teams, rank 5 out of 10 = percentile 0.5 → C
    const allValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = computeMatchupGrade(60, allValues);
    expect(result).toBe("C");
  });

  it("assigns D grade to 61st-80th percentile", () => {
    // 10 teams, rank 7 out of 10 = percentile 0.7 → D
    const allValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = computeMatchupGrade(40, allValues);
    expect(result).toBe("D");
  });

  it("handles exactly 5 teams (minimum valid dataset)", () => {
    // 5 teams: [50, 40, 30, 20, 10]
    // Rank 1 out of 5 = percentile 0.2 → A
    const allValues = [10, 20, 30, 40, 50];
    const result = computeMatchupGrade(50, allValues);
    expect(result).toBe("A");
  });

  it("handles duplicate values in the dataset", () => {
    // 5 teams: [100, 100, 50, 50, 10]
    // opponentDefensiveValue = 100, rank 1 out of 5 = percentile 0.2 → A
    const allValues = [100, 100, 50, 50, 10];
    const result = computeMatchupGrade(100, allValues);
    expect(result).toBe("A");
  });

  it("handles opponent value not in the dataset by finding insertion rank", () => {
    // 5 teams sorted desc: [100, 80, 60, 40, 20]
    // opponentDefensiveValue = 70 → 2 values > 70 → rank 3 → percentile 3/5 = 0.6 → C
    const allValues = [100, 80, 60, 40, 20];
    const result = computeMatchupGrade(70, allValues);
    expect(result).toBe("C");
  });

  it("handles boundary at exactly 20th percentile (A grade)", () => {
    // 5 teams, rank 1 out of 5 = percentile 0.2 → A (boundary belongs to A)
    const allValues = [50, 40, 30, 20, 10];
    const result = computeMatchupGrade(50, allValues);
    expect(result).toBe("A");
  });
});

describe("percentileToGrade", () => {
  it("maps percentile 0 to A", () => {
    expect(percentileToGrade(0)).toBe("A");
  });

  it("maps percentile 0.2 to A (boundary)", () => {
    expect(percentileToGrade(0.2)).toBe("A");
  });

  it("maps percentile 0.21 to B", () => {
    expect(percentileToGrade(0.21)).toBe("B");
  });

  it("maps percentile 0.4 to B (boundary)", () => {
    expect(percentileToGrade(0.4)).toBe("B");
  });

  it("maps percentile 0.41 to C", () => {
    expect(percentileToGrade(0.41)).toBe("C");
  });

  it("maps percentile 0.6 to C (boundary)", () => {
    expect(percentileToGrade(0.6)).toBe("C");
  });

  it("maps percentile 0.61 to D", () => {
    expect(percentileToGrade(0.61)).toBe("D");
  });

  it("maps percentile 0.8 to D (boundary)", () => {
    expect(percentileToGrade(0.8)).toBe("D");
  });

  it("maps percentile 0.81 to F", () => {
    expect(percentileToGrade(0.81)).toBe("F");
  });

  it("maps percentile 1.0 to F", () => {
    expect(percentileToGrade(1.0)).toBe("F");
  });
});

describe("getGradeColor", () => {
  it("returns green for grade A", () => {
    expect(getGradeColor("A")).toBe("green");
  });

  it("returns green for grade B", () => {
    expect(getGradeColor("B")).toBe("green");
  });

  it("returns yellow for grade C", () => {
    expect(getGradeColor("C")).toBe("yellow");
  });

  it("returns red for grade D", () => {
    expect(getGradeColor("D")).toBe("red");
  });

  it("returns red for grade F", () => {
    expect(getGradeColor("F")).toBe("red");
  });

  it("covers all possible grades", () => {
    const grades: MatchupGrade[] = ["A", "B", "C", "D", "F"];
    const validColors = ["green", "yellow", "red"];
    for (const grade of grades) {
      expect(validColors).toContain(getGradeColor(grade));
    }
  });
});
