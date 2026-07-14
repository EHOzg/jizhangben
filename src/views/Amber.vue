<template>
    <div class="demo-container">
        <div class="demo-tag">Demo 06: Amber Sandbox (琥珀物理光学模拟)</div>
        <div ref="containerRef" class="canvas-container"></div>
        <div class="info-card">
            <h3>🍯 琥珀与古生物化石模拟</h3>
            <p><strong>折射率 (IOR):</strong> 1.54 <span class="tag">有机宝石</span></p>
            <p><strong>内含物 (Inclusions):</strong> 远古昆虫、气泡与爆花</p>
            <div class="divider"></div>
            <p class="description">
                基于 Three.js v0.184.0 物理材质的<strong>透光率 (Transmission)</strong> 与<strong>体积消光 (Attenuation)</strong> 属性。
                模拟光线穿过不均匀介质时的衰减梯度，实现温暖如蜜的内部晕光与背光质感。
            </p>
            <p class="tip">💡 提示：调整右侧的“背光强度”与“消光距离”，观察光线在琥珀内部的散射晕染！</p>
        </div>
    </div>
</template>

<script setup>
import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { onMounted, onUnmounted, ref } from "vue";

const containerRef = ref(null);
let scene, camera, renderer, controls, gui, animationFrameId;
let amberMesh, inclusionsGroup, insectGroup;
let lights = {};
let envTexture;

// Helper to create an organic, pebble-shaped Amber Geometry
const createOrganicAmberGeometry = () => {
    // Start with a detailed icosahedron
    const geometry = new THREE.IcosahedronGeometry(1.0, 3);
    const pos = geometry.attributes.position;
    const v = new THREE.Vector3();

    // Displace vertices to create a natural, eroded, organic look
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);

        // Define multiple frequencies of simple sine/cosine wave noise
        const noiseX = Math.sin(v.x * 2.5) * Math.cos(v.y * 2.0) * Math.sin(v.z * 2.5);
        const noiseY = Math.cos(v.x * 4.5) * Math.sin(v.y * 3.5) * Math.cos(v.z * 4.5);
        const noiseCombined = noiseX * 0.12 + noiseY * 0.04;

        // Apply noise outward along the vertex normal direction (which is v normalized for a sphere)
        v.normalize().multiplyScalar(1.0 + noiseCombined);

        // Stretch slightly on the Y-axis to make it a teardrop/pebble-like gemstone
        v.y *= 1.25;
        // Squish slightly on Z to make it a bit flattened organically
        v.z *= 0.9;

        pos.setXYZ(i, v.x, v.y, v.z);
    }

    geometry.computeVertexNormals();
    return geometry;
};

// Create a procedurally generated insect (a stylized prehistoric mosquito/ant)
const createPrehistoricInsect = () => {
    const insect = new THREE.Group();
    
    // Dark amber-black resin-like material for fossilized insect body
    const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x180900,
        roughness: 0.15,
        metalness: 0.1,
        clearcoat: 0.8,
        clearcoatRoughness: 0.1
    });

    // 1. Thorax (Center of body)
    const thoraxGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const thorax = new THREE.Mesh(thoraxGeo, bodyMat);
    thorax.scale.set(1.2, 0.9, 0.9);
    thorax.position.set(0, 0.05, 0);
    insect.add(thorax);

    // 2. Head
    const headGeo = new THREE.SphereGeometry(0.03, 16, 16);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 0.11, 0.02);
    insect.add(head);

    // Eyes (Mini beads)
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x050200 });
    const eyeGeo = new THREE.SphereGeometry(0.008, 8, 8);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(0.015, 0.12, 0.035);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(-0.015, 0.12, 0.035);
    insect.add(leftEye);
    insect.add(rightEye);

    // Antennae
    const antCurveL = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0.005, 0.13, 0.03),
        new THREE.Vector3(0.015, 0.16, 0.05),
        new THREE.Vector3(0.025, 0.18, 0.04)
    ]);
    const antCurveR = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.005, 0.13, 0.03),
        new THREE.Vector3(-0.015, 0.16, 0.05),
        new THREE.Vector3(-0.025, 0.18, 0.04)
    ]);
    const antGeoL = new THREE.TubeGeometry(antCurveL, 8, 0.002, 6, false);
    const antGeoR = new THREE.TubeGeometry(antCurveR, 8, 0.002, 6, false);
    const antennaL = new THREE.Mesh(antGeoL, bodyMat);
    const antennaR = new THREE.Mesh(antGeoR, bodyMat);
    insect.add(antennaL);
    insect.add(antennaR);

    // 3. Abdomen (Elongated segmented tail)
    const abdomenGroup = new THREE.Group();
    abdomenGroup.position.set(0, -0.01, -0.01);
    
    // Create 5 segments for insect abdomen
    for (let i = 0; i < 5; i++) {
        const segGeo = new THREE.SphereGeometry(0.03 - i * 0.003, 16, 16);
        const seg = new THREE.Mesh(segGeo, bodyMat);
        seg.scale.set(1.1, 0.7, 1.1);
        seg.position.set(0, -i * 0.035, -i * 0.01);
        abdomenGroup.add(seg);
    }
    insect.add(abdomenGroup);

    // 4. Wings (Translucent, highly refractive film)
    const wingMat = new THREE.MeshPhysicalMaterial({
        color: 0xe0f7fa,
        transmission: 0.95,
        opacity: 0.7,
        transparent: true,
        roughness: 0.05,
        ior: 1.5,
        side: THREE.DoubleSide,
        thickness: 0.01,
        clearcoat: 1.0
    });
    
    // Left wing
    const wingGeoL = new THREE.SphereGeometry(1, 16, 16);
    // Flatten and stretch it to wing shape
    wingGeoL.scale(0.01, 0.14, 0.04);
    const wingL = new THREE.Mesh(wingGeoL, wingMat);
    wingL.position.set(0.03, 0.06, -0.01);
    wingL.rotation.set(0.4, 0.3, -0.6); // Rotated back and up
    insect.add(wingL);

    // Right wing
    const wingR = wingL.clone();
    wingR.position.x = -0.03;
    wingR.rotation.set(0.4, -0.3, 0.6);
    insect.add(wingR);

    // 5. Legs (6 jointed limbs)
    const createLeg = (side, yPos, zAngleOffset) => {
        const legGroup = new THREE.Group();
        legGroup.position.set(side * 0.03, yPos, 0);

        // Coxa/Femur (Upper Leg)
        const upperLegGeo = new THREE.CylinderGeometry(0.003, 0.002, 0.08, 6);
        const upperLeg = new THREE.Mesh(upperLegGeo, bodyMat);
        upperLeg.position.set(side * 0.03, 0.02, 0);
        upperLeg.rotation.z = side * -0.7; // angle outwards
        upperLeg.rotation.y = zAngleOffset;
        legGroup.add(upperLeg);

        // Tibia/Tarsus (Lower Leg)
        const lowerLegGeo = new THREE.CylinderGeometry(0.0018, 0.001, 0.1, 6);
        const lowerLeg = new THREE.Mesh(lowerLegGeo, bodyMat);
        lowerLeg.position.set(side * 0.06, -0.04, 0);
        lowerLeg.rotation.z = side * 0.4; // angle back down
        lowerLeg.rotation.y = zAngleOffset;
        legGroup.add(lowerLeg);

        return legGroup;
    };

    // Front legs
    insect.add(createLeg(1, 0.07, 0.4));
    insect.add(createLeg(-1, 0.07, -0.4));

    // Middle legs
    insect.add(createLeg(1, 0.05, 0.0));
    insect.add(createLeg(-1, 0.05, 0.0));

    // Back legs (slightly longer)
    const backLegL = createLeg(1, 0.03, -0.5);
    backLegL.scale.set(1.2, 1.2, 1.2);
    const backLegR = createLeg(-1, 0.03, 0.5);
    backLegR.scale.set(1.2, 1.2, 1.2);
    insect.add(backLegL);
    insect.add(backLegR);

    // Center and rotate insect slightly for organic pose
    insect.position.set(0, -0.05, 0);
    insect.rotation.set(0.2, 0.4, 0.1);
    insect.scale.set(1.7, 1.7, 1.7); // Scale up insect to be clearly visible inside 1.0-radius amber

    return insect;
};

// Create ancient bubbles inside the amber
const createAirBubbles = (count) => {
    const bubblesGroup = new THREE.Group();

    // Highly shiny/reflective material representing air trapped inside resin
    // Relative IOR: Air (1.0) / Amber (1.54) = 0.65.
    // Specular and transmission will simulate the bright silver refraction look.
    const bubbleMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        roughness: 0.0,
        metalness: 0.1,
        transmission: 0.9,
        ior: 1.0, // Air IOR
        thickness: 0.05,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        transparent: true,
        opacity: 0.8
    });

    for (let i = 0; i < count; i++) {
        // Random size
        const radius = Math.random() * 0.022 + 0.006;
        const bubbleGeo = new THREE.SphereGeometry(radius, 12, 12);
        const bubble = new THREE.Mesh(bubbleGeo, bubbleMat);

        // Position bubbles inside a sphere of radius 0.65 to ensure they stay inside amber
        const r = Math.random() * 0.58;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        bubble.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta) * 1.2, // Match Y stretch
            r * Math.cos(phi) * 0.8 // Match Z squish
        );

        // Give some slight irregular scale to some bubbles (representing compressed air pockets)
        if (Math.random() > 0.6) {
            bubble.scale.set(1.0, Math.random() * 0.4 + 0.8, 1.0);
        }

        bubblesGroup.add(bubble);
    }

    return bubblesGroup;
};

// Create "Sun Spangles" (internal thermal fracture disks / 爆花)
const createSunSpangles = (count) => {
    const spanglesGroup = new THREE.Group();

    // Gold/bronze metallic-translucent reflective disks
    const spangleMat = new THREE.MeshPhysicalMaterial({
        color: 0xffaa00,
        roughness: 0.02,
        metalness: 0.8,
        transmission: 0.4,
        ior: 1.8,
        thickness: 0.02,
        side: THREE.DoubleSide,
        clearcoat: 1.0,
        clearcoatRoughness: 0.0
    });

    for (let i = 0; i < count; i++) {
        // Circular flat disk
        const radius = Math.random() * 0.07 + 0.03;
        const spangleGeo = new THREE.CircleGeometry(radius, 16);
        const spangle = new THREE.Mesh(spangleGeo, spangleMat);

        // Position randomly inside amber
        const r = Math.random() * 0.62;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);

        spangle.position.set(
            r * Math.sin(phi) * Math.cos(theta),
            r * Math.sin(phi) * Math.sin(theta) * 1.2,
            r * Math.cos(phi) * 0.8
        );

        // Random rotation (tilt) to catch light at different angles
        spangle.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        spanglesGroup.add(spangle);
    }

    return spanglesGroup;
};

// Generate a rich, warm procedural environment map
const createProceduralEnvMap = (renderer) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Dark background with warm undertone
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#080503");
    grad.addColorStop(0.5, "#150b05");
    grad.addColorStop(1, "#030202");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glowing warm fire & honey spots (essential for reflections and refraction colors)
    const colors = [
        "#ff9d00", // Bright warm yellow-orange
        "#ff5500", // Hot amber orange
        "#7c00ff", // Purple contrast accent
        "#ffdd66", // Glowing gold
        "#ffffff", // High specular highlights
        "#a83a00", // Deep bronze red
    ];

    for (let i = 0; i < 20; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 120 + 20;

        const radialGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        radialGrad.addColorStop(0, colors[i % colors.length]);
        radialGrad.addColorStop(0.25, colors[(i + 1) % colors.length] + "66");
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

const initThree = () => {
    if (!containerRef.value) return;

    // 1. Create Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#090705"); // Deep warm black

    // 2. Create Camera
    camera = new THREE.PerspectiveCamera(
        50,
        containerRef.value.clientWidth / containerRef.value.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1.2, 3.2);

    // 3. Create WebGL Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    containerRef.value.appendChild(renderer.domElement);

    // 4. Add Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.15; // Don't look too far from below

    // 5. Generate and Set Warm Environment Map
    envTexture = createProceduralEnvMap(renderer);
    scene.environment = envTexture;

    // 6. Setup Inclusions Group
    inclusionsGroup = new THREE.Group();

    // Add prehistoric insect
    insectGroup = createPrehistoricInsect();
    inclusionsGroup.add(insectGroup);

    // Add air bubbles
    const bubbles = createAirBubbles(18);
    inclusionsGroup.add(bubbles);

    // Add sun spangles (fractures)
    const spangles = createSunSpangles(7);
    inclusionsGroup.add(spangles);

    // 7. Setup Amber Geometry & Physically Based Material
    const amberGeo = createOrganicAmberGeometry();
    const amberMat = new THREE.MeshPhysicalMaterial({
        color: 0xffb533,                 // Honey yellow
        metalness: 0.0,
        roughness: 0.06,                 // Highly polished resin
        ior: 1.54,                       // Amber index of refraction
        transmission: 0.98,              // Highly transmissive
        thickness: 2.2,                  // Depth of refraction inside geometry
        clearcoat: 1.0,                  // Outer glazed coat
        clearcoatRoughness: 0.03,
        attenuationColor: 0xd33800,      // Absorptive gradient shifts to deep red-orange in thickness
        attenuationDistance: 0.52,       // Attenuation intensity gradient scale
        side: THREE.DoubleSide,
        transparent: true
    });

    amberMesh = new THREE.Mesh(amberGeo, amberMat);
    scene.add(amberMesh);

    // Nest the inclusions inside the amber mesh so they rotate together
    amberMesh.add(inclusionsGroup);

    // Add a shadow receiver plane at the bottom
    const shadowPlaneGeo = new THREE.PlaneGeometry(10, 10);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.25;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // 8. Add Lighting Setup (Strong backlight is critical for volumetrics)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    scene.add(ambientLight);

    // Key Light (Casts shadow)
    const keyLight = new THREE.DirectionalLight(0xfff0dd, 1.5);
    keyLight.position.set(5, 7, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    // Backlight (Points directly behind the amber towards camera, creating volumetric glow)
    const backlight = new THREE.PointLight(0xff5500, 10, 15);
    backlight.position.set(0, 0.8, -3.2); // Positioned directly behind amber
    scene.add(backlight);
    lights.backlight = backlight;

    // Glowing orbital light helper
    const orbitLight = new THREE.PointLight(0xffc87c, 3, 10);
    orbitLight.position.set(3, 2, -2);
    scene.add(orbitLight);
    lights.orbitLight = orbitLight;

    // 9. Debug GUI Setup
    gui = new GUI();
    gui.title("琥珀渲染控制面板");

    const params = {
        // Material Params
        color: "#ffb533",
        attenuationColor: "#d33800",
        attenuationDistance: 0.52,
        ior: 1.54,
        thickness: 2.2,
        roughness: 0.06,
        clearcoat: 1.0,
        // Inclusions Params
        insectVisible: true,
        bubblesVisible: true,
        spanglesVisible: true,
        inclusionSpin: 0.0,
        // Environment / Lighting
        backlightIntensity: 10,
        backlightColor: "#ff5500",
        exposure: 1.3,
        rotationSpeed: 0.25,
        lightRotation: true
    };

    // Material controls
    const matFolder = gui.addFolder("琥珀材质选项");
    matFolder.addColor(params, "color").name("表面颜色").onChange((v) => {
        amberMat.color.set(v);
    });
    matFolder.addColor(params, "attenuationColor").name("内部吸收色").onChange((v) => {
        amberMat.attenuationColor.set(v);
    });
    matFolder.add(params, "attenuationDistance", 0.05, 2.0, 0.01).name("消光距离").onChange((v) => {
        amberMat.attenuationDistance = v;
    });
    matFolder.add(params, "ior", 1.0, 2.0, 0.01).name("折射率 (IOR)").onChange((v) => {
        amberMat.ior = v;
    });
    matFolder.add(params, "thickness", 0.0, 5.0, 0.1).name("厚度因子").onChange((v) => {
        amberMat.thickness = v;
    });
    matFolder.add(params, "roughness", 0.0, 1.0, 0.01).name("粗糙度").onChange((v) => {
        amberMat.roughness = v;
    });
    matFolder.add(params, "clearcoat", 0.0, 1.0, 0.05).name("清漆强度").onChange((v) => {
        amberMat.clearcoat = v;
    });

    // Inclusions controls
    const incFolder = gui.addFolder("化石内含物");
    incFolder.add(params, "insectVisible").name("显示远古昆虫").onChange((v) => {
        insectGroup.visible = v;
    });
    incFolder.add(params, "bubblesVisible").name("显示远古气泡").onChange((v) => {
        bubbles.visible = v;
    });
    incFolder.add(params, "spanglesVisible").name("显示裂纹爆花").onChange((v) => {
        spangles.visible = v;
    });
    incFolder.add(params, "inclusionSpin", -2.0, 2.0, 0.1).name("内含物自转");

    // Lighting controls
    const envFolder = gui.addFolder("环境与光照");
    envFolder.add(params, "backlightIntensity", 0.0, 25.0, 0.5).name("背光投射强度").onChange((v) => {
        backlight.intensity = v;
    });
    envFolder.addColor(params, "backlightColor").name("背光颜色").onChange((v) => {
        backlight.color.set(v);
    });
    envFolder.add(params, "exposure", 0.2, 3.0, 0.05).name("曝光度").onChange((v) => {
        renderer.toneMappingExposure = v;
    });
    envFolder.add(params, "rotationSpeed", 0.0, 1.5, 0.05).name("琥珀自转速度");
    envFolder.add(params, "lightRotation").name("启用光源轨道绕行");

    matFolder.open();
    incFolder.open();
    envFolder.open();

    // 10. Animation Loop
    const clock = new THREE.Timer();
    clock.connect(document);

    const animate = (timestamp) => {
        animationFrameId = requestAnimationFrame(animate);
        clock.update(timestamp);

        const elapsedTime = clock.getElapsed();

        // 1. Rotate amber mesh slowly
        if (amberMesh) {
            amberMesh.rotation.y = elapsedTime * params.rotationSpeed;
            // Add a subtle wobble
            amberMesh.rotation.x = Math.sin(elapsedTime * 0.3) * 0.15;
            amberMesh.rotation.z = Math.cos(elapsedTime * 0.2) * 0.08;
        }

        // 2. Extra rotative animations for inclusions inside amber (if customized)
        if (inclusionsGroup && params.inclusionSpin !== 0) {
            inclusionsGroup.rotation.y = elapsedTime * params.inclusionSpin;
        }

        // 3. Orbit auxiliary point light around amber
        if (params.lightRotation && lights.orbitLight) {
            lights.orbitLight.position.x = Math.sin(elapsedTime * 1.0) * 3.5;
            lights.orbitLight.position.z = Math.cos(elapsedTime * 1.0) * 3.5;
            lights.orbitLight.position.y = Math.sin(elapsedTime * 0.5) * 1.5 + 0.5;
        }

        controls.update();
        renderer.render(scene, camera);
    };
    animate();

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

    // Clean up amber
    if (amberMesh) {
        // Recursively dispose geometries and materials
        amberMesh.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((m) => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
        });
        scene.remove(amberMesh);
    }

    // Clean up environment
    if (envTexture) {
        envTexture.dispose();
    }

    // Clean up lighting
    Object.values(lights).forEach((light) => scene.remove(light));

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
    background: rgba(22, 15, 10, 0.75); /* Warm amber tint */
    border: 1px solid rgba(255, 184, 51, 0.15);
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    backdrop-filter: blur(12px);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    font-size: 0.9rem;
    font-weight: 600;
    color: #ffb834;
    letter-spacing: 0.05em;
    pointer-events: none;
}

.info-card {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    z-index: 10;
    max-width: 380px;
    background: rgba(22, 15, 10, 0.85); /* Warm amber tint */
    border: 1px solid rgba(255, 184, 51, 0.12);
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
    color: #ffb533;
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
    background: rgba(255, 170, 0, 0.15);
    color: #ffaa00;
    margin-left: 0.5rem;
    font-weight: 500;
}

.divider {
    height: 1px;
    background: rgba(255, 184, 51, 0.1);
    margin: 0.8rem 0;
}

.description {
    color: #cbd5e1 !important;
}

.tip {
    color: #f59e0b !important;
    font-weight: 500;
    margin-top: 0.4rem;
}
</style>
