<template>
    <div class="demo-container">
        <div class="demo-tag">Demo 02: Orbit Controls & Lights</div>
        <div ref="containerRef" class="canvas-container"></div>
    </div>
</template>

<script setup>
import gsap from "gsap";
import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

import { onMounted, onUnmounted, ref } from "vue";

const containerRef = ref(null);
let scene,
    camera,
    renderer,
    controls,
    sphere,
    gridHelper,
    directionalLight,
    gui,
    animationFrameId;

const initThree = () => {
    if (!containerRef.value) return;

    // 1. Create Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c101b");

    // 2. Create Camera
    camera = new THREE.PerspectiveCamera(
        75, // 视野
        containerRef.value.clientWidth / containerRef.value.clientHeight, // 屏幕比例
        0.1, // 近截面
        1000, // 远截面
    );

    // camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

    camera.position.set(0.7, 3, 5);

    // 3. Create Renderer with Shadows
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    containerRef.value.appendChild(renderer.domElement);

    // 4. Add Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 5. Add Grid Helper
    gridHelper = new THREE.GridHelper(10, 10, 0x00f2fe, 0x24334c);
    scene.add(gridHelper);

    // 6. Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(5, 5, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // 7. Add a Mesh (Sphere with Standard Material)
    // const geometry = new THREE.SphereGeometry(1, 32, 32);
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({
        color: 0x7c3aed,
        roughness: 0.2,
        metalness: 0.8,
    });
    sphere = new THREE.Mesh(geometry, material);
    // sphere.position.y = 4;
    // sphere.position.x = 4;
    sphere.castShadow = true;
    scene.add(sphere);
    console.log(sphere.position.distanceTo(camera.position));

    gsap.to(sphere.position, {
        x: 0,
        y: 1,
        z: 0,
        duration: 1,
    });

    // 8. Add GUI Debug panel
    gui = new GUI();
    gui.title("Nice debug UI");

    // Cube position controls
    const cubeFolder = gui.addFolder("立方体位置");
    cubeFolder.add(sphere.position, "x", -5, 5, 0.01).name("X 轴");
    cubeFolder.add(sphere.position, "y", 0, 5, 0.01).name("Y 轴");
    cubeFolder.add(sphere.position, "z", -5, 5, 0.01).name("Z 轴");

    // Material controls
    const materialFolder = gui.addFolder("材质属性");
    materialFolder.add(material, "wireframe").name("网格化");
    materialFolder.add(material, "roughness", 0, 1, 0.01).name("粗糙度");
    materialFolder.add(material, "metalness", 0, 1, 0.01).name("金属度");
    materialFolder.addColor(material, "color").name("颜色");

    cubeFolder.open();
    materialFolder.open();

    // 8. Animation Loop
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        // Update controls (required if enableDamping or autoRotate is enabled)
        controls.update();

        // Rotate sphere mesh
        sphere.rotation.y += 0.005;

        renderer.render(scene, camera);
    };
    animate();

    // 9. Handle resizing
    window.addEventListener("resize", handleResize);
    window.addEventListener("dblclick", fullScreen);
    window.addEventListener("keydown", (e) => {
        if (e.key === "h") {
            gui.show(gui._hidden);
        }
    });
};

const handleResize = () => {
    if (!containerRef.value || !renderer || !camera) return;
    const width = containerRef.value.clientWidth;
    const height = containerRef.value.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
};

const fullScreen = () => {
    if (containerRef.value.requestFullscreen) {
        containerRef.value.requestFullscreen();
    } else if (containerRef.value.mozRequestFullScreen) {
        containerRef.value.mozRequestFullScreen();
    } else if (containerRef.value.webkitRequestFullscreen) {
        containerRef.value.webkitRequestFullscreen();
    } else if (containerRef.value.msRequestFullscreen) {
        containerRef.value.msRequestFullscreen();
    }
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

    // 3. Clean up Controls
    if (controls) {
        controls.dispose();
    }

    // 4. Clean up Geometries and Materials
    if (sphere) {
        sphere.geometry.dispose();
        sphere.material.dispose();
    }
    if (gridHelper) {
        gridHelper.geometry.dispose();
        if (Array.isArray(gridHelper.material)) {
            gridHelper.material.forEach((mat) => {
                mat.dispose();
            });
        } else {
            gridHelper.material.dispose();
        }
    }

    // 5. Dispose WebGL Renderer and DOM node
    if (renderer) {
        renderer.dispose();
        renderer.domElement?.parentNode?.removeChild(renderer.domElement);
    }

    // 6. Destroy GUI panel
    if (gui) {
        gui.destroy();
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
