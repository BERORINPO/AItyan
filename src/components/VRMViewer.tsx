"use client";

import { useEffect, useRef } from "react";
import type { Emotion } from "@/types";
import { MotionController } from "@/lib/avatar/motion-controller";

interface VRMViewerProps {
  emotion: Emotion;
  isTalking: boolean;
  volume: number;
}

const EMOTION_COLORS: Record<Emotion, string> = {
  happy: "#f472b6",
  surprised: "#fbbf24",
  shy: "#f9a8d4",
  sad: "#60a5fa",
  neutral: "#c084fc",
  angry: "#ef4444",
};

const EMOTION_LABELS: Record<Emotion, string> = {
  happy: "😊 嬉しい",
  surprised: "😲 驚き",
  shy: "😳 照れ",
  sad: "😢 悲しい",
  neutral: "🙂 通常",
  angry: "😤 怒り",
};

export function VRMViewer({ emotion, isTalking, volume }: VRMViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<{
    scene: import("three").Scene;
    camera: import("three").PerspectiveCamera;
    renderer: import("three").WebGLRenderer;
    vrm: import("@pixiv/three-vrm").VRM | null;
    clock: import("three").Clock;
    particles: import("three").Points | null;
    motionController: MotionController | null;
  } | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    let animationId: number;

    async function init() {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { VRMLoaderPlugin, VRMUtils } = await import("@pixiv/three-vrm");

      const canvas = canvasRef.current!;
      const scene = new THREE.Scene();

      // Gradient background
      scene.background = new THREE.Color(0x0a0615);

      // Camera
      const camera = new THREE.PerspectiveCamera(
        30,
        canvas.clientWidth / canvas.clientHeight,
        0.1,
        20
      );
      camera.position.set(0, 1.3, 2.5);
      camera.lookAt(0, 1.2, 0);

      // Renderer
      const renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.4;

      // Lighting
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xfff0f5, 1.0);
      directionalLight.position.set(1, 2, 3);
      scene.add(directionalLight);

      const pinkLight = new THREE.PointLight(0xf472b6, 0.8, 10);
      pinkLight.position.set(-2, 1.5, 2);
      scene.add(pinkLight);

      const purpleLight = new THREE.PointLight(0xa855f7, 0.5, 10);
      purpleLight.position.set(2, 0.5, -1);
      scene.add(purpleLight);

      const cyanLight = new THREE.PointLight(0x22d3ee, 0.3, 10);
      cyanLight.position.set(0, 2, -2);
      scene.add(cyanLight);

      // Floating particles
      const particleCount = 80;
      const positions = new Float32Array(particleCount * 3);
      const sizes = new Float32Array(particleCount);
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 6;
        positions[i * 3 + 1] = Math.random() * 4 - 0.5;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 4;
        sizes[i] = Math.random() * 3 + 1;
      }
      const particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      particleGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
      const particleMaterial = new THREE.PointsMaterial({
        color: 0xf9a8d4,
        size: 0.02,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const particles = new THREE.Points(particleGeometry, particleMaterial);
      scene.add(particles);

      // Load VRM
      const loader = new GLTFLoader();
      loader.register((parser) => new VRMLoaderPlugin(parser));

      let vrm: import("@pixiv/three-vrm").VRM | null = null;

      try {
        const gltf = await loader.loadAsync("/models/girlfriend.vrm");
        vrm = gltf.userData.vrm;
        if (vrm) {
          VRMUtils.removeUnnecessaryVertices(gltf.scene);
          VRMUtils.removeUnnecessaryJoints(gltf.scene);
          vrm.scene.rotation.y = Math.PI;
          scene.add(vrm.scene);

          // Idle pose is now managed by MotionController
        }
      } catch {
        // VRM not found - show fancy placeholder
        createPlaceholderAvatar(THREE, scene);
      }

      const clock = new THREE.Clock();
      const motionController = vrm ? new MotionController(vrm) : null;
      rendererRef.current = { scene, camera, renderer, vrm, clock, particles, motionController };

      // Animation loop
      function animate() {
        animationId = requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        if (vrm) {
          // Motion controller handles idle sway, emotion poses, and gestures
          motionController?.update(delta);
          vrm.update(delta);
        }

        // Animate particles
        if (particles) {
          particles.rotation.y += delta * 0.05;
          const pos = particles.geometry.attributes.position;
          for (let i = 0; i < particleCount; i++) {
            const y = pos.getY(i);
            pos.setY(i, y + Math.sin(elapsed + i) * 0.001);
          }
          pos.needsUpdate = true;
        }

        // Animate lights gently
        pinkLight.intensity = 0.6 + Math.sin(elapsed * 0.5) * 0.2;
        purpleLight.intensity = 0.4 + Math.cos(elapsed * 0.7) * 0.15;

        renderer.render(scene, camera);
      }
      animate();

      // Handle resize
      const handleResize = () => {
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      };
      window.addEventListener("resize", handleResize);

      return () => {
        window.removeEventListener("resize", handleResize);
      };
    }

    init();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (rendererRef.current) {
        rendererRef.current.renderer.dispose();
      }
    };
  }, []);

  // Update expression and motion based on emotion
  useEffect(() => {
    const ref = rendererRef.current;
    if (!ref?.vrm?.expressionManager) return;

    const expressionManager = ref.vrm.expressionManager;

    // Reset all expressions
    expressionManager.setValue("happy", 0);
    expressionManager.setValue("angry", 0);
    expressionManager.setValue("sad", 0);
    expressionManager.setValue("surprised", 0);
    expressionManager.setValue("relaxed", 0);

    // Set current expression
    switch (emotion) {
      case "happy":
        expressionManager.setValue("happy", 1);
        break;
      case "sad":
        expressionManager.setValue("sad", 1);
        break;
      case "angry":
        expressionManager.setValue("angry", 1);
        break;
      case "surprised":
        expressionManager.setValue("surprised", 1);
        break;
      case "shy":
        expressionManager.setValue("relaxed", 0.7);
        expressionManager.setValue("happy", 0.3);
        break;
      case "neutral":
        expressionManager.setValue("relaxed", 0.3);
        break;
    }

    // Update body motion
    ref.motionController?.setEmotion(emotion);
  }, [emotion]);

  // Lip sync based on volume
  useEffect(() => {
    const ref = rendererRef.current;
    if (!ref?.vrm?.expressionManager) return;

    if (isTalking) {
      const mouthOpen = Math.min(volume / 128, 1) * 0.8;
      ref.vrm.expressionManager.setValue("aa", mouthOpen);
    } else {
      ref.vrm.expressionManager.setValue("aa", 0);
    }
  }, [isTalking, volume]);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="w-full h-full" />

      {/* Vignette overlay */}
      <div className="absolute inset-0 pointer-events-none vignette-overlay" />

      {/* Emotion indicator */}
      <div className="absolute top-4 left-4 emotion-badge">
        <div
          className="w-2.5 h-2.5 rounded-full"
          style={{
            backgroundColor: EMOTION_COLORS[emotion],
            boxShadow: `0 0 8px ${EMOTION_COLORS[emotion]}80`,
          }}
        />
        <span className="text-xs text-white/70 font-medium">
          {EMOTION_LABELS[emotion]}
        </span>
      </div>

      {/* Talking indicator */}
      {isTalking && (
        <div className="absolute top-4 right-4 speaking-badge">
          <div className="flex gap-0.5 items-end h-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-1 bg-gradient-to-t from-pink-500 to-purple-400 rounded-full sound-bar"
                style={{
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-white/70 font-medium">話し中</span>
        </div>
      )}
    </div>
  );
}

// Create a stylish placeholder avatar when VRM file is not available
function createPlaceholderAvatar(THREE: typeof import("three"), scene: import("three").Scene) {
  // Glowing orb body
  const bodyGeometry = new THREE.SphereGeometry(0.4, 32, 32);
  const bodyMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xf472b6,
    emissive: 0xbe185d,
    emissiveIntensity: 0.3,
    roughness: 0.2,
    metalness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.9,
  });
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.set(0, 1.2, 0);
  scene.add(body);

  // Outer glow ring
  const ringGeometry = new THREE.TorusGeometry(0.55, 0.02, 16, 100);
  const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0xc084fc,
    transparent: true,
    opacity: 0.6,
  });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.position.set(0, 1.2, 0);
  ring.rotation.x = Math.PI / 2;
  scene.add(ring);

  // Second ring
  const ring2 = ring.clone();
  ring2.rotation.x = Math.PI / 3;
  ring2.rotation.z = Math.PI / 4;
  scene.add(ring2);

  // Floating animation
  const animate = () => {
    requestAnimationFrame(animate);
    const t = Date.now() * 0.001;
    body.position.y = 1.2 + Math.sin(t * 0.8) * 0.05;
    body.rotation.y += 0.002;
    ring.rotation.z += 0.005;
    ring2.rotation.y += 0.003;
  };
  animate();
}
