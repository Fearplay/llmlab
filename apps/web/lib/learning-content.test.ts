import { describe, expect, it } from "vitest";
import { learningTracks, missions } from "./learning-content";

describe("guided learning coverage", () => {
  it("has one bilingual, actionable mission for every lesson in the four paths plus the bonus", () => {
    const slugs = learningTracks.flatMap((track) => track.slugs);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(missions.map((mission) => mission.slug).sort()).toEqual([...slugs].sort());
    expect(learningTracks.filter((track) => track.id !== "bonus")).toHaveLength(4);
    for (const mission of missions) {
      expect(mission.href).toMatch(/^\//);
      for (const locale of ["cs", "en"] as const) {
        expect(mission.title[locale].trim()).not.toBe("");
        expect(mission.action[locale].trim()).not.toBe("");
        expect(mission.question[locale].trim()).not.toBe("");
        expect(mission.choices[locale][0]).not.toBe(mission.choices[locale][1]);
      }
    }
  });
});
