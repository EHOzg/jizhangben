<template>
    <div class="demo-container">
        <div class="demo-tag">Demo 10: Baked & Fake Shadows (烘焙与虚假阴影)</div>
        <div ref="containerRef" class="canvas-container"></div>
        
        <div class="info-card">
            <h3>🎨 烘焙与贴图阴影演示</h3>
            <p>
                <strong>当前阴影模式:</strong>
                <span class="tag shadow-mode-tag">{{ shadowModeLabel }}</span>
            </p>
            <div class="divider"></div>
            
            <div class="comparison-details">
                <div v-if="params.shadowMode === 'realtime'" class="mode-desc">
                    <p class="highlight-title">⚡ 模式：实时阴影 (Real-time)</p>
                    <p>利用 GPU 实时渲染光源深度图 (Shadow Map)。光源移动或物体跳动时阴影能完美跟随，但由于精度限制，边缘可能出现锯齿或条纹，且对 GPU 开销最大。</p>
                </div>
                <div v-else-if="params.shadowMode === 'baked-dynamic'" class="mode-desc">
                    <p class="highlight-title">🍃 模式：虚假接触阴影 (Fake Contact)</p>
                    <p>关闭 GPU 实时投影计算，只在物体下方放置带渐变阴影贴图的平面。当物体上下浮动时，用 JS 实时调控影子的不透明度和缩放。性能极佳，适用于移动端动态物体。</p>
                </div>
                <div v-else-if="params.shadowMode === 'baked-static'" class="mode-desc">
                    <p class="highlight-title">🏛️ 模式：静态光照贴图 (Lightmap)</p>
                    <p>完全关闭实时阴影。整个地面的光照和所有静态物体的投影被预先“烘焙”在一张贴图上（通过 Canvas 动态生成）。可以看到方块和圆柱底部的细腻软环境光遮蔽 (AO)，GPU 开销为 0。</p>
                </div>
            </div>
            
            <div class="divider"></div>
            <p class="tip">
                💡 提示：在右上角 GUI 控制面板中切换不同的模式，并开启“显示接触阴影平面”辅助框来一探究竟！
            </p>
        </div>
    </div>
</template>

<script setup>
import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { onMounted, onUnmounted, ref, computed } from "vue";

const containerRef = ref(null);
let scene, camera, renderer, controls, gui, animationFrameId;

// Meshes & Lights references
const meshes = {};
const lights = {};
let shadowPlaneHelper = null;

// Texture references
let fakeShadowTexture = null;
let bakedFloorTexture = null;

// State management
const params = {
    shadowMode: "baked-dynamic", // 'realtime' | 'baked-dynamic' | 'baked-static'
    bounceSpeed: 1.8,
    enableAnimation: true,
    showShadowHelper: false,
    lightIntensity: 1.0,
    lightColor: "#ffffff",
};

const shadowModeLabel = computed(() => {
    if (params.shadowMode === "realtime") return "实时深度阴影 (GPU 负载高)";
    if (params.shadowMode === "baked-dynamic") return "动态虚假阴影 (高性能/动态)";
    if (params.shadowMode === "baked-static") return "静态光照贴图 (零开销/极致细腻)";
    return "Unknown";
});

// --- Dynamic Canvas Textures Generation ---

// 1. Create a simple round soft gradient shadow (for the floating sphere)
const createFakeShadowTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");

    // Clear background to transparent
    ctx.clearRect(0, 0, 128, 128);

    // Radial gradient: dark center decaying to fully transparent
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, "rgba(7, 9, 15, 0.85)");
    gradient.addColorStop(0.2, "rgba(7, 9, 15, 0.6)");
    gradient.addColorStop(0.5, "rgba(7, 9, 15, 0.25)");
    gradient.addColorStop(0.8, "rgba(7, 9, 15, 0.05)");
    gradient.addColorStop(1, "rgba(7, 9, 15, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
};

// 2. Create a fully baked floor texture simulating complex scene GI/AO shadows (for Static Lightmap mode)
const createBakedFloorTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Base concrete floor color
    ctx.fillStyle = "#dddddd";
    ctx.fillRect(0, 0, 512, 512);

    // Center Sphere occlusion (Large soft circular shadow)
    let grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 95);
    grad.addColorStop(0, "rgba(7, 9, 15, 0.65)");
    grad.addColorStop(0.3, "rgba(7, 9, 15, 0.4)");
    grad.addColorStop(0.7, "rgba(7, 9, 15, 0.15)");
    grad.addColorStop(1, "rgba(7, 9, 15, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(256, 256, 95, 0, Math.PI * 2);
    ctx.fill();

    // Left Cube soft shadow (Rotated blurred rectangle)
    // We draw multiple overlapping translucent shapes to mimic diffuse light soft shadowing
    ctx.save();
    ctx.translate(120, 256);
    ctx.rotate(Math.PI / 6); // slight rotation angle
    for (let i = 1; i <= 25; i++) {
        const size = 45 + i * 3.5;
        const opacity = (1 - i / 25) * 0.08;
        ctx.fillStyle = `rgba(7, 9, 15, ${opacity})`;
        ctx.fillRect(-size / 2, -size / 2, size, size);
    }
    ctx.restore();

    // Right Cylinder soft shadow (Stretched vertical blur ellipse)
    ctx.save();
    ctx.translate(380, 256);
    for (let i = 1; i <= 25; i++) {
        const w = 35 + i * 3;
        const h = 70 + i * 4.5;
        const opacity = (1 - i / 25) * 0.07;
        ctx.fillStyle = `rgba(7, 9, 15, ${opacity})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, w / 2, h / 2, -Math.PI / 12, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
};

// Sync options depending on chosen mode
const updateShadowMode = () => {
    const mode = params.shadowMode;

    if (mode === "realtime") {
        // Mode 1: Enable live shadows
        renderer.shadowMap.enabled = true;
        lights.dir.castShadow = true;

        meshes.floor.receiveShadow = true;
        meshes.sphere.castShadow = true;
        meshes.cube.castShadow = true;
        meshes.cylinder.castShadow = true;

        // Hide helper & fake dynamic shadow planes
        meshes.ballShadow.visible = false;
        if (shadowPlaneHelper) shadowPlaneHelper.visible = false;

        // Reset floor material lightmap
        meshes.floor.material.lightMap = null;
        meshes.floor.material.needsUpdate = true;
    } 
    else if (mode === "baked-dynamic") {
        // Mode 2: Contact/Fake Shadow
        renderer.shadowMap.enabled = false;
        lights.dir.castShadow = false;

        meshes.floor.receiveShadow = false;
        meshes.sphere.castShadow = false;
        meshes.cube.castShadow = false;
        meshes.cylinder.castShadow = false;

        // Show the fake dynamic shadow plane
        meshes.ballShadow.visible = true;
        if (shadowPlaneHelper) shadowPlaneHelper.visible = params.showShadowHelper;

        // Reset floor lightmap
        meshes.floor.material.lightMap = null;
        meshes.floor.material.needsUpdate = true;
    } 
    else if (mode === "baked-static") {
        // Mode 3: Static Pre-baked Lightmap
        renderer.shadowMap.enabled = false;
        lights.dir.castShadow = false;

        meshes.floor.receiveShadow = false;
        meshes.sphere.castShadow = false;
        meshes.cube.castShadow = false;
        meshes.cylinder.castShadow = false;

        // Hide fake dynamic shadow plane
        meshes.ballShadow.visible = false;
        if (shadowPlaneHelper) shadowPlaneHelper.visible = false;

        // Apply pre-baked texture to lightmap slot
        meshes.floor.material.lightMap = bakedFloorTexture;
        meshes.floor.material.lightMapIntensity = 1.0;
        meshes.floor.material.needsUpdate = true;
    }

    // Force materials update to clear/apply depth maps
    scene.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material.needsUpdate = true;
        }
    });
};

const initThree = () => {
    if (!containerRef.value) return;

    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#0b0c10");

    // 2. Camera
    camera = new THREE.PerspectiveCamera(
        45,
        containerRef.value.clientWidth / containerRef.value.clientHeight,
        0.1,
        100,
    );
    camera.position.set(0, 4, 8);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    containerRef.value.appendChild(renderer.domElement);

    // 4. Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // restrict camera below ground

    // 5. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    lights.dir = new THREE.DirectionalLight(params.lightColor, params.lightIntensity);
    lights.dir.position.set(3, 6, 2);
    // Narrow shadow box to increase resolution
    lights.dir.shadow.camera.left = -4;
    lights.dir.shadow.camera.right = 4;
    lights.dir.shadow.camera.top = 4;
    lights.dir.shadow.camera.bottom = -4;
    lights.dir.shadow.camera.near = 0.5;
    lights.dir.shadow.camera.far = 15;
    lights.dir.shadow.mapSize.set(1024, 1024);
    scene.add(lights.dir);

    // 6. Textures
    fakeShadowTexture = createFakeShadowTexture();
    bakedFloorTexture = createBakedFloorTexture();

    // 7. Floor Mesh
    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        roughness: 0.65,
        metalness: 0.1,
    });
    const floorGeo = new THREE.PlaneGeometry(12, 12);
    const floor = new THREE.Mesh(floorGeo, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.0;
    scene.add(floor);
    meshes.floor = floor;

    // Explicitly set second set of UV coordinates for mapping lightmaps correctly in Three.js
    floor.geometry.setAttribute(
        "uv2",
        new THREE.BufferAttribute(floor.geometry.attributes.uv.array, 2)
    );

    // 8. Dynamic Ball Shadow Mesh (Overlay Plane for contact shadow mode)
    const shadowMat = new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        alphaMap: fakeShadowTexture,
        depthWrite: false, // Prevents artifact lines/clipping
        blending: THREE.MultiplyBlending, // Nice alpha blend blending
    });
    const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const ballShadow = new THREE.Mesh(shadowGeo, shadowMat);
    ballShadow.rotation.x = -Math.PI / 2;
    // Hovering extremely close to floor (y = -0.99) to avoid z-fighting
    ballShadow.position.set(0, -0.99, 0); 
    scene.add(ballShadow);
    meshes.ballShadow = ballShadow;

    // Helper lines to show the bounds of the contact shadow mesh
    shadowPlaneHelper = new THREE.BoxHelper(ballShadow, 0xf43f5e);
    shadowPlaneHelper.visible = false;
    scene.add(shadowPlaneHelper);

    // 9. Floating Showcase meshes
    const material = new THREE.MeshStandardMaterial({
        color: 0x64748b, // slate
        roughness: 0.4,
        metalness: 0.2,
    });

    // 9.1 Centered Sphere
    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
    meshes.sphere = new THREE.Mesh(sphereGeo, material);
    meshes.sphere.position.set(0, 0.2, 0);
    scene.add(meshes.sphere);

    // 9.2 Cube (Left)
    const cubeGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    meshes.cube = new THREE.Mesh(cubeGeo, material);
    meshes.cube.position.set(-2.0, -0.6, 0.0);
    scene.add(meshes.cube);

    // 9.3 Cylinder (Right)
    const cylinderGeo = new THREE.CylinderGeometry(0.3, 0.3, 1.0, 32);
    meshes.cylinder = new THREE.Mesh(cylinderGeo, material);
    meshes.cylinder.position.set(2.0, -0.5, 0.0);
    scene.add(meshes.cylinder);

    // Apply init state
    updateShadowMode();

    // 10. Animation Loop
    const clock = new THREE.Clock();

    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        const elapsedTime = clock.getElapsedTime();

        // 10.1 Rotate meshes
        if (params.enableAnimation) {
            meshes.cube.rotation.x = elapsedTime * 0.15;
            meshes.cube.rotation.y = elapsedTime * 0.25;
            meshes.cylinder.rotation.x = elapsedTime * 0.1;
            meshes.cylinder.rotation.y = elapsedTime * 0.2;
        }

        // 10.2 Animate sphere & shadow depending on modes
        if (params.shadowMode === "realtime" || params.shadowMode === "baked-dynamic") {
            // Sphere bounces up and down
            const bounce = Math.abs(Math.sin(elapsedTime * params.bounceSpeed)); // range 0 to 1
            const sphereY = -0.5 + bounce * 1.5; // range -0.5 to 1.0
            
            meshes.sphere.position.y = sphereY;

            // In dynamic fake shadow mode, we map the sphere's height to the shadow scale and opacity
            if (params.shadowMode === "baked-dynamic") {
                // Closer to ground (bounce -> 0) means darker shadow (opacity -> 0.8) and smaller shadow scale
                const heightFraction = bounce; // 0 (on ground) to 1 (high up)
                
                // Shadow scale goes from 0.8 (sharp, small shadow) to 1.6 (broad, blurry shadow)
                const shadowScale = 0.8 + heightFraction * 0.8;
                meshes.ballShadow.scale.set(shadowScale, shadowScale, 1);
                
                // Shadow opacity goes from 0.85 (dark shadow close to sphere) to 0.15 (faded shadow far away)
                meshes.ballShadow.material.opacity = 0.85 - heightFraction * 0.7;
            }
        } else {
            // In static baked mode, we keep everything at default resting positions to match the pre-baked floor shadows
            meshes.sphere.position.y = -0.5; // resting state in baked lightmap
            meshes.cube.rotation.set(0, Math.PI / 6, 0); // match baked angle
            meshes.cylinder.rotation.set(-Math.PI / 12, 0, 0); // match baked angle
        }

        // Sync helper box
        if (params.showShadowHelper && meshes.ballShadow.visible) {
            shadowPlaneHelper.update();
        }

        controls.update();
        renderer.render(scene, camera);
    };

    animate();

    window.addEventListener("resize", handleResize);
    initGUI();
};

const initGUI = () => {
    gui = new GUI();
    gui.title("烘焙与贴图阴影精细调控");

    gui.add(params, "shadowMode", {
        "1. 实时深度阴影 (Real-time ShadowMap)": "realtime",
        "2. 动态接触阴影 (Fake Contact Shadow)": "baked-dynamic",
        "3. 静态光照贴图 (Static Lightmap)": "baked-static",
    })
    .name("渲染阴影方案")
    .onChange(updateShadowMode);

    const animFolder = gui.addFolder("场景动作调节");
    animFolder.add(params, "enableAnimation").name("启用物体自转");
    animFolder.add(params, "bounceSpeed", 0.5, 4.0, 0.1).name("小球弹跳速度");

    const bakedFolder = gui.addFolder("烘焙/贴图模式选项");
    bakedFolder.add(params, "showShadowHelper")
        .name("显示接触阴影平面")
        .onChange((val) => {
            if (shadowPlaneHelper) shadowPlaneHelper.visible = val && params.shadowMode === "baked-dynamic";
        });

    const lightFolder = gui.addFolder("物理光源设置 (仅对实时阴影生效)");
    lightFolder.addColor(params, "lightColor").name("光源颜色").onChange((val) => {
        lights.dir.color.set(val);
    });
    lightFolder.add(params, "lightIntensity", 0.0, 3.0, 0.1).name("光源强度").onChange((val) => {
        lights.dir.intensity = val;
    });

    bakedFolder.open();
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
    window.removeEventListener("resize", handleResize);

    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    if (controls) {
        controls.dispose();
    }

    if (gui) {
        gui.destroy();
    }

    // Clean up textures
    if (fakeShadowTexture) fakeShadowTexture.dispose();
    if (bakedFloorTexture) bakedFloorTexture.dispose();

    // Clean up meshes
    Object.values(meshes).forEach((mesh) => {
        if (mesh && mesh.isMesh) {
            scene.remove(mesh);
            if (mesh.geometry) mesh.geometry.dispose();
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((m) => m.dispose());
                } else {
                    mesh.material.dispose();
                }
            }
        }
    });

    if (shadowPlaneHelper) {
        scene.remove(shadowPlaneHelper);
        shadowPlaneHelper.dispose();
    }

    Object.values(lights).forEach((light) => {
        scene.remove(light);
    });

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
    background: rgba(15, 17, 23, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    font-size: 0.9rem;
    font-weight: 600;
    color: #e11d48; /* Crimson red */
    letter-spacing: 0.05em;
    pointer-events: none;
}

.info-card {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    z-index: 10;
    max-width: 400px;
    background: rgba(15, 17, 23, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 1.5rem;
    border-radius: 12px;
    backdrop-filter: blur(20px);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    color: #f8fafc;
    pointer-events: auto;
}

.info-card h3 {
    margin-bottom: 0.8rem;
    font-size: 1.15rem;
    color: #e11d48;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.info-card p {
    font-size: 0.85rem;
    margin-bottom: 0.6rem;
    color: #e2e8f0;
    line-height: 1.55;
}

.tag {
    font-size: 0.75rem;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: rgba(225, 29, 72, 0.15);
    color: #f43f5e;
    margin-left: 0.5rem;
    font-weight: 500;
}

.divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0.8rem 0;
}

.comparison-details {
    min-height: 110px;
}

.highlight-title {
    color: #fda4af !important;
    font-weight: 600;
    margin-bottom: 0.4rem;
}

.tip {
    color: #fda4af !important;
    font-weight: 500;
    margin-top: 0.4rem;
}
</style>
