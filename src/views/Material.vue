<template>
    <div class="demo-container">
        <div class="demo-tag">Demo 04: Materials Playground (材质练习)</div>
        <div ref="containerRef" class="canvas-container"></div>
    </div>
</template>

<script setup>
import GUI from "lil-gui";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { onMounted, onUnmounted, ref } from "vue";

// Import Matcap texture image
import matcapImg from "../assets/textures/matcaps/3.png";

const containerRef = ref(null);
let scene, camera, renderer, controls, gui, animationFrameId;
let sphere, torusKnot, plane;
let ambientLight, pointLight, pointLightHelper;

// Pre-create all materials we want to practice
let materials = {};

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
    camera.position.set(0, 0, 4);

    // 3. Create Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.value.appendChild(renderer.domElement);

    // 4. Add Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 5. Add Lights
    ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    pointLight = new THREE.PointLight(0xffffff, 1.5, 10);
    pointLight.position.set(2, 2, 2);
    scene.add(pointLight);

    // Helper to visualize the light position
    pointLightHelper = new THREE.PointLightHelper(pointLight, 0.1, 0x00f2fe);
    scene.add(pointLightHelper);

    // 6. Setup Textures
    const textureLoader = new THREE.TextureLoader();
    const matcapTexture = textureLoader.load(matcapImg);

    // 7. Define Materials dictionary
    materials = {
        "Basic (基础材质)": new THREE.MeshBasicMaterial({
            color: 0x7c3aed,
            side: THREE.DoubleSide,
        }),
        "Normal (法线材质)": new THREE.MeshNormalMaterial({
            side: THREE.DoubleSide,
        }),
        "Matcap (材质捕获)": new THREE.MeshMatcapMaterial({
            matcap: matcapTexture,
            side: THREE.DoubleSide,
        }),
        "Depth (深度网格)": new THREE.MeshDepthMaterial({
            side: THREE.DoubleSide,
        }),
        "Lambert (兰伯特漫反射)": new THREE.MeshLambertMaterial({
            color: 0x7c3aed,
            side: THREE.DoubleSide,
        }),
        "Phong (冯氏高光)": new THREE.MeshPhongMaterial({
            color: 0x7c3aed,
            shininess: 100,
            specular: new THREE.Color(0x111111),
            side: THREE.DoubleSide,
        }),
        "Toon (卡通渲染)": new THREE.MeshToonMaterial({
            color: 0x7c3aed,
            side: THREE.DoubleSide,
        }),
        "Standard (标准 PBR)": new THREE.MeshStandardMaterial({
            color: 0x7c3aed,
            roughness: 0.3,
            metalness: 0.8,
            side: THREE.DoubleSide,
        }),
        "Physical (物理拟真)": new THREE.MeshPhysicalMaterial({
            color: 0xff007f,
            roughness: 0.1,
            metalness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1,
            transmission: 0.9,
            thickness: 0.8,
            side: THREE.DoubleSide,
            sheen: 1.0, // 光泽强度 / 权重 (0.0 ~ 1.0)
            sheenColor: new THREE.Color(0xffffff), // 光泽反射颜色
            sheenRoughness: 0.5, // 光泽层的粗糙度 (0.0 ~ 1.0)
            iridescence: 1.0, // 虹彩强度 (0.0 ~ 1.0)
            iridescenceIOR: 1.3, // 虹彩折射率 (1.0 ~ 3.0，通常 1.3 左右比较自然)
            iridescenceThicknessRange: [100, 400], // 虹彩薄膜厚度范围（单位纳米，控制干涉出来的颜色变化范围）
        }),
    };

    // 8. Add Geometries to render side by side
    const sphereGeo = new THREE.SphereGeometry(0.7, 64, 64); // 半径 宽度分段 高度分段
    const torusKnotGeo = new THREE.TorusKnotGeometry(0.3, 0.15, 120, 16); // 主半径 次半径 大管道分段 小管道分段
    const planeGeo = new THREE.PlaneGeometry(1.2, 1.2, 32, 32); // 宽 高 宽度分段 高度分段

    // Start with 'Standard' material
    const initialMaterial = materials["Standard (标准 PBR)"];

    sphere = new THREE.Mesh(sphereGeo, initialMaterial);
    sphere.position.x = -1.8;

    torusKnot = new THREE.Mesh(torusKnotGeo, initialMaterial);
    torusKnot.position.x = 0;

    plane = new THREE.Mesh(planeGeo, initialMaterial);
    plane.position.x = 1.8;

    scene.add(sphere, torusKnot, plane);

    // 9. Setup Debug GUI Panel
    gui = new GUI();
    gui.title("材质演练面板");

    // Target values to manage GUI bindings
    const params = {
        activeMaterial: "Standard (标准 PBR)",
        lightIntensity: 1.5,
        lightColor: 0xffffff,
        // Universal controls
        wireframe: false,
        color: 0x7c3aed,
        // Phong specific
        shininess: 100,
        specular: 0x111111,
        // Standard / Physical specific
        roughness: 0.3,
        metalness: 0.8,
        // Physical specific
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        transmission: 0.9,
        thickness: 0.8,
        sheen: 1.0,
        sheenRoughness: 0.5,
        sheenColor: 0xffffff,
        iridescence: 1.0,
        iridescenceIOR: 1.3,
        iridescenceThicknessMin: 100,
        iridescenceThicknessMax: 400,
    };

    // Dropdown to switch material
    gui.add(params, "activeMaterial", Object.keys(materials))
        .name("选择材质类型")
        .onChange((value) => {
            const selectedMat = materials[value];
            sphere.material = selectedMat;
            torusKnot.material = selectedMat;
            plane.material = selectedMat;

            // Update GUI states to match actual properties of selected material
            if (selectedMat.color) {
                selectedMat.color.set(params.color);
            }
            selectedMat.wireframe = params.wireframe;
        });

    // universal controls folder
    const baseFolder = gui.addFolder("通用材质控制");
    baseFolder
        .add(params, "wireframe")
        .name("显示线框")
        .onChange((v) => {
            Object.values(materials).forEach((m) => {
                m.wireframe = v;
            });
        });

    // Custom color binding since MeshDepthMaterial & MeshNormalMaterial don't have color
    baseFolder
        .addColor(params, "color")
        .name("颜色填充")
        .onChange((v) => {
            Object.values(materials).forEach((m) => {
                if (m.color) m.color.set(v);
            });
        });

    // Phong settings folder
    const phongFolder = gui.addFolder("Phong 高光选项");
    phongFolder
        .add(params, "shininess", 0, 300, 1)
        .name("反光亮度 (Shininess)")
        .onChange((v) => {
            materials["Phong (冯氏高光)"].shininess = v;
        });
    phongFolder
        .addColor(params, "specular")
        .name("高光反射色")
        .onChange((v) => {
            materials["Phong (冯氏高光)"].specular.set(v);
        });

    // PBR Standard / Physical controls
    const pbrFolder = gui.addFolder("PBR 材质控制");
    pbrFolder
        .add(params, "roughness", 0, 1, 0.01)
        .name("粗糙度")
        .onChange((v) => {
            materials["Standard (标准 PBR)"].roughness = v;
            materials["Physical (物理拟真)"].roughness = v;
        });
    pbrFolder
        .add(params, "metalness", 0, 1, 0.01)
        .name("金属度")
        .onChange((v) => {
            materials["Standard (标准 PBR)"].metalness = v;
            materials["Physical (物理拟真)"].metalness = v;
        });

    // Physical advanced controls
    const physicalFolder = gui.addFolder("物理拟真 (Physical) 特有属性");
    physicalFolder
        .add(params, "clearcoat", 0, 1, 0.01)
        .name("清漆强度 (Clearcoat)")
        .onChange((v) => {
            materials["Physical (物理拟真)"].clearcoat = v;
        });
    physicalFolder
        .add(params, "clearcoatRoughness", 0, 1, 0.01)
        .name("清漆粗糙度")
        .onChange((v) => {
            materials["Physical (物理拟真)"].clearcoatRoughness = v;
        });
    physicalFolder
        .add(params, "transmission", 0, 1, 0.01)
        .name("透光率 (Transmission)")
        .onChange((v) => {
            materials["Physical (物理拟真)"].transmission = v;
        });
    physicalFolder
        .add(params, "thickness", 0, 5, 0.01)
        .name("折射厚度")
        .onChange((v) => {
            materials["Physical (物理拟真)"].thickness = v;
        });

    physicalFolder
        .add(params, "sheen", 0, 1, 0.01)
        .name("光泽强度 (Sheen)")
        .onChange((v) => {
            materials["Physical (物理拟真)"].sheen = v;
        });
    physicalFolder
        .add(params, "sheenRoughness", 0, 1, 0.01)
        .name("光泽粗糙度")
        .onChange((v) => {
            materials["Physical (物理拟真)"].sheenRoughness = v;
        });
    physicalFolder
        .addColor(params, "sheenColor")
        .name("光泽颜色")
        .onChange((v) => {
            materials["Physical (物理拟真)"].sheenColor.set(v);
        });
    physicalFolder
        .add(params, "iridescence", 0, 1, 0.01)
        .name("彩虹色强度 (Iridescence)")
        .onChange((v) => {
            materials["Physical (物理拟真)"].iridescence = v;
        });
    physicalFolder
        .add(params, "iridescenceIOR", 1, 3, 0.01)
        .name("虹彩折射率 (IOR)")
        .onChange((v) => {
            materials["Physical (物理拟真)"].iridescenceIOR = v;
        });

    // 调整薄膜厚度会改变彩虹色反射的颜色和条纹样式
    const updateIridescenceThickness = () => {
        materials["Physical (物理拟真)"].iridescenceThicknessRange = [
            params.iridescenceThicknessMin,
            params.iridescenceThicknessMax,
        ];
    };
    physicalFolder
        .add(params, "iridescenceThicknessMin", 0, 1000, 1)
        .name("薄膜厚度最小值")
        .onChange(updateIridescenceThickness);
    physicalFolder
        .add(params, "iridescenceThicknessMax", 0, 1000, 1)
        .name("薄膜厚度最大值")
        .onChange(updateIridescenceThickness);

    // Light settings folder
    const lightFolder = gui.addFolder("点光源控制");
    lightFolder.add(pointLight.position, "x", -5, 5, 0.1).name("光源 X");
    lightFolder.add(pointLight.position, "y", -5, 5, 0.1).name("光源 Y");
    lightFolder.add(pointLight.position, "z", -5, 5, 0.1).name("光源 Z");
    lightFolder
        .add(params, "lightIntensity", 0, 5, 0.1)
        .name("光源强度")
        .onChange((v) => {
            pointLight.intensity = v;
        });
    lightFolder
        .addColor(params, "lightColor")
        .name("光源颜色")
        .onChange((v) => {
            pointLight.color.set(v);
        });

    baseFolder.open();
    pbrFolder.open();

    // 10. Animation Loop
    const clock = new THREE.Clock();

    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);

        const elapsedTime = clock.getElapsedTime();

        // Rotate meshes slowly
        sphere.rotation.y = elapsedTime * 0.1;
        torusKnot.rotation.y = elapsedTime * 0.15;
        torusKnot.rotation.x = elapsedTime * 0.05;
        plane.rotation.y = elapsedTime * 0.1;

        // Move the point light in a circular path
        pointLight.position.x = Math.sin(elapsedTime) * 3;
        pointLight.position.z = Math.cos(elapsedTime) * 3;

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

    // 5. Clean up Meshes, Geometries, and Materials
    const meshes = [sphere, torusKnot, plane];
    meshes.forEach((m) => {
        if (m) {
            m.geometry.dispose();
        }
    });

    // Dispose all pre-created materials and loaded textures
    Object.values(materials).forEach((mat) => {
        if (mat.matcap) mat.matcap.dispose();
        mat.dispose();
    });

    if (pointLightHelper) {
        pointLightHelper.dispose();
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
</style>
