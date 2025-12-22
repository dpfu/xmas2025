import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { BLOOM } from "../config/tuning";

export type BloomPipeline = {
  render: () => void;
  setSize: (w: number, h: number) => void;
  bloomPass: UnrealBloomPass;
};

export function createBloomPipeline(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  bloomLayer: number
): BloomPipeline {
  const bloomComposer = new EffectComposer(renderer);
  const bloomRenderPass = new RenderPass(scene, camera);
  bloomRenderPass.clearColor = new THREE.Color(0x000000);
  bloomRenderPass.clearAlpha = 0;
  bloomComposer.renderToScreen = false;
  bloomComposer.addPass(bloomRenderPass);
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(1, 1),
    BLOOM.strength,
    BLOOM.radius,
    BLOOM.threshold
  );
  bloomComposer.addPass(bloomPass);

  const finalComposer = new EffectComposer(renderer);
  const finalRenderPass = new RenderPass(scene, camera);
  finalRenderPass.clearColor = new THREE.Color(0x000000);
  finalRenderPass.clearAlpha = 0;
  finalComposer.addPass(finalRenderPass);
  const finalPass = new ShaderPass(
    new THREE.ShaderMaterial({
      uniforms: {
        baseTexture: { value: null },
        bloomTexture: { value: bloomComposer.renderTarget2.texture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D baseTexture;
        uniform sampler2D bloomTexture;
        varying vec2 vUv;
        void main() {
          vec4 base = texture2D(baseTexture, vUv);
          vec4 bloom = texture2D(bloomTexture, vUv);
          gl_FragColor = vec4(base.rgb + bloom.rgb, base.a);
        }
      `,
      transparent: true,
    }),
    "baseTexture"
  );
  finalComposer.addPass(finalPass);

  const render = () => {
    const prevLayer = camera.layers.mask;
    camera.layers.set(bloomLayer);
    bloomComposer.render();
    camera.layers.mask = prevLayer;
    finalComposer.render();
  };

  const setSize = (w: number, h: number) => {
    bloomComposer.setSize(w, h);
    finalComposer.setSize(w, h);
  };

  return { render, setSize, bloomPass };
}
