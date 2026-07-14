<template>
    <div class="demo-container">
        <div class="demo-tag">Demo 01: Hello Cube</div>
        <div ref="containerRef" class="canvas-container"></div>
    </div>
</template>

<script setup>
import * as THREE from "three";
import { onMounted, onUnmounted, ref } from "vue";

const containerRef = ref(null);
const image = new Image();
const texture = new THREE.Texture(image);

image.onload = () => {
    texture.needsUpdate = true;
};
image.src = "../../assets/textures/color.jpg";
let scene, camera, renderer, cube, animationFrameId;

const initThree = () => {
    if (!containerRef.value) return;

    // 1. Create Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c101b");

    // 2. Create Camera
    camera = new THREE.PerspectiveCamera(
        75,
        containerRef.value.clientWidth / containerRef.value.clientHeight,
        0.1,
        1000,
    );
    camera.position.z = 3;

    // 3. Create Renderer with Antialiasing
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.value.appendChild(renderer.domElement);

    // 4. Add a Mesh (Spinning Wireframe Cube)
    const geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    const material = new THREE.MeshBasicMaterial({
        // color: 0x00f2fe,
        map: texture,
        wireframe: true,
    });
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    // 5. Animation Loop
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        // Rotate cube
        cube.rotation.x += 0.01;
        cube.rotation.y += 0.01;

        renderer.render(scene, camera);
    };
    animate();

    // 6. Handle resizing
    window.addEventListener("resize", handleResize);
};

const handleResize = () => {
    if (!containerRef.value || !renderer || !camera) return;
    const width = containerRef.value.clientWidth;
    const height = containerRef.value.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
};

onMounted(() => {
    initThree();
});

onUnmounted(() => {
    // 1. Clean up Event Listeners
    window.removeEventListener("resize", handleResize);

    // 2. Cancel Animation Loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // 3. Clean up Geometries and Materials (Memory management)
    if (cube) {
        cube.geometry.dispose();
        cube.material.dispose();
    }

    // 4. Dispose WebGL Renderer and DOM node
    if (renderer) {
        renderer.dispose();
        renderer.domElement?.parentNode?.removeChild(renderer.domElement);
    }
});
</script>

<style scoped>
.demo-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.canvas-container {
    width: 100%;
    height: 100%;
    z-index: 1;
}

.demo-tag {
    position: absolute;
    top: 1.5rem;
    left: 1.5rem;
    z-index: 10;
    background: rgba(13, 20, 35, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--primary-color);
    letter-spacing: 0.05em;
    pointer-events: none;
}
</style>
