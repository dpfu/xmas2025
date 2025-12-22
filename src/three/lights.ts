import * as THREE from "three";

export type SceneLights = {
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  amb: THREE.AmbientLight;
  spot: THREE.PointLight;
  rim: THREE.DirectionalLight;
  trunkWarm: THREE.PointLight;
  baseLevels: {
    key: number;
    fill: number;
    amb: number;
    rim: number;
    trunkWarm: number;
  };
  updateGlow: (glow: number) => void;
  updateStage: (stage: { treeX: number; treeZ: number; groundY: number }) => void;
};

export function createSceneLights(scene: THREE.Scene, stage: { treeX: number; treeZ: number; groundY: number }): SceneLights {
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(3.5, 5.5, 2.5);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9db7ff, 0.25);
  fill.position.set(-3, 2.5, 2);
  scene.add(fill);

  const amb = new THREE.AmbientLight(0xffffff, 0.22);
  scene.add(amb);

  const spot = new THREE.PointLight(0xffe7d6, 0.25, 18);
  spot.position.set(0, 2.2, -3.5);
  scene.add(spot);

  const rim = new THREE.DirectionalLight(0xffe2a8, 0.95);
  rim.position.set(-3.5, 2.2, -3.0);
  scene.add(rim);

  const trunkWarm = new THREE.PointLight(0xffc28a, 0.25, 2.5);
  trunkWarm.position.set(stage.treeX, stage.groundY + 0.6, stage.treeZ + 0.3);
  scene.add(trunkWarm);

  const baseLevels = {
    key: key.intensity,
    fill: fill.intensity,
    amb: amb.intensity,
    rim: rim.intensity,
    trunkWarm: trunkWarm.intensity,
  };

  const updateGlow = (glow: number) => {
    key.intensity = baseLevels.key * glow;
    fill.intensity = baseLevels.fill * glow;
    amb.intensity = baseLevels.amb * glow;
    rim.intensity = baseLevels.rim * glow;
    trunkWarm.intensity = baseLevels.trunkWarm * glow;
  };

  const updateStage = (nextStage: { treeX: number; treeZ: number; groundY: number }) => {
    trunkWarm.position.set(nextStage.treeX, nextStage.groundY + 0.6, nextStage.treeZ + 0.3);
  };

  return { key, fill, amb, spot, rim, trunkWarm, baseLevels, updateGlow, updateStage };
}
