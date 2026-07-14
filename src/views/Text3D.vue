<template>
    <div class="demo-container">
        <div class="demo-tag">Demo 07: 3D Typography (3D 文字艺术)</div>
        <div ref="containerRef" class="canvas-container"></div>

        <!-- Interactive Control Card -->
        <div class="info-card">
            <h3>✍️ 3D 空间文字沙盒</h3>
            <p>
                <strong>字体源:</strong> Helvetiker Regular
                <span class="tag">typeface.json</span>
            </p>
            <p><strong>着色材质:</strong> 物理折射与多层清漆</p>
            <div class="divider"></div>

            <!-- Real-time Text Input -->
            <div class="input-group">
                <label for="textString" class="input-label"
                    >📝 输入自定义文本 (最大15字):</label
                >
                <input
                    id="textString"
                    v-model="textString"
                    type="text"
                    maxlength="15"
                    placeholder="Three.js Text"
                    class="text-input-field"
                />
            </div>

            <div class="divider"></div>
            <p class="description">
                基于 <code>FontLoader</code> 动态加载 JSON
                轮廓字模，生成带有倒角（Bevel）的 <code>TextGeometry</code>。
                支持在黄金、虹彩金属、霓虹玻璃和斯堪的纳维亚磨砂材质之间切换。
            </p>
            <p class="tip">
                💡
                提示：您可以在右侧控制面板微调字体的厚度、倒角斜面段数等细节属性！
            </p>
        </div>

        <!-- Font loading screen overlay -->
        <div v-if="isLoading" class="loading-overlay">
            <div class="spinner"></div>
            <div class="loading-text">正在加载 3D 轮廓字模...</div>
        </div>
    </div>
</template>

<script setup>
import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { onMounted, onUnmounted, ref, watch } from "vue";

const containerRef = ref(null);
const textString = ref("Three.js 3D");
const isLoading = ref(true);

let scene, camera, renderer, controls, gui, animationFrameId;
let loadedFont = null;
let textMesh = null;
let particles = null;
let envTexture = null;
let axesHelper = null;
let donutsGroup = null;
let lights = {};

// Material Presets
const materials = {};
const textureLoader = new THREE.TextureLoader();

const createMaterials = () => {
    // 1. Imperial Gold
    materials.gold = new THREE.MeshPhysicalMaterial({
        color: 0xffd700,
        metalness: 0.95,
        roughness: 0.15,
        clearcoat: 1.0,
        clearcoatRoughness: 0.08,
        ior: 2.2,
    });

    // 2. Iridescent Rainbow Metal
    materials.iridescent = new THREE.MeshPhysicalMaterial({
        color: 0x1a1a1a,
        metalness: 0.9,
        roughness: 0.08,
        iridescence: 1.0,
        iridescenceIOR: 1.9,
        iridescenceThicknessRange: [150, 450],
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
    });

    // 3. Neon Glowing Glass
    materials.glass = new THREE.MeshPhysicalMaterial({
        color: 0x00f2fe,
        metalness: 0.0,
        roughness: 0.08,
        transmission: 0.96,
        ior: 1.5,
        thickness: 0.25,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        emissive: 0x002e40, // subtle inner neon glow
        transparent: true,
        opacity: 0.9,
    });

    // 4. Scandinavian Matte Pastel
    materials.matte = new THREE.MeshStandardMaterial({
        color: 0xff7096, // Rose pink
        roughness: 0.75,
        metalness: 0.1,
    });

    // 5. wireframe
    materials.wireframe = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
    });

    // 6. Matcap Materials (1 to 8)
    for (let i = 1; i <= 8; i++) {
        const tex = textureLoader.load(`/static/textures/matcaps/${i}.png`);
        tex.colorSpace = THREE.SRGBColorSpace;
        materials[`matcap_${i}`] = new THREE.MeshMatcapMaterial({
            matcap: tex,
        });
    }
};

// UI Parameters State
const params = {
    text: "Three.js 3D",
    materialType: "iridescent",
    fontSize: 0.55,
    thickness: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.015,
    bevelSegments: 5,
    curveSegments: 6,
    wireframe: false,
    showAxes: true,
    // Background Particles
    particleCount: 150,
    particleColor: "#00f2fe",
    // Environment
    exposure: 1.3,
    lightOrbitSpeed: 0.8,
    ambientLightIntensity: 0.25,
};

// Rebuild 3D text geometry when options change
const updateTextGeometry = () => {
    if (!loadedFont || !scene) return;

    // Remove existing mesh
    if (textMesh) {
        scene.remove(textMesh);
        if (textMesh.geometry) textMesh.geometry.dispose();
        textMesh = null;
    }

    // Skip empty text
    const textToRender = params.text.trim() === "" ? " " : params.text;

    // Create Text Geometry
    const textGeo = new TextGeometry(textToRender, {
        font: loadedFont,
        size: params.fontSize,
        depth: params.thickness,
        curveSegments: params.curveSegments,
        bevelEnabled: params.bevelEnabled,
        bevelThickness: params.bevelThickness,
        bevelSize: params.bevelSize,
        bevelOffset: 0,
        bevelSegments: params.bevelSegments,
    });

    // Compute bounding box and center geometry
    textGeo.computeBoundingBox(); // 包围盒 computeBoundingBox
    textGeo.center(); // 居中

    // textGeo.translate(
    //     -(textGeo.boundingBox.max.x - params.bevelSize) * 0.5,
    //     -(textGeo.boundingBox.max.y - params.bevelSize) * 0.5,
    //     -(textGeo.boundingBox.max.z - params.bevelThickness) * 0.5,
    // );

    console.log(textGeo.boundingBox);

    // Select material
    const activeMat = params.wireframe
        ? materials.wireframe
        : materials[params.materialType] || materials.iridescent;

    // Create Mesh
    textMesh = new THREE.Mesh(textGeo, activeMat);
    textMesh.castShadow = true;
    textMesh.receiveShadow = true;

    // Position slightly above ground
    textMesh.position.y = 0.1;

    scene.add(textMesh);

    // Adjust internal lights if Neon Glass is active (to create that neon look)
    if (params.materialType === "glass") {
        lights.glowLight.intensity = 6;
        lights.glowLight.color.set(0x00f2fe);
    } else if (params.materialType === "gold") {
        lights.glowLight.intensity = 2;
        lights.glowLight.color.set(0xffaa00);
    } else {
        lights.glowLight.intensity = 0; // Turn off inner glow light for non-glowing materials
    }
};

// Create a glowing procedural canvas environment map (Neon studio theme)
const createProceduralEnvMap = (renderer) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Deep space indigo/purple
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#030206");
    grad.addColorStop(0.5, "#0b0816");
    grad.addColorStop(1, "#020104");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // High intensity neon highlights (Cyan, Purple, Magenta, White)
    const colors = [
        "#00f2fe",
        "#7c3aed",
        "#ff007f",
        "#ffffff",
        "#00ffff",
        "#8b5cf6",
    ];
    for (let i = 0; i < 22; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 80 + 15;

        const radialGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        radialGrad.addColorStop(0, colors[i % colors.length]);
        radialGrad.addColorStop(0.2, colors[(i + 1) % colors.length] + "99");
        radialGrad.addColorStop(1, "transparent");

        ctx.fillStyle = radialGrad;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    const tempTexture = new THREE.CanvasTexture(canvas);
    tempTexture.mapping = THREE.EquirectangularReflectionMapping;

    const renderTarget = pmremGenerator.fromEquirectangular(tempTexture);

    // Clean up temporary assets
    tempTexture.dispose();
    pmremGenerator.dispose();

    return renderTarget.texture;
};

// Setup background floating particle field
const createParticles = () => {
    if (particles) {
        scene.remove(particles);
        particles.geometry.dispose();
    }

    const count = params.particleCount;
    const positions = new Float32Array(count * 3);
    const randomScales = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 12; // X width
        positions[i * 3 + 1] = (Math.random() - 0.4) * 6; // Y height
        positions[i * 3 + 2] = (Math.random() - 0.5) * 10; // Z depth
        randomScales[i] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: new THREE.Color(params.particleColor),
        size: 0.07,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
    });

    particles = new THREE.Points(geometry, material);
    scene.add(particles);
    particles.userData = { randomScales };
};

// Setup background floating matcap donuts field
const createDonuts = () => {
    if (donutsGroup) {
        scene.remove(donutsGroup);
        donutsGroup.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
    }

    donutsGroup = new THREE.Group();

    for (let i = 0; i < 100; i++) {
        const donutGeometry = new THREE.TorusGeometry(0.25, 0.15, 16, 32);

        // Map 0-99 index to 1-8 png filenames
        const matcapIndex = (i % 8) + 1;
        const matcapTex = textureLoader.load(
            `/static/textures/matcaps/${matcapIndex}.png`,
        );
        matcapTex.colorSpace = THREE.SRGBColorSpace;

        const donutMaterial = new THREE.MeshMatcapMaterial({
            matcap: matcapTex,
        });

        const donut = new THREE.Mesh(donutGeometry, donutMaterial);

        // Position donuts in a scattered field around the central text
        donut.position.x = (Math.random() - 0.5) * 14;
        donut.position.y = (Math.random() - 0.5) * 8;
        donut.position.z = (Math.random() - 0.5) * 10;

        // Give them random initial rotations and scales for variety
        donut.rotation.x = Math.random() * Math.PI;
        donut.rotation.y = Math.random() * Math.PI;
        const scale = Math.random() * 0.4 + 0.6;
        donut.scale.set(scale, scale, scale);

        donutsGroup.add(donut);
    }
    scene.add(donutsGroup);
};

// Listen to Vue input changes and bridge them to three.js
watch(textString, (newVal) => {
    params.text = newVal;
    updateTextGeometry();
});

const initThree = () => {
    if (!containerRef.value) return;

    // 1. Create Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#050408"); // Indigo dark

    // 2. Create Camera
    camera = new THREE.PerspectiveCamera(
        45,
        containerRef.value.clientWidth / containerRef.value.clientHeight,
        0.1,
        1000,
    );
    camera.position.set(0, 0.8, 3.8);

    // 3. Create WebGL Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = params.exposure;
    containerRef.value.appendChild(renderer.domElement);

    // 4. Add Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05; // Lock camera below floor level

    // 5. Generate Environment Map
    envTexture = createProceduralEnvMap(renderer);
    scene.environment = envTexture;

    // 6. Create Materials Preset List
    createMaterials();

    // 7. Add Reflective Dark Studio Floor
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshPhysicalMaterial({
        color: 0x0c0b11,
        roughness: 0.35,
        metalness: 0.8,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.7; // Just below the text mesh
    ground.receiveShadow = true;
    scene.add(ground);

    // 8. Add Lighting
    const ambientLight = new THREE.AmbientLight(
        0xffffff,
        params.ambientLightIntensity,
    );
    scene.add(ambientLight);
    lights.ambient = ambientLight;

    // Key Light
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(4, 8, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 25;
    keyLight.shadow.camera.left = -4;
    keyLight.shadow.camera.right = 4;
    keyLight.shadow.camera.top = 4;
    keyLight.shadow.camera.bottom = -4;
    scene.add(keyLight);
    lights.key = keyLight;

    // Moving colored point lights for nice chromatic reflections
    const colorLight1 = new THREE.PointLight(0xff00ff, 4, 12); // Magenta
    colorLight1.position.set(-3, 1, 2);
    scene.add(colorLight1);
    lights.colorLight1 = colorLight1;

    const colorLight2 = new THREE.PointLight(0x00ffff, 4, 12); // Cyan
    colorLight2.position.set(3, 1, 2);
    scene.add(colorLight2);
    lights.colorLight2 = colorLight2;

    // Back glowing light that coordinates with glass neon mesh
    const glowLight = new THREE.PointLight(0x00f2fe, 0, 8);
    glowLight.position.set(0, 0, -0.4);
    scene.add(glowLight);
    lights.glowLight = glowLight;

    // 9. Load 3D Font
    const fontLoader = new FontLoader();
    // Fetch from copied public static file
    // 工作方式与纹理加载器不同
    fontLoader.load(
        "/static/fonts/helvetiker_regular.typeface.json", // 加载路径
        (font) => {
            loadedFont = font;
            isLoading.value = false;

            // Build the initial text geometry
            updateTextGeometry();

            // Initialize GUI after font loads
            initGUI();
        },
        undefined,
        (err) => {
            console.error("Failed to load 3D font JSON:", err);
            isLoading.value = false;
        },
    );

    // 10. Background Particles
    createParticles();

    console.time("createDonuts");
    // 10.2. Create background Matcap donuts
    createDonuts();
    console.timeEnd("createDonuts");

    // 10.5. Add Axes Helper
    axesHelper = new THREE.AxesHelper(2);
    axesHelper.visible = params.showAxes;
    scene.add(axesHelper);

    // 11. Animation Loop
    const clock = new THREE.Clock();

    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        // Rotate/bounce text mesh slightly
        if (textMesh) {
            textMesh.rotation.y = Math.sin(elapsedTime * 0.25) * 0.12;
            // Float up and down gently
            textMesh.position.y = 0.05 + Math.sin(elapsedTime * 1.5) * 0.04;
        }

        // Animate background donuts (slow spin and float)
        if (donutsGroup) {
            donutsGroup.children.forEach((donut, idx) => {
                donut.rotation.x += 0.004;
                donut.rotation.y += 0.007;
                donut.position.y += Math.sin(elapsedTime * 0.4 + idx) * 0.0008;
            });
        }

        // Animate background particles (drift)
        if (particles) {
            const posAttr = particles.geometry.attributes.position;
            const scales = particles.userData.randomScales;

            for (let i = 0; i < params.particleCount; i++) {
                const yIdx = i * 3 + 1;
                // Move upward
                posAttr.array[yIdx] += 0.003 * (scales[i] * 0.5 + 0.5);

                // Wrap around when particle floats too high
                if (posAttr.array[yIdx] > 4) {
                    posAttr.array[yIdx] = -2;
                }
            }
            posAttr.needsUpdate = true;
        }

        // Orbit neon reflection point lights
        if (params.lightOrbitSpeed > 0) {
            const speed = params.lightOrbitSpeed;
            lights.colorLight1.position.x =
                Math.sin(elapsedTime * 0.7 * speed) * 3.5;
            lights.colorLight1.position.z =
                Math.cos(elapsedTime * 0.7 * speed) * 3.5;

            lights.colorLight2.position.x =
                -Math.sin(elapsedTime * 0.8 * speed) * 3.5;
            lights.colorLight2.position.z =
                -Math.cos(elapsedTime * 0.8 * speed) * 3.5;
        }

        controls.update();
        renderer.render(scene, camera);
    };
    animate();

    window.addEventListener("resize", handleResize);
};

// Initialize Debug GUI
const initGUI = () => {
    gui = new GUI();
    gui.title("3D 字体渲染面板");

    // Text Content & Font Layout parameters
    const textFolder = gui.addFolder("文本排版设置");
    textFolder
        .add(params, "text")
        .name("文本内容")
        .onChange((v) => {
            textString.value = v; // sync with Vue input
            updateTextGeometry();
        });
    textFolder
        .add(params, "fontSize", 0.2, 1.5, 0.05)
        .name("文字大小")
        .onChange(updateTextGeometry);
    textFolder
        .add(params, "thickness", 0.05, 0.8, 0.01)
        .name("挤出厚度")
        .onChange(updateTextGeometry);
    textFolder
        .add(params, "curveSegments", 1, 32, 1)
        .name("文字细分数")
        .onChange(updateTextGeometry);

    const bevelFolder = gui.addFolder("倒角斜面 (Bevel)");
    bevelFolder
        .add(params, "bevelEnabled")
        .name("启用倒角")
        .onChange(updateTextGeometry);
    bevelFolder
        .add(params, "bevelThickness", 0.005, 0.1, 0.005)
        .name("倒角厚度")
        .onChange(updateTextGeometry);
    bevelFolder
        .add(params, "bevelSize", 0.005, 0.08, 0.005)
        .name("倒角大小")
        .onChange(updateTextGeometry);
    bevelFolder
        .add(params, "bevelSegments", 1, 10, 1)
        .name("圆角段数")
        .onChange(updateTextGeometry);

    // Material switching
    const styleFolder = gui.addFolder("外观与材质");

    const materialPresets = {
        "金质高光 (Imperial Gold)": "gold",
        "多彩虹彩 (Iridescent Metal)": "iridescent",
        "霓虹玻璃 (Neon Glass)": "glass",
        "磨砂马卡龙 (Matte Pastel)": "matte",
        "艺术Matcap 1 (铜质高光)": "matcap_1",
        "艺术Matcap 2 (红色塑料)": "matcap_2",
        "艺术Matcap 3 (铬银反光)": "matcap_3",
        "艺术Matcap 4 (亮金反射)": "matcap_4",
        "艺术Matcap 5 (陶土磨砂)": "matcap_5",
        "艺术Matcap 6 (蓝色瓷釉)": "matcap_6",
        "艺术Matcap 7 (极光幻彩)": "matcap_7",
        "艺术Matcap 8 (卡通勾边)": "matcap_8",
    };

    styleFolder
        .add(params, "materialType", materialPresets)
        .name("材质预设")
        .onChange(() => {
            updateTextGeometry();
        });
    styleFolder
        .add(params, "exposure", 0.1, 3.0, 0.05)
        .name("镜头曝光")
        .onChange((v) => {
            renderer.toneMappingExposure = v;
        });

    // Particle settings
    const particleFolder = gui.addFolder("背景粒子特效");
    particleFolder
        .add(params, "particleCount", 10, 300, 10)
        .name("粒子数量")
        .onChange(createParticles);
    particleFolder
        .addColor(params, "particleColor")
        .name("粒子颜色")
        .onChange((v) => {
            if (particles) particles.material.color.set(v);
        });

    // Lighting Orbit Speed
    const lightingFolder = gui.addFolder("光影环境");
    lightingFolder
        .add(params, "lightOrbitSpeed", 0.0, 3.0, 0.1)
        .name("彩光流转速度");
    lightingFolder
        .add(params, "ambientLightIntensity", 0.0, 1.5, 0.05)
        .name("环境光亮度")
        .onChange((v) => {
            lights.ambient.intensity = v;
        });

    textFolder.open();
    styleFolder.open();

    // add wireframe switch
    styleFolder
        .add(params, "wireframe")
        .name("线框模式")
        .onChange(() => {
            updateTextGeometry();
        });

    // add axes switch
    styleFolder
        .add(params, "showAxes")
        .name("显示坐标轴")
        .onChange((v) => {
            if (axesHelper) axesHelper.visible = v;
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

    // Clean up text mesh
    if (textMesh) {
        scene.remove(textMesh);
        if (textMesh.geometry) textMesh.geometry.dispose();
    }

    // Clean up particles
    if (particles) {
        scene.remove(particles);
        particles.geometry.dispose();
        particles.material.dispose();
    }

    // Clean up axes helper
    if (axesHelper) {
        scene.remove(axesHelper);
        axesHelper.geometry.dispose();
        axesHelper.material.dispose();
    }

    // Clean up background donuts
    if (donutsGroup) {
        scene.remove(donutsGroup);
        donutsGroup.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
    }

    // Clean up environment
    if (envTexture) {
        envTexture.dispose();
    }

    // Clean up lighting
    Object.values(lights).forEach((light) => scene.remove(light));

    // Clean up material instances
    Object.values(materials).forEach((mat) => mat.dispose());

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
    background: rgba(10, 8, 16, 0.75); /* Dark purple tint */
    border: 1px solid rgba(124, 58, 237, 0.18);
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    font-size: 0.9rem;
    font-weight: 600;
    color: #a78bfa;
    letter-spacing: 0.05em;
    pointer-events: none;
}

.info-card {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    z-index: 10;
    max-width: 380px;
    background: rgba(10, 8, 16, 0.85); /* Dark purple tint */
    border: 1px solid rgba(124, 58, 237, 0.15);
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
    color: #c084fc;
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
    background: rgba(167, 139, 250, 0.15);
    color: #a78bfa;
    margin-left: 0.5rem;
    font-weight: 500;
}

.divider {
    height: 1px;
    background: rgba(167, 139, 250, 0.1);
    margin: 0.8rem 0;
}

/* Custom Text Input field styles */
.input-group {
    margin: 0.5rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
}

.input-label {
    font-size: 0.8rem;
    color: #a78bfa;
    font-weight: 600;
}

.text-input-field {
    width: 100%;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(167, 139, 250, 0.25);
    border-radius: 6px;
    padding: 0.5rem 0.8rem;
    color: #ffffff;
    font-size: 0.9rem;
    font-family: inherit;
    outline: none;
    transition: all 0.2s ease;
}

.text-input-field:focus {
    border-color: #c084fc;
    background: rgba(255, 255, 255, 0.09);
    box-shadow: 0 0 10px rgba(192, 132, 252, 0.2);
}

.description {
    color: #cbd5e1 !important;
}

.tip {
    color: #fb7185 !important; /* Rose accent */
    font-weight: 500;
    margin-top: 0.4rem;
}

/* Loading Overlay Styles */
.loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: #050408;
    z-index: 100;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 1.5rem;
}

.spinner {
    width: 45px;
    height: 45px;
    border: 4px solid rgba(167, 139, 250, 0.1);
    border-top: 4px solid #a78bfa;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.loading-text {
    font-size: 0.95rem;
    color: #a78bfa;
    font-weight: 500;
    letter-spacing: 0.05em;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }
    100% {
        transform: rotate(360deg);
    }
}
</style>
