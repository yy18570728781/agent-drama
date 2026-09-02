import { MannequinObject, Vector3D } from '@/components/director-3d/director3D.types';
import { POSE_PRESETS } from '@/components/director-3d/director3D.constants';

export class DistributionEngine {
  /**
   * Generates a circular distribution of mannequins around a center point
   */
  static distributeCircle(
    center: Vector3D,
    radius: number,
    count: number,
    baseTemplate: MannequinObject,
    style: 'detailed' | 'simple' | 'cube' | 'cone' | 'glb' = 'simple'
  ): MannequinObject[] {
    const mannequins: MannequinObject[] = [];
    for (let i = 0; i < count; i++) {
      const angle = (i * 2 * Math.PI) / count;
      const x = center.x + radius * Math.cos(angle);
      const z = center.z + radius * Math.sin(angle);
      const y = center.y;

      // Make mannequins look towards the center
      const angleDegrees = (angle * 180) / Math.PI + 90; // offset pointing inwards
      const rotationY = -angleDegrees;

      const randomPose = POSE_PRESETS[Math.floor(Math.random() * POSE_PRESETS.length)];

      mannequins.push({
        ...JSON.parse(JSON.stringify(baseTemplate)),
        id: `mannequin_dist_circle_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
        name: `圆周人偶-${style === 'simple' ? '筒衣人' : '精细'}-${i + 1}`,
        position: { x, y, z },
        rotation: { x: 0, y: rotationY, z: 0 },
        visible: true,
        style,
        joints: JSON.parse(JSON.stringify(randomPose.joints)),
      });
    }
    return mannequins;
  }

  /**
   * Generates a linear distribution of mannequins between a start and end point
   */
  static distributeLine(
    start: Vector3D,
    end: Vector3D,
    count: number,
    baseTemplate: MannequinObject,
    style: 'detailed' | 'simple' | 'cube' | 'cone' | 'glb' = 'simple'
  ): MannequinObject[] {
    const mannequins: MannequinObject[] = [];
    if (count <= 1) {
      mannequins.push({
        ...JSON.parse(JSON.stringify(baseTemplate)),
        id: `mannequin_dist_line_${Date.now()}_0_${Math.floor(Math.random() * 1000)}`,
        name: `线性人偶-${style === 'simple' ? '筒衣人' : '精细'}-1`,
        position: { ...start },
        visible: true,
        style,
      });
      return mannequins;
    }

    // Direction vector for linear heading alignment
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const pathAngle = Math.atan2(dx, dz) * (180 / Math.PI); // Angle of the line

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const x = start.x + t * (end.x - start.x);
      const y = start.y + t * (end.y - start.y);
      const z = start.z + t * (end.z - start.z);

      const randomPose = POSE_PRESETS[Math.floor(Math.random() * POSE_PRESETS.length)];

      mannequins.push({
        ...JSON.parse(JSON.stringify(baseTemplate)),
        id: `mannequin_dist_line_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
        name: `线性人偶-${style === 'simple' ? '筒衣人' : '精细'}-${i + 1}`,
        position: { x, y, z },
        rotation: { x: 0, y: pathAngle, z: 0 }, // Face along line path
        visible: true,
        style,
        joints: JSON.parse(JSON.stringify(randomPose.joints)),
      });
    }
    return mannequins;
  }

  /**
   * Generates a structural grid distribution (rows x cols)
   */
  static distributeGrid(
    center: Vector3D,
    rows: number,
    cols: number,
    spacingX: number,
    spacingZ: number,
    baseTemplate: MannequinObject,
    style: 'detailed' | 'simple' | 'cube' | 'cone' | 'glb' = 'simple'
  ): MannequinObject[] {
    const mannequins: MannequinObject[] = [];
    const halfWidth = ((cols - 1) * spacingX) / 2;
    const halfDepth = ((rows - 1) * spacingZ) / 2;

    let index = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = center.x + c * spacingX - halfWidth;
        const z = center.z + r * spacingZ - halfDepth;
        const y = center.y;

        const randomPose = POSE_PRESETS[Math.floor(Math.random() * POSE_PRESETS.length)];

        mannequins.push({
          ...JSON.parse(JSON.stringify(baseTemplate)),
          id: `mannequin_dist_grid_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
          name: `阵列人偶-${style === 'simple' ? '筒衣人' : '精细'}-${index + 1}`,
          position: { x, y, z },
          rotation: { x: 0, y: 0, z: 0 },
          visible: true,
          style,
          joints: JSON.parse(JSON.stringify(randomPose.joints)),
        });
        index++;
      }
    }
    return mannequins;
  }

  /**
   * Generates a random area distribution inside a bounded box (width x depth)
   */
  static distributeRandomArea(
    center: Vector3D,
    width: number,
    depth: number,
    count: number,
    baseTemplate: MannequinObject,
    style: 'detailed' | 'simple' | 'cube' | 'cone' | 'glb' = 'simple'
  ): MannequinObject[] {
    const mannequins: MannequinObject[] = [];
    for (let i = 0; i < count; i++) {
      const rx = (Math.random() - 0.5) * width;
      const rz = (Math.random() - 0.5) * depth;
      const x = center.x + rx;
      const z = center.z + rz;
      const y = center.y;

      // Random face rotation Y between 0 and 360 degrees
      const rotationY = Math.random() * 360;

      const randomPose = POSE_PRESETS[Math.floor(Math.random() * POSE_PRESETS.length)];

      mannequins.push({
        ...JSON.parse(JSON.stringify(baseTemplate)),
        id: `mannequin_dist_rand_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
        name: `区域随机人偶-${style === 'simple' ? '筒衣人' : '精细'}-${i + 1}`,
        position: { x, y, z },
        rotation: { x: 0, y: rotationY, z: 0 },
        visible: true,
        style,
        joints: JSON.parse(JSON.stringify(randomPose.joints)),
      });
    }
    return mannequins;
  }

  /**
   * Generates a filled circle distribution using Fermat's Sunflower Spiral and uniform spacing
   */
  static distributeCircleFilled(
    center: Vector3D,
    radius: number,
    count: number,
    baseTemplate: MannequinObject,
    style: 'detailed' | 'simple' | 'cube' | 'cone' | 'glb' = 'simple'
  ): MannequinObject[] {
    const mannequins: MannequinObject[] = [];
    // Golden angle in radians (approx 137.5 degrees)
    const goldenAngle = 137.5 * (Math.PI / 180);

    for (let i = 0; i < count; i++) {
      // Scale radius proportionally for uniform area density
      const r = radius * Math.sqrt((i + 0.5) / count);
      const angle = i * goldenAngle;
      
      const x = center.x + r * Math.cos(angle);
      const z = center.z + r * Math.sin(angle);
      const y = center.y;

      // Face outwards from center, offset by 90 deg so they orient natural outwards
      const rotationY = -((angle * 180) / Math.PI - 90);
      const randomPose = POSE_PRESETS[Math.floor(Math.random() * POSE_PRESETS.length)];

      mannequins.push({
        ...JSON.parse(JSON.stringify(baseTemplate)),
        id: `mannequin_dist_cirf_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
        name: `圆内实心-${style === 'simple' ? '筒衣人' : '精细'}-${i + 1}`,
        position: { x, y, z },
        rotation: { x: 0, y: rotationY, z: 0 },
        visible: true,
        style,
        joints: JSON.parse(JSON.stringify(randomPose.joints)),
      });
    }
    return mannequins;
  }

  /**
   * Generates a filled triangle/pyramid distribution (layered rows)
   */
  static distributeTriangle(
    center: Vector3D,
    spacingX: number,
    spacingZ: number,
    count: number,
    baseTemplate: MannequinObject,
    style: 'detailed' | 'simple' | 'cube' | 'cone' | 'glb' = 'simple'
  ): MannequinObject[] {
    const mannequins: MannequinObject[] = [];
    
    // First, calculate total rows that would be generated
    let countRemaining = count;
    let row = 0;
    const rowCounts: number[] = [];
    while (countRemaining > 0) {
      const peopleInRow = Math.min(row + 1, countRemaining);
      rowCounts.push(peopleInRow);
      countRemaining -= peopleInRow;
      row++;
    }

    const totalRows = rowCounts.length;
    // Offset for centering the depth
    const totalDepth = (totalRows - 1) * spacingZ;
    const centerOffsetZ = totalDepth / 2;

    let index = 0;
    for (let r = 0; r < totalRows; r++) {
      const peopleInRow = rowCounts[r];
      // Centered X offset
      const offset = (peopleInRow - 1) / 2;
      const z = center.z + r * spacingZ - centerOffsetZ;

      for (let c = 0; c < peopleInRow; c++) {
        const x = center.x + (c - offset) * spacingX;
        const y = center.y;

        const randomPose = POSE_PRESETS[Math.floor(Math.random() * POSE_PRESETS.length)];

        mannequins.push({
          ...JSON.parse(JSON.stringify(baseTemplate)),
          id: `mannequin_dist_tri_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
          name: `三角宿营-${style === 'simple' ? '筒衣人' : '精细'}-${index + 1}`,
          position: { x, y, z },
          rotation: { x: 0, y: 0, z: 0 }, // Face forward
          visible: true,
          style,
          joints: JSON.parse(JSON.stringify(randomPose.joints)),
        });
        index++;
      }
    }
    return mannequins;
  }

  /**
   * Generates a Symmetric Chevron / V-shape (Swallowtail / 燕尾阵型)
   */
  static distributeVee(
    center: Vector3D,
    spacingX: number,
    spacingZ: number,
    count: number,
    baseTemplate: MannequinObject,
    style: 'detailed' | 'simple' | 'cube' | 'cone' | 'glb' = 'simple'
  ): MannequinObject[] {
    const mannequins: MannequinObject[] = [];
    
    // Determine the total depth of the wings
    const pairsCount = Math.ceil((count - 1) / 2);
    const totalDepth = pairsCount * spacingZ;
    const centerOffsetZ = totalDepth / 2;

    for (let i = 0; i < count; i++) {
      let x = center.x;
      let z = center.z;
      let rotationY = 0;

      if (i === 0) {
        // Apex node (tip of V)
        x = center.x;
        z = center.z - centerOffsetZ;
        rotationY = 0; // facing forward
      } else {
        const wingIndex = Math.ceil(i / 2);
        z = center.z - centerOffsetZ + wingIndex * spacingZ;

        if (i % 2 === 1) {
          // Left Wing
          x = center.x - wingIndex * spacingX;
          rotationY = -25; // slightly outwards tilt
        } else {
          // Right Wing
          x = center.x + wingIndex * spacingX;
          rotationY = 25; // slightly outwards tilt
        }
      }

      const y = center.y;
      const randomPose = POSE_PRESETS[Math.floor(Math.random() * POSE_PRESETS.length)];

      mannequins.push({
        ...JSON.parse(JSON.stringify(baseTemplate)),
        id: `mannequin_dist_vee_${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`,
        name: `燕尾冲锋-${style === 'simple' ? '筒衣人' : '精细'}-${i + 1}`,
        position: { x, y, z },
        rotation: { x: 0, y: rotationY, z: 0 },
        visible: true,
        style,
        joints: JSON.parse(JSON.stringify(randomPose.joints)),
      });
    }
    return mannequins;
  }
}
