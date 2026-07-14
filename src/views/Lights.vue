<template>
    <div class="demo-container">
        <div class="demo-tag">Demo 08: Lights Showroom (光源与投影沙盒)</div>
        <div ref="containerRef" class="canvas-container"></div>
        <div class="info-card">
            <h3>💡 3D 空间光影沙盒</h3>
            <p><strong>光源类型:</strong> 6种核心光源与辅助器</p>
            <p><strong>阴影渲染:</strong> PCFSoftShadowMap 软阴影</p>
            <div class="divider"></div>
            <p class="description">
                支持在场景中实时开关和对比
                <code>Ambient</code
                >、<code>Hemisphere</code>、<code>Directional</code>、<code>Point</code>、<code>Spot</code>、<code
                    >RectArea</code
                >
                区域光。
                观察它们对不同几何形状的照射漫反射、高光反射以及阴影边缘衰减效果。
            </p>
            <p class="tip">
                💡
                提示：在右侧控制面板中勾选“显示光源辅助线”，可直观查看每种光源的投射几何路径与锥面！
            </p>
        </div>
    </div>
</template>

<script setup>
import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RectAreaLightHelper } from "three/addons/helpers/RectAreaLightHelper.js";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";
import { onMounted, onUnmounted, ref } from "vue";

// Initialize RectAreaLight support
RectAreaLightUniformsLib.init();

const containerRef = ref(null);
let scene, camera, renderer, controls, gui, animationFrameId;

// Lights & Helpers references
const lights = {};
const helpers = {};
const meshes = {};

// Default parameters state
const params = {
    // Light toggles
    ambientEnabled: true,
    hemiEnabled: true,
    dirEnabled: true,
    pointEnabled: true,
    spotEnabled: true,
    rectEnabled: true,
    showHelpers: true,
    enableAnimation: true,

    // Ambient settings
    ambientColor: "#ffffff",
    ambientIntensity: 0.1,

    // Hemisphere settings
    hemiSkyColor: "#7cb9ff",
    hemiGroundColor: "#443322",
    hemiIntensity: 0.2,

    // Directional settings
    dirColor: "#ffffff",
    dirIntensity: 0.8,
    dirCastShadow: true,

    // Point settings
    pointColor: "#ff007f", // Magenta
    pointIntensity: 3.5,
    pointDistance: 8.0,
    pointCastShadow: true,

    // Spot settings
    spotColor: "#00f2fe", // Cyan
    spotIntensity: 6.0,
    spotDistance: 12.0,
    spotAngle: 0.5, // ~30 degrees
    spotPenumbra: 0.6,
    spotDecay: 1.5,
    spotCastShadow: true,

    // RectArea settings
    rectColor: "#ffaa00", // Warm Gold
    rectIntensity: 6.0,
    rectWidth: 2.0,
    rectHeight: 1.0,

    // Studio Settings
    floorRoughness: 0.35,
    floorMetalness: 0.2,
    objRoughness: 0.45,
    objMetalness: 0.15,
};

// Reusable function to update all light states from params
const updateLights = () => {
    // 1. Ambient Light
    lights.ambient.visible = params.ambientEnabled;
    lights.ambient.color.set(params.ambientColor);
    lights.ambient.intensity = params.ambientIntensity;

    // 2. Hemisphere Light
    lights.hemi.visible = params.hemiEnabled;
    lights.hemi.color.set(params.hemiSkyColor);
    lights.hemi.groundColor.set(params.hemiGroundColor);
    lights.hemi.intensity = params.hemiIntensity;
    if (helpers.hemi)
        helpers.hemi.visible = params.hemiEnabled && params.showHelpers;

    // 3. Directional Light
    lights.dir.visible = params.dirEnabled;
    lights.dir.color.set(params.dirColor);
    lights.dir.intensity = params.dirIntensity;
    lights.dir.castShadow = params.dirCastShadow;
    if (helpers.dir)
        helpers.dir.visible = params.dirEnabled && params.showHelpers;

    // 4. Point Light
    lights.point.visible = params.pointEnabled;
    lights.point.color.set(params.pointColor);
    lights.point.intensity = params.pointIntensity;
    lights.point.distance = params.pointDistance;
    lights.point.castShadow = params.pointCastShadow;
    if (helpers.point)
        helpers.point.visible = params.pointEnabled && params.showHelpers;

    // 5. Spot Light
    lights.spot.visible = params.spotEnabled;
    lights.spot.color.set(params.spotColor);
    lights.spot.intensity = params.spotIntensity;
    lights.spot.distance = params.spotDistance;
    lights.spot.angle = params.spotAngle;
    lights.spot.penumbra = params.spotPenumbra;
    lights.spot.decay = params.spotDecay;
    lights.spot.castShadow = params.spotCastShadow;
    if (helpers.spot)
        helpers.spot.visible = params.spotEnabled && params.showHelpers;

    // 6. RectArea Light
    lights.rect.visible = params.rectEnabled;
    lights.rect.color.set(params.rectColor);
    lights.rect.intensity = params.rectIntensity;
    lights.rect.width = params.rectWidth;
    lights.rect.height = params.rectHeight;
    if (helpers.rect)
        helpers.rect.visible = params.rectEnabled && params.showHelpers;
};

const initThree = () => {
    if (!containerRef.value) return;

    // 1. Create Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c0f17"); // Dark elegant blue background

    // Add atmospheric subtle fog
    scene.fog = new THREE.FogExp2("#0c0f17", 0.08);

    // 2. Create Camera
    camera = new THREE.PerspectiveCamera(
        45,
        containerRef.value.clientWidth / containerRef.value.clientHeight,
        0.1,
        100,
    );
    camera.position.set(0, 3.5, 7.5);

    // 3. Create WebGL Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Beautiful soft shadow edges
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    containerRef.value.appendChild(renderer.domElement);

    // 4. Add Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02; // Keep camera above floor

    // 5. Initialize the 6 lights
    // 5.1. Ambient 环境光
    lights.ambient = new THREE.AmbientLight();
    scene.add(lights.ambient);

    // 5.2. Hemisphere 半球光
    lights.hemi = new THREE.HemisphereLight();
    scene.add(lights.hemi);
    helpers.hemi = new THREE.HemisphereLightHelper(lights.hemi, 0.4);
    scene.add(helpers.hemi);

    // 5.3. Directional 太阳光 平行光
    lights.dir = new THREE.DirectionalLight();
    lights.dir.position.set(4, 5, 2);
    lights.dir.shadow.mapSize.width = 1024;
    lights.dir.shadow.mapSize.height = 1024;
    lights.dir.shadow.bias = -0.0005;
    scene.add(lights.dir);
    helpers.dir = new THREE.DirectionalLightHelper(lights.dir, 0.4);
    scene.add(helpers.dir);

    // 5.4. Point Light 点光源
    lights.point = new THREE.PointLight();
    lights.point.position.set(0, 1.2, 0); // 点光源的位置
    lights.point.shadow.mapSize.width = 1024; // 点光源的阴影贴图大小
    lights.point.shadow.mapSize.height = 1024; // 点光源的阴影贴图大小
    lights.point.shadow.bias = -0.001; // 点光源的阴影偏置
    scene.add(lights.point);
    helpers.point = new THREE.PointLightHelper(lights.point, 0.08); // 点光源的辅助
    scene.add(helpers.point);

    // 5.5. Spot Light 定向光 聚光灯
    lights.spot = new THREE.SpotLight();
    lights.spot.position.set(0, 3.8, 3.2); // 定向光的位置
    lights.spot.shadow.mapSize.width = 1024;
    lights.spot.shadow.mapSize.height = 1024;
    lights.spot.shadow.bias = -0.0005;
    scene.add(lights.spot);
    helpers.spot = new THREE.SpotLightHelper(lights.spot);
    scene.add(helpers.spot);

    // 5.6. RectArea Light
    lights.rect = new THREE.RectAreaLight();
    lights.rect.position.set(-2, 1.5, 0.8);
    lights.rect.lookAt(0, 0, 0);
    scene.add(lights.rect);
    helpers.rect = new RectAreaLightHelper(lights.rect);
    scene.add(helpers.rect);

    // Synchronize current params to lights
    updateLights();

    // 6. Build Showcase Geometries
    // Common material
    const objectMaterial = new THREE.MeshStandardMaterial({
        roughness: params.objRoughness,
        metalness: params.objMetalness,
    });

    // 6.1. Sphere (Coral Red)
    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const sphereMat = objectMaterial.clone();
    sphereMat.color.set(0xff5e62);
    meshes.sphere = new THREE.Mesh(sphereGeo, sphereMat);
    meshes.sphere.position.set(-1.6, 0.0, -1.2);
    meshes.sphere.castShadow = true;
    meshes.sphere.receiveShadow = true;
    scene.add(meshes.sphere);

    // 6.2. Cube (Teal)
    const cubeGeo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    const cubeMat = objectMaterial.clone();
    cubeMat.color.set(0x26d0ce);
    meshes.cube = new THREE.Mesh(cubeGeo, cubeMat);
    meshes.cube.position.set(1.6, 0.0, -1.2);
    meshes.cube.castShadow = true;
    meshes.cube.receiveShadow = true;
    scene.add(meshes.cube);

    // 6.3. Torus Knot (Violet)
    const knotGeo = new THREE.TorusKnotGeometry(0.3, 0.1, 80, 10);
    const knotMat = objectMaterial.clone();
    knotMat.color.set(0xa78bfa);
    meshes.knot = new THREE.Mesh(knotGeo, knotMat);
    meshes.knot.position.set(-1.6, 0.0, 1.2);
    meshes.knot.castShadow = true;
    meshes.knot.receiveShadow = true;
    scene.add(meshes.knot);

    // 6.4. Cylinder (Yellow)
    const cylinderGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.0, 32);
    const cylinderMat = objectMaterial.clone();
    cylinderMat.color.set(0xffbe0b);
    meshes.cylinder = new THREE.Mesh(cylinderGeo, cylinderMat);
    meshes.cylinder.position.set(1.6, 0.0, 1.2);
    meshes.cylinder.castShadow = true;
    meshes.cylinder.receiveShadow = true;
    scene.add(meshes.cylinder);

    // 6.5. Center Pedestal (Studio stand)
    const standGeo = new THREE.CylinderGeometry(0.65, 0.75, 0.5, 32);
    const standMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.6,
    });
    const stand = new THREE.Mesh(standGeo, standMat);
    stand.position.set(0, -0.75, 0);
    stand.receiveShadow = true;
    stand.castShadow = true;
    scene.add(stand);

    // 7. Reflective Studio Floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    meshes.floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x0a0c12, // dark gray slate
        roughness: params.floorRoughness,
        metalness: params.floorMetalness,
    });
    const floor = new THREE.Mesh(floorGeo, meshes.floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.0; // aligned with stand bottom
    floor.receiveShadow = true;
    scene.add(floor);

    // SpotLight target setup (points at center stand)
    lights.spot.target = stand;

    // 8. Animation Loop
    const clock = new THREE.Timer();
    clock.connect(document);

    const animate = (timestamp) => {
        animationFrameId = requestAnimationFrame(animate);
        clock.update(timestamp);

        const elapsedTime = clock.getElapsed();

        // Slow mesh rotations
        meshes.sphere.rotation.y = elapsedTime * 0.2;
        meshes.cube.rotation.x = elapsedTime * 0.15;
        meshes.cube.rotation.y = elapsedTime * 0.2;
        meshes.knot.rotation.x = elapsedTime * 0.3;
        meshes.knot.rotation.y = elapsedTime * 0.2;
        meshes.cylinder.rotation.y = elapsedTime * 0.4;

        // Lights animations (Orbit & Bouncing)
        if (params.enableAnimation) {
            // 1. Point Light orbits objects in a circular ring
            if (params.pointEnabled) {
                lights.point.position.x = Math.sin(elapsedTime * 1.2) * 2.2;
                lights.point.position.z = Math.cos(elapsedTime * 1.2) * 2.2;
                lights.point.position.y =
                    0.5 + Math.sin(elapsedTime * 2.0) * 0.5; // bounce up and down
            }

            // 2. Spot Light sways back and forth slightly
            if (params.spotEnabled) {
                lights.spot.position.x = Math.sin(elapsedTime * 0.6) * 1.8;
                lights.spot.position.z =
                    2.2 + Math.cos(elapsedTime * 0.6) * 0.8;
            }

            // 3. RectArea Light rotates slowly
            if (params.rectEnabled) {
                const angle = elapsedTime * 0.5;
                lights.rect.position.x = Math.sin(angle) * 2.5;
                lights.rect.position.z = Math.cos(angle) * 2.5;
                lights.rect.lookAt(0, 0, 0); // Always face center stand
            }
        } else {
            // Reset to static positions if animation disabled
            if (params.pointEnabled) {
                lights.point.position.set(0, 1.2, 0);
            }
            if (params.spotEnabled) {
                lights.spot.position.set(0, 3.8, 3.2);
            }
            if (params.rectEnabled) {
                lights.rect.position.set(-2.0, 1.5, 0.8);
                lights.rect.lookAt(0, 0, 0);
            }
        }

        // Keep helpers updated
        if (params.showHelpers) {
            if (params.dirEnabled && helpers.dir) helpers.dir.update();
            if (params.spotEnabled && helpers.spot) helpers.spot.update();
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
    gui.title("3D 光源与阴影面板");

    // 1. General Controls
    const generalFolder = gui.addFolder("光源总控");
    generalFolder
        .add(params, "showHelpers")
        .name("显示光源辅助线")
        .onChange((v) => {
            Object.values(helpers).forEach((h) => {
                h.visible = v;
            });
            updateLights(); // sync with active states
        });
    generalFolder.add(params, "enableAnimation").name("启用动态轨迹");
    generalFolder
        .add(params, "ambientEnabled")
        .name("环境光 (Ambient)")
        .onChange(updateLights);
    generalFolder
        .add(params, "hemiEnabled")
        .name("天空光 (Hemisphere)")
        .onChange(updateLights);
    generalFolder
        .add(params, "dirEnabled")
        .name("太阳光 (Directional)")
        .onChange(updateLights);
    generalFolder
        .add(params, "pointEnabled")
        .name("点光源 (Point)")
        .onChange(updateLights);
    generalFolder
        .add(params, "spotEnabled")
        .name("聚光灯 (Spot)")
        .onChange(updateLights);
    generalFolder
        .add(params, "rectEnabled")
        .name("区域光 (RectArea)")
        .onChange(updateLights);

    // 2. Ambient & Hemisphere settings
    const ambientFolder = gui.addFolder("环境与半球光参数");
    ambientFolder
        .addColor(params, "ambientColor")
        .name("环境光颜色")
        .onChange(updateLights);
    ambientFolder
        .add(params, "ambientIntensity", 0.0, 2.0, 0.05)
        .name("环境光强度")
        .onChange(updateLights);
    ambientFolder
        .addColor(params, "hemiSkyColor")
        .name("天空颜色")
        .onChange(updateLights);
    ambientFolder
        .addColor(params, "hemiGroundColor")
        .name("地面颜色")
        .onChange(updateLights);
    ambientFolder
        .add(params, "hemiIntensity", 0.0, 2.0, 0.05)
        .name("半球光强度")
        .onChange(updateLights);
    ambientFolder.close();

    // 3. Directional Light
    const dirFolder = gui.addFolder("太阳光 (Directional)");
    dirFolder
        .addColor(params, "dirColor")
        .name("光照颜色")
        .onChange(updateLights);
    dirFolder
        .add(params, "dirIntensity", 0.0, 5.0, 0.1)
        .name("光照强度")
        .onChange(updateLights);
    dirFolder
        .add(params, "dirCastShadow")
        .name("启用阴影投射")
        .onChange(updateLights);
    dirFolder.close();

    // 4. Point Light
    const pointFolder = gui.addFolder("点光源 (Point)");
    pointFolder
        .addColor(params, "pointColor")
        .name("光源颜色")
        .onChange(updateLights);
    pointFolder
        .add(params, "pointIntensity", 0.0, 15.0, 0.5)
        .name("光源强度")
        .onChange(updateLights);
    pointFolder
        .add(params, "pointDistance", 1.0, 20.0, 0.5)
        .name("影响距离")
        .onChange(updateLights);
    pointFolder
        .add(params, "pointCastShadow")
        .name("启用阴影投射")
        .onChange(updateLights);
    pointFolder.close();

    // 5. Spot Light
    const spotFolder = gui.addFolder("聚光灯 (Spot)");
    spotFolder
        .addColor(params, "spotColor")
        .name("光源颜色")
        .onChange(updateLights);
    spotFolder
        .add(params, "spotIntensity", 0.0, 30.0, 0.5)
        .name("光源强度")
        .onChange(updateLights);
    spotFolder
        .add(params, "spotDistance", 2.0, 30.0, 0.5)
        .name("影响距离")
        .onChange(updateLights);
    spotFolder
        .add(params, "spotAngle", 0.1, 1.2, 0.05)
        .name("聚光角 (Angle)")
        .onChange(updateLights);
    spotFolder
        .add(params, "spotPenumbra", 0.0, 1.0, 0.05)
        .name("边缘软化 (Penumbra)")
        .onChange(updateLights);
    spotFolder
        .add(params, "spotDecay", 0.5, 3.0, 0.1)
        .name("光衰减率 (Decay)")
        .onChange(updateLights);
    spotFolder
        .add(params, "spotCastShadow")
        .name("启用阴影投射")
        .onChange(updateLights);
    spotFolder.close();

    // 6. RectArea Light
    const rectFolder = gui.addFolder("区域光 (RectArea)");
    rectFolder
        .addColor(params, "rectColor")
        .name("光照颜色")
        .onChange(updateLights);
    rectFolder
        .add(params, "rectIntensity", 0.0, 25.0, 0.5)
        .name("光照强度")
        .onChange(updateLights);
    rectFolder
        .add(params, "rectWidth", 0.1, 6.0, 0.1)
        .name("光源宽度")
        .onChange(updateLights);
    rectFolder
        .add(params, "rectHeight", 0.1, 6.0, 0.1)
        .name("光源高度")
        .onChange(updateLights);
    rectFolder.close();

    // 7. Materials & Render Settings
    const studioFolder = gui.addFolder("工作台与渲染");
    studioFolder
        .add(params, "floorRoughness", 0.0, 1.0, 0.05)
        .name("地板粗糙度")
        .onChange((v) => {
            meshes.floorMaterial.roughness = v;
        });
    studioFolder
        .add(params, "floorMetalness", 0.0, 1.0, 0.05)
        .name("地板金属度")
        .onChange((v) => {
            meshes.floorMaterial.metalness = v;
        });
    studioFolder
        .add(params, "objRoughness", 0.0, 1.0, 0.05)
        .name("物体粗糙度")
        .onChange((v) => {
            Object.values(meshes).forEach((mesh) => {
                if (mesh !== meshes.floorMaterial && mesh.material) {
                    mesh.material.roughness = v;
                }
            });
        });
    studioFolder
        .add(params, "objMetalness", 0.0, 1.0, 0.05)
        .name("物体金属度")
        .onChange((v) => {
            Object.values(meshes).forEach((mesh) => {
                if (mesh !== meshes.floorMaterial && mesh.material) {
                    mesh.material.metalness = v;
                }
            });
        });
    studioFolder.close();

    generalFolder.open();
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
    Object.values(helpers).forEach((helper) => {
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
    background: rgba(12, 17, 28, 0.75); /* Deep slate tint */
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    font-size: 0.9rem;
    font-weight: 600;
    color: #38bdf8; /* Cyan-blue tint */
    letter-spacing: 0.05em;
    pointer-events: none;
}

.info-card {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    z-index: 10;
    max-width: 380px;
    background: rgba(12, 17, 28, 0.85); /* Deep slate tint */
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
    color: #38bdf8;
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

.divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 0.8rem 0;
}

.description {
    color: #cbd5e1 !important;
}

.tip {
    color: #38bdf8 !important;
    font-weight: 500;
    margin-top: 0.4rem;
}
</style>
