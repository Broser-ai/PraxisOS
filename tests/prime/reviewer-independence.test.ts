// A reviewer must be independent of everyone upstream, not only the verifier.
//
// #58 chained verifier→builder and reviewer→verifier, which left builder→reviewer
// unguarded: a builder could review its own output directly.

import { describe, expect, it } from "vitest";
import {
    assertRoleSeparation,
    executionIdentityForRole,
} from "@/lib/prime/dispatcher";
import type { MissionRole } from "@/lib/prime/mission-types";

const missionId = "msn_1";
const workstreamId = "ws_1";
const identity = (role: MissionRole) =>
    executionIdentityForRole({ missionId, workstreamId, role });

describe("prime roles · reviewer independence", () => {
    it("builder cannot be its own reviewer", () => {
        const res = assertRoleSeparation({
            missionId,
            workstreamId,
            role: "reviewer",
            priorIdentities: { builder: identity("reviewer") },
        });
        expect(res.ok).toBe(false);
        if (!res.ok) {
            expect(res.error).toBe("reviewer_cannot_be_own_builder");
            expect(res.conflictingRole).toBe("builder");
        }
    });

    it("verifier cannot be its own reviewer", () => {
        const res = assertRoleSeparation({
            missionId,
            workstreamId,
            role: "reviewer",
            priorIdentities: { verifier: identity("reviewer") },
        });
        expect(res.ok).toBe(false);
        if (!res.ok) expect(res.conflictingRole).toBe("verifier");
    });

    it("reviewer conflicting with both upstream roles is rejected", () => {
        const res = assertRoleSeparation({
            missionId,
            workstreamId,
            role: "reviewer",
            priorIdentities: {
                builder: identity("reviewer"),
                verifier: identity("reviewer"),
            },
        });
        expect(res.ok).toBe(false);
    });

    it("a genuinely independent reviewer still passes", () => {
        const res = assertRoleSeparation({
            missionId,
            workstreamId,
            role: "reviewer",
            priorIdentities: {
                builder: identity("builder"),
                verifier: identity("verifier"),
            },
        });
        expect(res.ok).toBe(true);
    });

    it("builder cannot be its own verifier", () => {
        const res = assertRoleSeparation({
            missionId,
            workstreamId,
            role: "verifier",
            priorIdentities: { builder: identity("verifier") },
        });
        expect(res.ok).toBe(false);
    });

    it("the test-only override still is not the default", () => {
        const strict = assertRoleSeparation({
            missionId,
            workstreamId,
            role: "reviewer",
            priorIdentities: { builder: identity("reviewer") },
        });
        expect(strict.ok).toBe(false);

        const relaxed = assertRoleSeparation({
            missionId,
            workstreamId,
            role: "reviewer",
            priorIdentities: { builder: identity("reviewer") },
            allowSameIdentity: true,
        });
        expect(relaxed.ok).toBe(true);
    });
});
