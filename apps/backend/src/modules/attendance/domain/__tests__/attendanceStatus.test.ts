/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { computeAttendanceStatus } from "../attendanceStatus";

describe("computeAttendanceStatus", () => {
  it("returns PENDING_EARLY when no class start time", () => {
    const status = computeAttendanceStatus({
      dbStatus: null,
      classStartTime: null,
      absenceCutoffMinutes: 180,
      nowMinutes: 8 * 60,
    });
    expect(status).toBe("PENDING_EARLY");
  });

  it("returns PENDING_EARLY before class start", () => {
    const status = computeAttendanceStatus({
      dbStatus: null,
      classStartTime: "09:00",
      absenceCutoffMinutes: 180,
      nowMinutes: 8 * 60 + 30,
    });
    expect(status).toBe("PENDING_EARLY");
  });

  it("returns PENDING_LATE between class start and cutoff", () => {
    const status = computeAttendanceStatus({
      dbStatus: null,
      classStartTime: "09:00",
      absenceCutoffMinutes: 180,
      nowMinutes: 10 * 60,
    });
    expect(status).toBe("PENDING_LATE");
  });

  it("returns ABSENT after cutoff", () => {
    const status = computeAttendanceStatus({
      dbStatus: null,
      classStartTime: "09:00",
      absenceCutoffMinutes: 180,
      nowMinutes: 13 * 60 + 1,
    });
    expect(status).toBe("ABSENT");
  });
});
