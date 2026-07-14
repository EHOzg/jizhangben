<template>
    <div class="demo-container">
        <div class="demo-tag">Demo 09: Shadows Sandbox (阴影物理调试沙盒)</div>
        <div ref="containerRef" class="canvas-container"></div>
        <div class="info-card">
            <h3>👥 3D 空间阴影调试</h3>
            <p>
                <strong>当前算法:</strong>
                <span class="tag">{{ shadowMapTypeLabel }}</span>
            </p>
            <p>
                <strong>精密参数:</strong> Bias (偏置) & Normal Bias (法线偏置)
            </p>
            <div class="divider"></div>
            <p class="description">
                <strong>Shadow Acne (阴影条纹)</strong
                >：由于深度图精度限制，物体表面自影产生的条纹。滑动“法线偏置”可有效清除条纹。<br />
                <strong>Peter Panning (阴影飘移)</strong
                >：偏置过大导致阴影与脚部脱离。微调 Bias 与 Normal Bias
                可在两者间取得完美平衡。
            </p>
            <p class="tip">
                💡 提示：开启“显示阴影视锥相机”，可直观看到光线的裁剪框范围！
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

// Lights & Helpers
const lights = {};
const cameraHelpers = {};
const meshes = {};

// Shadow map type reverse lookup for the info card
const shadowMapTypeLabel = computed(() => {
    if (!params) return "PCFSoft";
    const type = params.shadowMapType;
    if (type === THREE.BasicShadowMap) return "Basic (硬阴影)";
    if (type === THREE.PCFShadowMap) return "PCF (平滑边缘)";
    if (type === THREE.PCFSoftShadowMap) return "PCFSoft (柔和插值)";
    if (type === THREE.VSMShadowMap) return "VSM (方差软阴影)";
    return "Unknown";
});

// UI Params State
const params = {
    // Light Source Switch
    activeLight: "directional", // "directional" or "spot"

    // Global shadow map algorithm
    shadowMapType: THREE.PCFSoftShadowMap,

    // Animation toggles
    enableAnimation: true,
    lightOrbit: true,
    showCameraHelper: true,

    // Precision parameters
    bias: -0.0005,
    normalBias: 0.02,
    radius: 4, // PCF blur radius
    mapSize: 1024, // texture resolution

    // Light specific config
    dirIntensity: 1.0,
    dirColor: "#ffffff",
    dirX: 3.0,
    dirY: 5.0,
    dirZ: 2.0,

    spotIntensity: 8.0,
    spotColor: "#00e5ff", // Neon Cyan
    spotAngle: 0.5, // ~30 deg
    spotPenumbra: 0.6,
    spotDecay: 1.2,
    spotX: 0.0,
    spotY: 6.0,
    spotZ: 3.0,
};

// Reusable function to synchronize GUI parameters to lights and helpers
const updateShadowConfig = () => {
    // Active lights toggles
    const isDir = params.activeLight === "directional";

    lights.dir.visible = isDir;
    lights.spot.visible = !isDir;

    // Toggle camera helper visibility
    if (cameraHelpers.dir)
        cameraHelpers.dir.visible = isDir && params.showCameraHelper;
    if (cameraHelpers.spot)
        cameraHelpers.spot.visible = !isDir && params.showCameraHelper;

    // Apply shared shadow properties to active light
    const activeLight = isDir ? lights.dir : lights.spot;

    activeLight.shadow.bias = params.bias;
    activeLight.shadow.normalBias = params.normalBias;
    activeLight.shadow.radius = params.radius;

    // MapSize changes require rebuilding the render target depth texture in Three.js
    if (activeLight.shadow.mapSize.x !== params.mapSize) {
        activeLight.shadow.mapSize.set(params.mapSize, params.mapSize);
        if (activeLight.shadow.map) {
            activeLight.shadow.map.dispose();
            activeLight.shadow.map = null;
        }
    }

    // Directional specific
    lights.dir.intensity = params.dirIntensity;
    lights.dir.color.set(params.dirColor);
    if (!params.enableAnimation || !params.lightOrbit) {
        lights.dir.position.set(params.dirX, params.dirY, params.dirZ);
    }

    // Spot specific
    lights.spot.intensity = params.spotIntensity;
    lights.spot.color.set(params.spotColor);
    lights.spot.angle = params.spotAngle;
    lights.spot.penumbra = params.spotPenumbra;
    lights.spot.decay = params.spotDecay;
    if (!params.enableAnimation || !params.lightOrbit) {
        lights.spot.position.set(params.spotX, params.spotY, params.spotZ);
    }

    // Force material recompilation if shadow map algorithm type changed
    if (renderer.shadowMap.type !== params.shadowMapType) {
        renderer.shadowMap.type = params.shadowMapType;
        scene.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.needsUpdate = true;
            }
        });
    }
};

const initThree = () => {
    if (!containerRef.value) return;

    // 1. Create Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#0b0c10");

    // 2. Create Camera
    camera = new THREE.PerspectiveCamera(
        45,
        containerRef.value.clientWidth / containerRef.value.clientHeight,
        0.1,
        100,
    );
    camera.position.set(0, 4, 8);

    // 3. Create WebGL Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = params.shadowMapType;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    containerRef.value.appendChild(renderer.domElement);

    // 4. Add Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera above floor

    // 5. Initialize Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15); // soft base fill
    scene.add(ambientLight);

    // 6. Initialize Directional Light and shadow settings
    lights.dir = new THREE.DirectionalLight(
        params.dirColor,
        params.dirIntensity,
    );
    lights.dir.position.set(params.dirX, params.dirY, params.dirZ);
    lights.dir.castShadow = true;

    // Narrow shadow camera orthographic bounds for high resolution depth precision
    lights.dir.shadow.camera.left = -4.5;
    lights.dir.shadow.camera.right = 4.5;
    lights.dir.shadow.camera.top = 4.5;
    lights.dir.shadow.camera.bottom = -4.5;
    lights.dir.shadow.camera.near = 0.5;
    lights.dir.shadow.camera.far = 15;
    lights.dir.shadow.mapSize.set(params.mapSize, params.mapSize);
    scene.add(lights.dir);

    cameraHelpers.dir = new THREE.CameraHelper(lights.dir.shadow.camera);
    scene.add(cameraHelpers.dir);

    // 7. Initialize Spot Light and shadow settings
    lights.spot = new THREE.SpotLight(params.spotColor, params.spotIntensity);
    lights.spot.position.set(params.spotX, params.spotY, params.spotZ);
    lights.spot.castShadow = true;
    lights.spot.shadow.camera.near = 0.5;
    lights.spot.shadow.camera.far = 15;
    lights.spot.shadow.camera.fov = 40;
    lights.spot.shadow.mapSize.set(params.mapSize, params.mapSize);
    scene.add(lights.spot);

    cameraHelpers.spot = new THREE.CameraHelper(lights.spot.shadow.camera);
    scene.add(cameraHelpers.spot);

    // 8. Build Showcase Studio Geometries
    // Using a light gray concrete-like matte material
    const shadowReceiverMat = new THREE.MeshStandardMaterial({
        color: 0xdddddd,
        roughness: 0.6,
        metalness: 0.1,
    });

    // Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floor = new THREE.Mesh(floorGeo, shadowReceiverMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.0;
    floor.receiveShadow = true;
    scene.add(floor);
    meshes.floor = floor;

    // Back Wall
    const wallGeo = new THREE.PlaneGeometry(30, 15);
    const wall = new THREE.Mesh(wallGeo, shadowReceiverMat);
    wall.position.set(0, 6.5, -6);
    wall.receiveShadow = true;
    scene.add(wall);
    meshes.wall = wall;

    // 9. Build Floating/Casting Geometries
    const objectMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8, // Slate gray
        roughness: 0.5,
        metalness: 0.15,
    });

    // 9.1. Hovering Sphere (Core test object)
    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
    meshes.sphere = new THREE.Mesh(sphereGeo, objectMat);
    meshes.sphere.position.set(0, 0.6, 0);
    meshes.sphere.castShadow = true;
    meshes.sphere.receiveShadow = true;
    scene.add(meshes.sphere);

    // 9.2. Cube
    const cubeGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    meshes.cube = new THREE.Mesh(cubeGeo, objectMat);
    meshes.cube.position.set(-2.0, -0.6, 0.0);
    meshes.cube.castShadow = true;
    meshes.cube.receiveShadow = true;
    scene.add(meshes.cube);

    // 9.3. Cylinder
    const cylinderGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 32);
    meshes.cylinder = new THREE.Mesh(cylinderGeo, objectMat);
    meshes.cylinder.position.set(2.0, -0.4, 0.0);
    meshes.cylinder.castShadow = true;
    meshes.cylinder.receiveShadow = true;
    scene.add(meshes.cylinder);

    // 9.4. Torus Knot
    const knotGeo = new THREE.TorusKnotGeometry(0.25, 0.08, 100, 16);
    meshes.knot = new THREE.Mesh(knotGeo, objectMat);
    meshes.knot.position.set(0.0, -0.55, 2.0);
    meshes.knot.castShadow = true;
    meshes.knot.receiveShadow = true;
    scene.add(meshes.knot);

    // Set SpotLight Target pointing at stand center
    lights.spot.target = meshes.sphere;

    // Apply init states
    updateShadowConfig();

    // 10. Animation Loop
    const clock = new THREE.Clock();

    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        // Standard mesh rotations
        meshes.cube.rotation.x = elapsedTime * 0.15;
        meshes.cube.rotation.y = elapsedTime * 0.2;
        meshes.knot.rotation.x = elapsedTime * 0.25;
        meshes.knot.rotation.y = elapsedTime * 0.2;
        meshes.cylinder.rotation.y = elapsedTime * 0.3;

        // Bouncing / Hovering sphere to demonstrate shadow size and softness change
        if (params.enableAnimation) {
            meshes.sphere.position.y = 0.5 + Math.sin(elapsedTime * 1.5) * 0.8;

            // Orbit lights in circles to demonstrate shadow warp stretching
            if (params.lightOrbit) {
                if (params.activeLight === "directional") {
                    lights.dir.position.x = Math.sin(elapsedTime * 0.8) * 3.5;
                    lights.dir.position.z = Math.cos(elapsedTime * 0.8) * 3.5;
                } else {
                    lights.spot.position.x = Math.sin(elapsedTime * 0.8) * 2.8;
                    lights.spot.position.z =
                        2.0 + Math.cos(elapsedTime * 0.8) * 1.2;
                }
            }
        } else {
            // Restore static positions
            meshes.sphere.position.y = 0.6;
            if (params.activeLight === "directional") {
                lights.dir.position.set(params.dirX, params.dirY, params.dirZ);
            } else {
                lights.spot.position.set(
                    params.spotX,
                    params.spotY,
                    params.spotZ,
                );
            }
        }

        // Always update active helper box representation
        if (params.showCameraHelper) {
            if (params.activeLight === "directional" && cameraHelpers.dir) {
                cameraHelpers.dir.update();
            } else if (params.activeLight === "spot" && cameraHelpers.spot) {
                cameraHelpers.spot.update();
            }
        }

        controls.update();
        renderer.render(scene, camera);
    };
    animate();

    window.addEventListener("resize", handleResize);
    initGUI();
};

// Initialize Debug GUI controls
const initGUI = () => {
    gui = new GUI();
    gui.title("3D 阴影精密调试面板");

    // 1. General Config Folder
    const generalFolder = gui.addFolder("调试模式与场景");
    generalFolder
        .add(params, "activeLight", {
            "太阳平行光 (Directional)": "directional",
            "聚光灯 (Spot)": "spot",
        })
        .name("激活光源")
        .onChange(updateShadowConfig);

    // Shadow algorithms mapping
    const mapTypes = {
        "Basic (硬边锯齿)": THREE.BasicShadowMap,
        "PCF (平滑插值)": THREE.PCFShadowMap,
        "PCFSoft (高质软化)": THREE.PCFSoftShadowMap,
        "VSM (超柔方差)": THREE.VSMShadowMap,
    };
    generalFolder
        .add(params, "shadowMapType", mapTypes)
        .name("阴影过滤算法")
        .onChange(updateShadowConfig);

    generalFolder
        .add(params, "showCameraHelper")
        .name("显示阴影视锥相机")
        .onChange(updateShadowConfig);
    generalFolder.add(params, "enableAnimation").name("启用物体浮动轨迹");
    generalFolder.add(params, "lightOrbit").name("启用光源轨道绕行");

    // 2. Precision parameters Folder
    const precisionFolder = gui.addFolder("阴影精密调优");
    precisionFolder
        .add(params, "bias", -0.01, 0.01, 0.0001)
        .name("阴影偏置 (Bias)")
        .onChange(updateShadowConfig);
    precisionFolder
        .add(params, "normalBias", -0.05, 0.05, 0.001)
        .name("法线偏置 (NormalBias)")
        .onChange(updateShadowConfig);
    precisionFolder
        .add(params, "radius", 1.0, 20.0, 0.5)
        .name("柔化半径 (Radius)")
        .onChange(updateShadowConfig);
    precisionFolder
        .add(params, "mapSize", [256, 512, 1024, 2048])
        .name("深度图分辨率")
        .onChange(updateShadowConfig);

    // 3. Directional Light positional parameters
    const dirFolder = gui.addFolder("太阳光 (Directional) 选项");
    dirFolder
        .addColor(params, "dirColor")
        .name("光源颜色")
        .onChange(updateShadowConfig);
    dirFolder
        .add(params, "dirIntensity", 0.0, 3.0, 0.1)
        .name("光源强度")
        .onChange(updateShadowConfig);
    dirFolder
        .add(params, "dirX", -8.0, 8.0, 0.1)
        .name("位置 X")
        .onChange((v) => {
            lights.dir.position.x = v;
            updateShadowConfig();
        });
    dirFolder
        .add(params, "dirY", 2.0, 10.0, 0.1)
        .name("位置 Y")
        .onChange((v) => {
            lights.dir.position.y = v;
            updateShadowConfig();
        });
    dirFolder
        .add(params, "dirZ", -8.0, 8.0, 0.1)
        .name("位置 Z")
        .onChange((v) => {
            lights.dir.position.z = v;
            updateShadowConfig();
        });
    dirFolder.close();

    // 4. Spot Light positional & cone parameters
    const spotFolder = gui.addFolder("聚光灯 (Spot) 选项");
    spotFolder
        .addColor(params, "spotColor")
        .name("光源颜色")
        .onChange(updateShadowConfig);
    spotFolder
        .add(params, "spotIntensity", 0.0, 30.0, 0.5)
        .name("光源强度")
        .onChange(updateShadowConfig);
    spotFolder
        .add(params, "spotAngle", 0.15, 1.2, 0.05)
        .name("聚光角 (Angle)")
        .onChange(updateShadowConfig);
    spotFolder
        .add(params, "spotPenumbra", 0.0, 1.0, 0.05)
        .name("半影过渡 (Penumbra)")
        .onChange(updateShadowConfig);
    spotFolder
        .add(params, "spotDecay", 0.5, 3.0, 0.1)
        .name("光衰减率 (Decay)")
        .onChange(updateShadowConfig);
    spotFolder
        .add(params, "spotX", -6.0, 6.0, 0.1)
        .name("位置 X")
        .onChange((v) => {
            lights.spot.position.x = v;
            updateShadowConfig();
        });
    spotFolder
        .add(params, "spotY", 3.0, 10.0, 0.1)
        .name("位置 Y")
        .onChange((v) => {
            lights.spot.position.y = v;
            updateShadowConfig();
        });
    spotFolder
        .add(params, "spotZ", -6.0, 6.0, 0.1)
        .name("位置 Z")
        .onChange((v) => {
            lights.spot.position.z = v;
            updateShadowConfig();
        });
    spotFolder.close();

    generalFolder.open();
    precisionFolder.open();
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

    // Clean up helpers
    Object.values(cameraHelpers).forEach((helper) => {
        scene.remove(helper);
        if (helper.dispose) helper.dispose();
    });

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

    // Clean up lights
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
    background: rgba(15, 17, 23, 0.75); /* Dark charcoal tint */
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    font-size: 0.9rem;
    font-weight: 600;
    color: #f43f5e; /* Rose pink-red tag tint */
    letter-spacing: 0.05em;
    pointer-events: none;
}

.info-card {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    z-index: 10;
    max-width: 380px;
    background: rgba(15, 17, 23, 0.85); /* Dark charcoal tint */
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
    color: #f43f5e;
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
    background: rgba(244, 63, 94, 0.15);
    color: #f43f5e;
    margin-left: 0.5rem;
    font-weight: 500;
}

.divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0.8rem 0;
}

.description {
    color: #cbd5e1 !important;
}

.tip {
    color: #f43f5e !important;
    font-weight: 500;
    margin-top: 0.4rem;
}
</style>
