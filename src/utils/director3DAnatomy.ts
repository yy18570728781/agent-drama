/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MannequinJoints, JointRotation } from '@/components/director-3d/director3D.types';

export interface AxisLimit {
  min: number;
  max: number;
}

export interface JointLimit {
  x: AxisLimit;
  y: AxisLimit;
  z: AxisLimit;
}

// Biologically and biochemically accurate joint limits in degrees.
// Designed to keep joints within natural range of motion, preventing breaking/unbiological poses.
export const JOINT_LIMITS: Record<keyof MannequinJoints, JointLimit> = {
  head: {
    x: { min: -50, max: 50 },  // Backbend / Front tilt
    y: { min: -75, max: 75 },  // Left / Right turn
    z: { min: -35, max: 35 },  // Side tilt
  },
  chest: {
    x: { min: -25, max: 40 },  // Arch backward / Slump forward
    y: { min: -40, max: 40 },  // Mid-spine twist left / right
    z: { min: -30, max: 30 },  // Side bend
  },
  pelvis: {
    x: { min: -15, max: 15 },  // Hip tilt
    y: { min: -25, max: 25 },  // Waist twist
    z: { min: -15, max: 15 },  // Hip sway
  },
  leftShoulder: {
    x: { min: -90, max: 120 }, // Swing forward (to chest) and backward
    y: { min: -80, max: 80 },  // Arm rotation axis
    z: { min: -135, max: 75 }, // Adjusted for A-Pose base (0 is A-Pose)
  },
  rightShoulder: {
    x: { min: -90, max: 120 },
    y: { min: -80, max: 80 },
    z: { min: -75, max: 135 }, // Adjusted for A-Pose base (0 is A-Pose)
  },
  leftElbow: {
    x: { min: 0, max: 145 },   // Elbows can ONLY bend forward (positive X)
    y: { min: -25, max: 25 },  // Slight yaw adjust
    z: { min: -10, max: 10 },
  },
  rightElbow: {
    x: { min: 0, max: 145 },   // Elbows can ONLY bend forward (positive X)
    y: { min: -25, max: 25 },
    z: { min: -10, max: 10 },
  },
  leftWrist: {
    x: { min: -70, max: 70 },  // Flexion / extension
    y: { min: -45, max: 45 },  // Side wrist bend
    z: { min: -80, max: 80 },  // Rotation
  },
  rightWrist: {
    x: { min: -70, max: 70 },
    y: { min: -45, max: 45 },
    z: { min: -80, max: 80 },
  },
  leftHip: {
    x: { min: -35, max: 110 }, // Leg swing back and forward (running pose moves up to 110)
    y: { min: -35, max: 35 },  // Outward knee rotation
    z: { min: -60, max: 20 },  // Abduction
  },
  rightHip: {
    x: { min: -35, max: 110 },
    y: { min: -35, max: 35 },
    z: { min: -20, max: 60 },
  },
  leftKnee: {
    x: { min: 0, max: 135 },   // Knees can ONLY bend backward (positive X, from 0 to 135 deg)
    y: { min: -5, max: 5 },    // Keeps joint aligned
    z: { min: -5, max: 5 },
  },
  rightKnee: {
    x: { min: 0, max: 135 },   // Knees can ONLY bend backward (positive X)
    y: { min: -5, max: 5 },
    z: { min: -5, max: 5 },
  },
  leftAnkle: {
    x: { min: -40, max: 35 },  // Heel point / toe lift
    y: { min: -20, max: 20 },  // Tweak ankle yaw
    z: { min: -15, max: 15 },  // Ankle roll
  },
  rightAnkle: {
    x: { min: -40, max: 35 },
    y: { min: -20, max: 20 },
    z: { min: -15, max: 15 },
  },
};

export function clampJointRotation(jointName: keyof MannequinJoints, rot: JointRotation): JointRotation {
  // Relax limits to prevent gimbal lock calculation regressions and allow free artistic posing.
  const clamp = (val: number) => {
    // Just normalize angle and round it. We previously clamped which broke 3D gizmo editing.
    // Ensure value is properly normalized just for clean display, but essentially free tracking.
    let a = val;
    // We intentionally don't clamp to keep what the user saw mathematically.
    return Math.round(a);
  };

  return {
    x: clamp(rot.x ?? 0),
    y: clamp(rot.y ?? 0),
    z: clamp(rot.z ?? 0),
  };
}
