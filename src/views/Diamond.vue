<template>
    <div class="demo-container">
        <div class="demo-tag">Demo 05: Diamond Sandbox (钻石光学模拟)</div>
        <div ref="containerRef" class="canvas-container"></div>
        <div class="info-card">
            <h3>💎 钻石物理光学模拟</h3>
            <p><strong>折射率 (IOR):</strong> 2.417 <span class="tag">高折射率</span></p>
            <p><strong>色散值 (Dispersion):</strong> 0.15 <span class="tag">彩虹火彩</span></p>
            <div class="divider"></div>
            <p class="description">
                基于 Three.js v0.184.0 的 <code>MeshPhysicalMaterial</code> 物理高光与色散特性，模拟钻石在环绕光源与烘焙环境贴图下的色散效果。
            </p>
            <p class="tip">💡 提示：可以在右侧面板调整 IOR 和色散强度，观察不同的火彩表现！</p>
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
let diamondMesh;
let lights = [];
let envTexture;

// Helper to create a Brilliant-Cut Diamond Geometry
const createBrilliantDiamondGeometry = () => {
    const vertices = [];
    
    // Culet (bottom point)
    const culet = [0, -0.9, 0];
    
    // Girdle: 16 points at y=0, radius=1.0
    const girdle = [];
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        girdle.push([Math.cos(angle), 0, Math.sin(angle)]);
    }
    
    // Crown: 8 points at y=0.35, radius=0.75
    const crown = [];
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        crown.push([Math.cos(angle) * 0.75, 0.35, Math.sin(angle) * 0.75]);
    }
    
    // Table: 8 points at y=0.5, radius=0.45
    const table = [];
    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        table.push([Math.cos(angle) * 0.45, 0.5, Math.sin(angle) * 0.45]);
    }

    const pushTriangle = (p1, p2, p3) => {
        vertices.push(...p1, ...p2, ...p3);
    };

    const pushQuad = (p1, p2, p3, p4) => {
        pushTriangle(p1, p2, p3);
        pushTriangle(p1, p3, p4);
    };

    // 1. Pavilion facets (from culet to girdle)
    for (let i = 0; i < 16; i++) {
        const g1 = girdle[i];
        const g2 = girdle[(i + 1) % 16];
        pushTriangle(culet, g2, g1);
    }

    // 2. Upper girdle facets (from girdle to crown)
    for (let i = 0; i < 8; i++) {
        const c1 = crown[i];
        const c2 = crown[(i + 1) % 8];
        const g1 = girdle[i * 2];
        const g2 = girdle[i * 2 + 1];
        const g3 = girdle[(i * 2 + 2) % 16];

        // Facets connecting girdle segments to crown segments
        pushTriangle(g1, g2, c1);
        pushTriangle(g2, g3, c2);
        pushTriangle(g2, c2, c1);
    }

    // 3. Crown facets (from crown to table)
    for (let i = 0; i < 8; i++) {
        const c1 = crown[i];
        const c2 = crown[(i + 1) % 8];
        const t1 = table[i];
        const t2 = table[(i + 1) % 8];

        pushQuad(c1, c2, t2, t1);
    }

    // 4. Table facet (cap at top)
    const tableCenter = [0, 0.5, 0];
    for (let i = 0; i < 8; i++) {
        const t1 = table[i];
        const t2 = table[(i + 1) % 8];
        pushTriangle(tableCenter, t1, t2);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return geometry;
};

// Create a colourful procedural HDR Environment Map
const createProceduralEnvMap = (renderer) => {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");

    // Dark mysterious background
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#030712");
    grad.addColorStop(0.5, "#0b1528");
    grad.addColorStop(1, "#02040a");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glowing bright abstract spots (essential for dispersion reflections)
    const colors = ["#ff003c", "#00f2fe", "#7c3aed", "#ff007f", "#ffffff", "#00ffcc", "#ffbb00"];
    for (let i = 0; i < 25; i++) {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;
        const radius = Math.random() * 60 + 10;

        const radialGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
        radialGrad.addColorStop(0, colors[i % colors.length]);
        radialGrad.addColorStop(0.2, colors[(i + 1) % colors.length] + "88");
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
    scene.background = new THREE.Color("#060a13");

    // 2. Create Camera
    camera = new THREE.PerspectiveCamera(
        50,
        containerRef.value.clientWidth / containerRef.value.clientHeight,
        0.1,
        1000
    );
    camera.position.set(0, 1.2, 3);

    // 3. Create Renderer with correct tone mapping settings for physical refraction
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    containerRef.value.appendChild(renderer.domElement);

    // 4. Add Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't look too far from below

    // 5. Generate and Set Procedural Environment Map
    envTexture = createProceduralEnvMap(renderer);
    scene.environment = envTexture;

    // 6. Setup Diamond Geometry & Physical Material
    const diamondGeo = createBrilliantDiamondGeometry();
    const diamondMat = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.0,
        roughness: 0.0,
        ior: 2.417,             // Diamond refractive index
        transmission: 1.0,     // High transparency
        thickness: 1.5,        // Refraction depth
        flatShading: true,     // Faceted look
        clearcoat: 1.0,
        clearcoatRoughness: 0.0,
        dispersion: 0.15,      // Rainbow fire effect (dispersion)
        side: THREE.DoubleSide
    });

    diamondMesh = new THREE.Mesh(diamondGeo, diamondMat);
    scene.add(diamondMesh);

    // Add a shadow receiver plane at the bottom
    const shadowPlaneGeo = new THREE.PlaneGeometry(10, 10);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.1;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // 7. Add Lights (glowing points orbiting to create sparkling highlights)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 7);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Additional colored spot lights to emphasize dispersion
    const spotLight1 = new THREE.PointLight(0xff00cc, 4, 15);
    spotLight1.position.set(-3, 3, 2);
    scene.add(spotLight1);
    lights.push(spotLight1);

    const spotLight2 = new THREE.PointLight(0x00f2fe, 4, 15);
    spotLight2.position.set(3, 3, -2);
    scene.add(spotLight2);
    lights.push(spotLight2);

    // 8. Debug GUI Setup
    gui = new GUI();
    gui.title("钻石渲染控制面板");

    const params = {
        // Material Params
        ior: 2.417,
        dispersion: 0.15,
        color: "#ffffff",
        roughness: 0.0,
        transmission: 1.0,
        thickness: 1.5,
        flatShading: true,
        // Environment & Rotation
        exposure: 1.2,
        rotationSpeed: 0.2,
        lightRotation: true,
        geometry: "Brilliant (标准切工)"
    };

    // Material folder
    const matFolder = gui.addFolder("钻石材质选项");
    matFolder.add(params, "ior", 1.0, 3.0, 0.001).name("折射率 (IOR)").onChange((v) => {
        diamondMat.ior = v;
    });
    matFolder.add(params, "dispersion", 0.0, 1.0, 0.01).name("色散火彩").onChange((v) => {
        diamondMat.dispersion = v;
    });
    matFolder.addColor(params, "color").name("底色颜色").onChange((v) => {
        diamondMat.color.set(v);
    });
    matFolder.add(params, "roughness", 0.0, 1.0, 0.01).name("表面粗糙度").onChange((v) => {
        diamondMat.roughness = v;
    });
    matFolder.add(params, "transmission", 0.0, 1.0, 0.01).name("透光率").onChange((v) => {
        diamondMat.transmission = v;
    });
    matFolder.add(params, "thickness", 0.0, 5.0, 0.01).name("折射厚度").onChange((v) => {
        diamondMat.thickness = v;
    });
    matFolder.add(params, "flatShading").name("切面效果 (Flat)").onChange((v) => {
        diamondMat.flatShading = v;
        diamondMat.needsUpdate = true;
    });

    // Geometry Switcher
    const geometries = {
        "Brilliant (标准切工)": diamondGeo,
        "Icosahedron (20面体)": new THREE.IcosahedronGeometry(1.0, 0),
        "Icosahedron (80面体)": new THREE.IcosahedronGeometry(1.0, 1),
        "Octahedron (8面体)": new THREE.OctahedronGeometry(1.0, 0),
        "TorusKnot (试验扭结)": new THREE.TorusKnotGeometry(0.5, 0.2, 100, 16)
    };

    matFolder.add(params, "geometry", Object.keys(geometries)).name("几何形状").onChange((v) => {
        const oldGeo = diamondMesh.geometry;
        diamondMesh.geometry = geometries[v];
        // Dispose of custom created geometry to avoid leak
        if (oldGeo !== diamondGeo && oldGeo.dispose) {
            oldGeo.dispose();
        }
    });

    // Env folder
    const envFolder = gui.addFolder("环境与光照");
    envFolder.add(params, "exposure", 0.1, 3.0, 0.1).name("画面曝光度").onChange((v) => {
        renderer.toneMappingExposure = v;
    });
    envFolder.add(params, "rotationSpeed", 0.0, 1.0, 0.01).name("钻石旋转速度");
    envFolder.add(params, "lightRotation").name("启用光源环绕");

    matFolder.open();
    envFolder.open();

    // 9. Animation Loop
    const clock = new THREE.Timer();
    clock.connect(document);

    const animate = (timestamp) => {
        animationFrameId = requestAnimationFrame(animate);
        clock.update(timestamp);

        const elapsedTime = clock.getElapsed();

        // Rotate diamond slowly
        if (diamondMesh) {
            diamondMesh.rotation.y = elapsedTime * params.rotationSpeed;
            // Wobble slightly
            diamondMesh.rotation.x = Math.sin(elapsedTime * 0.5) * 0.1;
        }

        // Orbit point lights around diamond
        if (params.lightRotation) {
            lights[0].position.x = Math.sin(elapsedTime * 0.8) * 3;
            lights[0].position.z = Math.cos(elapsedTime * 0.8) * 3;
            lights[0].position.y = Math.sin(elapsedTime * 0.4) * 2 + 1;

            lights[1].position.x = -Math.sin(elapsedTime * 0.8) * 3;
            lights[1].position.z = -Math.cos(elapsedTime * 0.8) * 3;
            lights[1].position.y = Math.cos(elapsedTime * 0.4) * 2 + 1;
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

    // Clean up diamond
    if (diamondMesh) {
        diamondMesh.geometry.dispose();
        diamondMesh.material.dispose();
    }

    // Clean up environments
    if (envTexture) {
        envTexture.dispose();
    }

    // Clean up other point lights
    lights.forEach(light => scene.remove(light));

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

.info-card {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    z-index: 10;
    max-width: 380px;
    background: rgba(13, 20, 35, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 1.5rem;
    border-radius: 12px;
    backdrop-filter: blur(20px);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    color: var(--text-primary);
    pointer-events: auto;
}

.info-card h3 {
    margin-bottom: 0.8rem;
    font-size: 1.15rem;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.info-card p {
    font-size: 0.85rem;
    margin-bottom: 0.6rem;
    color: var(--text-secondary);
    line-height: 1.5;
}

.info-card ul {
    margin-left: 1.2rem;
    margin-top: 0.4rem;
    font-size: 0.8rem;
    color: var(--text-muted);
}

.info-card ul li {
    margin-bottom: 0.3rem;
}

.tag {
    font-size: 0.75rem;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: rgba(0, 242, 254, 0.1);
    color: var(--primary-color);
    margin-left: 0.5rem;
    font-weight: 500;
}

.divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 0.8rem 0;
}

.description {
    color: var(--text-muted) !important;
}

.tip {
    color: #f59e0b !important;
    font-weight: 500;
}
</style>
