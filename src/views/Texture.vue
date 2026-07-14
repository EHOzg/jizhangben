<template>
    <div class="demo-container">
        <div class="demo-tag">
            Demo 03: Loading Manager & PBR Textures (加载管理器与 PBR 纹理)
        </div>

        <!-- Loading progress screen -->
        <div v-if="isLoading" class="loading-overlay">
            <div class="loading-card">
                <div class="loading-title">正在载入 3D 材质...</div>
                <div class="progress-bar-container">
                    <div
                        class="progress-bar-fill"
                        :style="{ width: progressPercent + '%' }"
                    ></div>
                </div>
                <div class="progress-details">
                    <span>文件: {{ loadedItems }} / {{ totalItems }}</span>
                    <span>进度: {{ progressPercent }}%</span>
                </div>
            </div>
        </div>

        <div ref="containerRef" class="canvas-container"></div>
    </div>
</template>

<script setup>
import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { onMounted, onUnmounted, ref } from "vue";

// Import all PBR door texture images.
// This is standard in Vite to map local assets to bundle hash files correctly.
import doorAlphaImg from "../assets/textures/door/alpha.jpg";
import doorAmbientOcclusionImg from "../assets/textures/door/ambientOcclusion.jpg";
import doorColorImg from "../assets/textures/door/color.jpg";
import doorHeightImg from "../assets/textures/door/height.jpg";
import doorMetalnessImg from "../assets/textures/door/metalness.jpg";
import doorNormalImg from "../assets/textures/door/normal.jpg";
import doorRoughnessImg from "../assets/textures/door/roughness.jpg";

// Loading state variables for Vue template UI overlay
const isLoading = ref(true);
const progressPercent = ref(0);
const loadedItems = ref(0);
const totalItems = ref(0);

const containerRef = ref(null);
let scene,
    camera,
    renderer,
    controls,
    door,
    ambientLight,
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
        75,
        containerRef.value.clientWidth / containerRef.value.clientHeight,
        0.1,
        1000,
    );
    camera.position.set(2, 2, 4);

    // 3. Create Renderer
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

    // 5. Setup Loading Manager
    const loadingManager = new THREE.LoadingManager(
        // onLoad
        () => {
            isLoading.value = false;
        },
        // onProgress
        (url, itemsLoaded, itemsTotal) => {
            loadedItems.value = itemsLoaded;
            totalItems.value = itemsTotal;
            progressPercent.value = Math.round(
                (itemsLoaded / itemsTotal) * 100,
            );
            console.log(
                "🚀 ~ initThree ~ progressPercent.value:",
                progressPercent.value,
            );
        },
        // onError
        (url) => {
            console.error(`Error loading texture: ${url}`);
        },
    );

    // 6. Load all textures using the Loading Manager
    const textureLoader = new THREE.TextureLoader(loadingManager);

    const colorTexture = textureLoader.load(doorColorImg);
    const alphaTexture = textureLoader.load(doorAlphaImg);
    const aoTexture = textureLoader.load(doorAmbientOcclusionImg);
    const heightTexture = textureLoader.load(doorHeightImg);
    const normalTexture = textureLoader.load(doorNormalImg);
    const metalnessTexture = textureLoader.load(doorMetalnessImg);
    const roughnessTexture = textureLoader.load(doorRoughnessImg);

    // Optional: Set texture color space for standard mapping
    colorTexture.colorSpace = THREE.SRGBColorSpace;

    // 7. Add Lights (PBR standard materials require lighting to compute reflections, roughness, shadows)
    ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(3, 4, 3);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // 8. Add Door Mesh with PBR materials
    // Subdivide the BoxGeometry face segments so displacementMap (height map) works properly.
    const geometry = new THREE.BoxGeometry(1.6, 3, 0.05, 100, 100, 1);

    // Ambient Occlusion (aoMap) requires a second set of UV coords in Three.js standard shaders.
    // We duplicate the standard UV attribute to a new attribute 'uv2'.
    geometry.setAttribute(
        "uv2",
        new THREE.Float32BufferAttribute(geometry.attributes.uv.array, 2),
    );

    const material = new THREE.MeshStandardMaterial({
        map: colorTexture,
        alphaMap: alphaTexture,
        transparent: true,
        aoMap: aoTexture,
        aoMapIntensity: 1.0,
        displacementMap: heightTexture, // 位移贴图
        displacementScale: 0.05, // controls how deep the bump effect goes
        normalMap: normalTexture, // 法线贴图
        metalnessMap: metalnessTexture, // 金属贴图
        roughnessMap: roughnessTexture, // 粗糙度贴图
    });

    door = new THREE.Mesh(geometry, material);
    door.castShadow = true;
    scene.add(door);

    // 9. Add GUI debug controls
    gui = new GUI();
    gui.title("PBR 材质调试面板");

    const materialFolder = gui.addFolder("材质参数");
    materialFolder.add(material, "wireframe").name("网格化");
    materialFolder
        .add(material, "aoMapIntensity", 0, 3, 0.1)
        .name("AO 环境遮挡强度");
    materialFolder
        .add(material, "displacementScale", 0, 0.2, 0.01)
        .name("置换深度位移");
    materialFolder.add(material, "metalness", 0, 1, 0.01).name("基础金属度");
    materialFolder.add(material, "roughness", 0, 1, 0.01).name("基础粗糙度");
    materialFolder.addColor(material, "color").name("颜色叠加");

    const textureFolder = gui.addFolder("纹理变换");
    const texturesToWrap = [
        colorTexture,
        alphaTexture,
        aoTexture,
        heightTexture,
        normalTexture,
        metalnessTexture,
        roughnessTexture,
    ];

    // Configure wrap repeating on all textures
    texturesToWrap.forEach((tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
    });

    textureFolder
        .add(colorTexture.repeat, "x", 1, 5, 1)
        .name("水平重复")
        .onChange((val) => {
            texturesToWrap.forEach((tex) => {
                tex.repeat.x = val;
                tex.needsUpdate = true;
            });
        });
    textureFolder
        .add(colorTexture.repeat, "y", 1, 5, 1)
        .name("垂直重复")
        .onChange((val) => {
            texturesToWrap.forEach((tex) => {
                tex.repeat.y = val;
                tex.needsUpdate = true;
            });
        });
    // textureFolder
    //     .add(colorTexture.rotation, "x", 0, Math.PI * 2, 0.1)
    //     .name("X轴旋转")
    //     .onChange((val) => {
    //         texturesToWrap.forEach((tex) => {
    //             tex.rotation.x = val;
    //             tex.needsUpdate = true;
    //         });
    //     });
    // textureFolder
    //     .add(colorTexture.rotation, "y", 0, Math.PI * 2, 0.1)
    //     .name("Y轴旋转")
    //     .onChange((val) => {
    //         texturesToWrap.forEach((tex) => {
    //             tex.rotation.y = val;
    //             tex.needsUpdate = true;
    //         });
    //     });

    materialFolder.open();

    // 10. Animation Loop
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        // Update controls
        controls.update();

        renderer.render(scene, camera);
    };
    animate();

    // 11. Handle resizing
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

    // 3. Clean up Controls
    if (controls) {
        controls.dispose();
    }

    // 4. Clean up GUI
    if (gui) {
        gui.destroy();
    }

    // 5. Clean up Geometries, Materials, and Textures
    if (door) {
        door.geometry.dispose();
        const maps = [
            door.material.map,
            door.material.alphaMap,
            door.material.aoMap,
            door.material.displacementMap,
            door.material.normalMap,
            door.material.metalnessMap,
            door.material.roughnessMap,
        ];
        maps.forEach((m) => {
            if (m) m.dispose();
        });
        door.material.dispose();
    }

    // 6. Dispose WebGL Renderer and DOM node
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

/* Loading Overlay Styles */
.loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    background: #080c14;
    display: flex;
    justify-content: center;
    align-items: center;
}

.loading-card {
    width: 320px;
    background: rgba(13, 20, 35, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
    padding: 2rem;
    backdrop-filter: blur(10px);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    text-align: center;
}

.loading-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 1.5rem;
}

.progress-bar-container {
    height: 6px;
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
    overflow: hidden;
    margin-bottom: 1rem;
}

.progress-bar-fill {
    height: 100%;
    background: var(--primary-gradient);
    border-radius: 3px;
    width: 0%;
    transition: width 0.2s ease-out;
}

.progress-details {
    display: flex;
    justify-content: space-between;
    font-size: 0.8rem;
    color: var(--text-muted);
}
</style>
