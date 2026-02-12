import type { VRM } from "@pixiv/three-vrm";
import type { Emotion } from "@/types";

// ─── Bone rotation target for a pose ───
interface BonePose {
    spine?: { x?: number; y?: number; z?: number };
    chest?: { x?: number; y?: number; z?: number };
    neck?: { x?: number; y?: number; z?: number };
    head?: { x?: number; y?: number; z?: number };
    leftUpperArm?: { x?: number; y?: number; z?: number };
    rightUpperArm?: { x?: number; y?: number; z?: number };
    leftLowerArm?: { x?: number; y?: number; z?: number };
    rightLowerArm?: { x?: number; y?: number; z?: number };
    leftHand?: { x?: number; y?: number; z?: number };
    rightHand?: { x?: number; y?: number; z?: number };
}

// ─── Emotion‐specific base poses ───
const EMOTION_POSES: Record<Emotion, BonePose> = {
    neutral: {
        spine: { x: 0, y: 0, z: 0 },
        chest: { x: 0, y: 0, z: 0 },
        head: { x: -0.05, y: 0, z: 0 },
        leftUpperArm: { x: 0, y: 0, z: 1.1 },
        rightUpperArm: { x: 0, y: 0, z: -1.1 },
        leftLowerArm: { x: 0, y: 0, z: 0.15 },
        rightLowerArm: { x: 0, y: 0, z: -0.15 },
    },
    happy: {
        spine: { x: 0.03, y: 0, z: 0 },
        chest: { x: 0.02, y: 0, z: 0 },
        head: { x: -0.08, y: 0, z: 0.05 },
        leftUpperArm: { x: 0, y: 0, z: 0.9 },
        rightUpperArm: { x: 0, y: 0, z: -0.9 },
        leftLowerArm: { x: 0, y: 0, z: 0.4 },
        rightLowerArm: { x: 0, y: 0, z: -0.4 },
    },
    sad: {
        spine: { x: 0.08, y: 0, z: 0 },
        chest: { x: 0.05, y: 0, z: 0 },
        head: { x: 0.15, y: 0, z: 0 },
        neck: { x: 0.05, y: 0, z: 0 },
        leftUpperArm: { x: 0.1, y: 0, z: 1.2 },
        rightUpperArm: { x: 0.1, y: 0, z: -1.2 },
        leftLowerArm: { x: 0, y: 0, z: 0.3 },
        rightLowerArm: { x: 0, y: 0, z: -0.3 },
    },
    angry: {
        spine: { x: -0.05, y: 0, z: 0 },
        chest: { x: -0.03, y: 0, z: 0 },
        head: { x: -0.1, y: 0, z: 0 },
        leftUpperArm: { x: -0.15, y: 0, z: 0.85 },
        rightUpperArm: { x: -0.15, y: 0, z: -0.85 },
        leftLowerArm: { x: 0, y: 0, z: 0.5 },
        rightLowerArm: { x: 0, y: 0, z: -0.5 },
    },
    surprised: {
        spine: { x: -0.06, y: 0, z: 0 },
        chest: { x: -0.04, y: 0, z: 0 },
        head: { x: -0.12, y: 0, z: 0 },
        leftUpperArm: { x: -0.3, y: 0, z: 0.6 },
        rightUpperArm: { x: -0.3, y: 0, z: -0.6 },
        leftLowerArm: { x: -0.3, y: 0, z: 0.6 },
        rightLowerArm: { x: -0.3, y: 0, z: -0.6 },
        leftHand: { x: -0.2, y: 0, z: 0 },
        rightHand: { x: -0.2, y: 0, z: 0 },
    },
    shy: {
        spine: { x: 0.04, y: 0, z: 0.03 },
        chest: { x: 0.03, y: 0, z: 0.02 },
        head: { x: 0.05, y: 0.15, z: 0.1 },
        neck: { x: 0.03, y: 0.05, z: 0 },
        leftUpperArm: { x: 0.2, y: 0, z: 1.0 },
        rightUpperArm: { x: 0.2, y: 0, z: -1.0 },
        leftLowerArm: { x: 0, y: 0, z: 0.6 },
        rightLowerArm: { x: 0, y: 0, z: -0.6 },
    },
};

// ─── Random gesture definitions ───
interface Gesture {
    name: string;
    duration: number; // seconds
    bones: BonePose;
}

const RANDOM_GESTURES: Gesture[] = [
    {
        name: "nod",
        duration: 0.8,
        bones: {
            head: { x: 0.1, y: 0, z: 0 },
            neck: { x: 0.03, y: 0, z: 0 },
        },
    },
    {
        name: "tiltRight",
        duration: 1.2,
        bones: {
            head: { x: 0, y: 0, z: -0.12 },
            neck: { x: 0, y: 0, z: -0.03 },
        },
    },
    {
        name: "tiltLeft",
        duration: 1.2,
        bones: {
            head: { x: 0, y: 0, z: 0.12 },
            neck: { x: 0, y: 0, z: 0.03 },
        },
    },
    {
        name: "lookAway",
        duration: 1.5,
        bones: {
            head: { x: 0, y: 0.2, z: 0 },
            neck: { x: 0, y: 0.08, z: 0 },
        },
    },
    {
        name: "shrug",
        duration: 1.0,
        bones: {
            leftUpperArm: { x: -0.15, y: 0, z: 0 },
            rightUpperArm: { x: -0.15, y: 0, z: 0 },
            head: { x: 0, y: 0, z: 0.05 },
        },
    },
];

// ─── All bone names we manipulate ───
const BONE_NAMES = [
    "spine", "chest", "neck", "head",
    "leftUpperArm", "rightUpperArm",
    "leftLowerArm", "rightLowerArm",
    "leftHand", "rightHand",
] as const;

type BoneName = typeof BONE_NAMES[number];

// ─── Utility ───
function lerpAngle(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function easeInOutSine(t: number): number {
    return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ═══════════════════════════════════════════════════════════════
// MotionController
// ═══════════════════════════════════════════════════════════════
export class MotionController {
    private vrm: VRM;

    // ── Pose transition ──
    private currentPose: BonePose;
    private targetPose: BonePose;
    private poseTransition = 1; // 0→1, 1 = arrived
    private poseTransitionSpeed = 1.8; // per second

    // ── Idle sway ──
    private idleTime = 0;

    // ── Random gesture ──
    private gestureTimer = 0;
    private gestureInterval = 5 + Math.random() * 5; // seconds
    private activeGesture: Gesture | null = null;
    private gestureProgress = 0;
    private gesturePhase: "in" | "hold" | "out" = "in";

    // ── Happy bounce ──
    private bouncePhase = 0;

    constructor(vrm: VRM) {
        this.vrm = vrm;
        this.currentPose = deepClonePose(EMOTION_POSES.neutral);
        this.targetPose = deepClonePose(EMOTION_POSES.neutral);
    }

    /**
     * Set the emotion and transition to the matching pose.
     */
    setEmotion(emotion: Emotion): void {
        this.currentPose = this.getResolvedPose();
        this.targetPose = deepClonePose(EMOTION_POSES[emotion]);
        this.poseTransition = 0;
    }

    /**
     * Call every frame from the animation loop.
     */
    update(delta: number): void {
        const humanoid = this.vrm.humanoid;
        if (!humanoid) return;

        this.idleTime += delta;

        // ── 1. Advance pose transition ──
        if (this.poseTransition < 1) {
            this.poseTransition = Math.min(1, this.poseTransition + delta * this.poseTransitionSpeed);
        }

        const basePose = this.getResolvedPose();

        // ── 2. Idle sway (additive) ──
        const idleSway = this.getIdleSway();

        // ── 3. Random gesture (additive) ──
        const gestureDelta = this.updateGesture(delta);

        // ── 4. Happy bounce (additive) ──
        const bounceDelta = this.updateBounce(delta);

        // ── 5. Apply everything to bones ──
        for (const boneName of BONE_NAMES) {
            const boneNode = humanoid.getNormalizedBoneNode(boneName);
            if (!boneNode) continue;

            const base = basePose[boneName] || { x: 0, y: 0, z: 0 };
            const sway = idleSway[boneName] || { x: 0, y: 0, z: 0 };
            const gesture = gestureDelta[boneName] || { x: 0, y: 0, z: 0 };
            const bounce = bounceDelta[boneName] || { x: 0, y: 0, z: 0 };

            boneNode.rotation.x = (base.x ?? 0) + (sway.x ?? 0) + (gesture.x ?? 0) + (bounce.x ?? 0);
            boneNode.rotation.y = (base.y ?? 0) + (sway.y ?? 0) + (gesture.y ?? 0) + (bounce.y ?? 0);
            boneNode.rotation.z = (base.z ?? 0) + (sway.z ?? 0) + (gesture.z ?? 0) + (bounce.z ?? 0);
        }
    }

    // ─────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────

    /** Lerp between currentPose and targetPose based on transition progress. */
    private getResolvedPose(): BonePose {
        const t = easeInOutSine(this.poseTransition);
        const result: BonePose = {};
        for (const boneName of BONE_NAMES) {
            const from = this.currentPose[boneName] || { x: 0, y: 0, z: 0 };
            const to = this.targetPose[boneName] || { x: 0, y: 0, z: 0 };
            result[boneName] = {
                x: lerpAngle(from.x ?? 0, to.x ?? 0, t),
                y: lerpAngle(from.y ?? 0, to.y ?? 0, t),
                z: lerpAngle(from.z ?? 0, to.z ?? 0, t),
            };
        }
        return result;
    }

    /** Subtle body sway for natural idle feeling. */
    private getIdleSway(): BonePose {
        const t = this.idleTime;
        return {
            spine: {
                x: Math.sin(t * 0.8) * 0.008,
                y: Math.sin(t * 0.3) * 0.005,
                z: Math.cos(t * 0.5) * 0.004,
            },
            chest: {
                x: Math.sin(t * 0.9) * 0.005,
                y: 0,
                z: Math.cos(t * 0.6) * 0.003,
            },
            head: {
                x: Math.sin(t * 0.5) * 0.012,
                y: Math.sin(t * 0.3) * 0.025,
                z: Math.cos(t * 0.4) * 0.008,
            },
            leftUpperArm: {
                x: Math.sin(t * 0.7) * 0.01,
                y: 0,
                z: Math.cos(t * 0.6) * 0.008,
            },
            rightUpperArm: {
                x: Math.sin(t * 0.7) * 0.01,
                y: 0,
                z: -Math.cos(t * 0.6) * 0.008,
            },
        };
    }

    /** Update random gesture timer and return additive bone offsets. */
    private updateGesture(delta: number): BonePose {
        const empty: BonePose = {};

        // If no gesture is active, tick the timer
        if (!this.activeGesture) {
            this.gestureTimer += delta;
            if (this.gestureTimer >= this.gestureInterval) {
                // Pick a random gesture
                this.activeGesture = RANDOM_GESTURES[Math.floor(Math.random() * RANDOM_GESTURES.length)];
                this.gestureProgress = 0;
                this.gesturePhase = "in";
                this.gestureTimer = 0;
                this.gestureInterval = 6 + Math.random() * 8;
            }
            return empty;
        }

        // Advance gesture
        const g = this.activeGesture;
        const phaseLen = g.duration / 3;
        this.gestureProgress += delta;

        let intensity = 0;

        if (this.gesturePhase === "in") {
            intensity = easeInOutSine(Math.min(1, this.gestureProgress / phaseLen));
            if (this.gestureProgress >= phaseLen) {
                this.gestureProgress = 0;
                this.gesturePhase = "hold";
            }
        } else if (this.gesturePhase === "hold") {
            intensity = 1;
            if (this.gestureProgress >= phaseLen) {
                this.gestureProgress = 0;
                this.gesturePhase = "out";
            }
        } else {
            intensity = 1 - easeInOutSine(Math.min(1, this.gestureProgress / phaseLen));
            if (this.gestureProgress >= phaseLen) {
                this.activeGesture = null;
                return empty;
            }
        }

        // Scale gesture bones by intensity
        const result: BonePose = {};
        for (const boneName of BONE_NAMES) {
            const gBone = g.bones[boneName];
            if (gBone) {
                result[boneName] = {
                    x: (gBone.x ?? 0) * intensity,
                    y: (gBone.y ?? 0) * intensity,
                    z: (gBone.z ?? 0) * intensity,
                };
            }
        }
        return result;
    }

    /** Gentle bounce for happy emotion. */
    private updateBounce(delta: number): BonePose {
        // Only bounce when target pose is happy and transition is mostly done
        const isHappy = this.targetPose === EMOTION_POSES.happy ||
            (this.targetPose.spine?.x === EMOTION_POSES.happy.spine?.x &&
                this.targetPose.head?.z === EMOTION_POSES.happy.head?.z);

        if (!isHappy || this.poseTransition < 0.7) {
            this.bouncePhase = 0;
            return {};
        }

        this.bouncePhase += delta * 3.5;
        const bounce = Math.sin(this.bouncePhase) * 0.015;

        return {
            spine: { x: bounce, y: 0, z: 0 },
            chest: { x: bounce * 0.5, y: 0, z: 0 },
        };
    }
}

// ─── Deep clone a BonePose ───
function deepClonePose(pose: BonePose): BonePose {
    const result: BonePose = {};
    for (const boneName of BONE_NAMES) {
        const b = pose[boneName];
        if (b) {
            result[boneName] = { x: b.x ?? 0, y: b.y ?? 0, z: b.z ?? 0 };
        }
    }
    return result;
}
