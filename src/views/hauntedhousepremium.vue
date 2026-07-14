<template>
    <div class="demo-container">
        <div class="demo-tag">Demo 12: Premium Haunted House (升级版鬼屋)</div>
        <div ref="containerRef" class="canvas-container"></div>
        <div class="info-card">
            <h3>💀 升级版 3D 鬼屋与迷雾环境</h3>
            <p>
                <strong>高保真光影:</strong> PCFSoftShadowMap & FogExp2
                <span class="tag">全PBR材质映射</span>
            </p>
            <p>
                <strong>动态环境:</strong>
                烛火晃动、暴雨雷电闪烁、低空流萤迷雾
            </p>
            <div class="divider"></div>
            <p class="description">
                基于 <strong>THREE.Timer</strong> 与最新的着色技术渲染。门口挂灯模拟火光频闪，随机触发云空雷电瞬间投射墓地长影。使用粒子系统生成的低空迷雾，随风在大理石地表流淌。
            </p>
            <div class="divider"></div>
            <div class="badge-container">
                <span class="badge">FogExp2</span>
                <span class="badge">Points Particle</span>
                <span class="badge">Displacement Map</span>
                <span class="badge">Lissajous curve</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import GUI from "lil-gui";

// 声明全局 WebGL 变量（避免 Vue 响应式代理代理这些对象以提升性能）
let scene, camera, renderer, controls, textureLoader, animationFrameId, gui;
let house, floor, walls, roof, door, graves, mist;
let ambientLight, moonLight, doorLight, houseLight, lightningLight;
let ghost1, ghost2, ghost3;
let mistGeometry, mistMaterial;
const count = 220; // 烟雾粒子数量
const positions = new Float32Array(count * 3);
const velocities = new Float32Array(count * 3);

// params GUI 调试参数
const params = {
    enableFlicker: true,
    enableThunder: true,
    enableMist: true,
    cinematicCamera: true,
    fogDensity: 0.12,
    ghostSpeed: 1.0,
    lightningFreq: 6.0, // 秒
};

// canvas 挂载容器
const containerRef = ref(null);

// 辅助方法：生成灰度渐变的烟雾点材质贴图
const createMistTexture = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, "rgba(200, 215, 230, 0.35)");
    gradient.addColorStop(0.3, "rgba(180, 200, 220, 0.15)");
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
};

/**
 * 初始化 Three.js 场景
 */
const initThree = () => {
    if (!containerRef.value) return;

    // 1. 场景与高密度雾气初始化
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2("#090a14", params.fogDensity);

    // 2. 相机初始化
    camera = new THREE.PerspectiveCamera(
        75,
        containerRef.value.clientWidth / containerRef.value.clientHeight,
        0.1,
        1000,
    );
    camera.position.set(0, 3, 9);
    camera.lookAt(0, 1.2, 0);

    // 3. 渲染器初始化并启用阴影映射 (高级软阴影)
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor("#090a14");
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // 开启软阴影
    containerRef.value.appendChild(renderer.domElement);

    // 4. 轨道控制器初始化
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // 限制相机不能穿过地板

    // 5. 加载器初始化
    textureLoader = new THREE.TextureLoader();

    // 5.1 加载 PBR 门贴图
    const doorColorTexture = textureLoader.load("/static/textures/door/color.jpg");
    const doorAlphaTexture = textureLoader.load("/static/textures/door/alpha.jpg");
    const doorAmbientOcclusionTexture = textureLoader.load("/static/textures/door/ambientOcclusion.jpg");
    const doorHeightTexture = textureLoader.load("/static/textures/door/height.jpg");
    const doorMetalnessTexture = textureLoader.load("/static/textures/door/metalness.jpg");
    const doorNormalTexture = textureLoader.load("/static/textures/door/normal.jpg");
    const doorRoughnessTexture = textureLoader.load("/static/textures/door/roughness.jpg");

    // 5.2 加载 PBR 墙壁贴图
    const bricksColorTexture = textureLoader.load("/static/textures/wall/castle_brick_broken_06_1k/castle_brick_broken_06_diff_1k.jpg");
    const bricksNormalTexture = textureLoader.load("/static/textures/wall/castle_brick_broken_06_1k/castle_brick_broken_06_nor_gl_1k.jpg");
    const bricksARMTexture = textureLoader.load("/static/textures/wall/castle_brick_broken_06_1k/castle_brick_broken_06_arm_1k.jpg");

    // 5.3 加载 PBR 地板贴图
    const floorColorTexture = textureLoader.load("/static/textures/floor/coast_sand_rocks_02_1k/coast_sand_rocks_02_diff_1k.jpg");
    const floorNormalTexture = textureLoader.load("/static/textures/floor/coast_sand_rocks_02_1k/coast_sand_rocks_02_nor_gl_1k.jpg");
    const floorARMTexture = textureLoader.load("/static/textures/floor/coast_sand_rocks_02_1k/coast_sand_rocks_02_arm_1k.jpg");

    floorColorTexture.repeat.set(6, 6);
    floorNormalTexture.repeat.set(6, 6);
    floorARMTexture.repeat.set(6, 6);
    floorColorTexture.wrapS = floorColorTexture.wrapT = THREE.RepeatWrapping;
    floorNormalTexture.wrapS = floorNormalTexture.wrapT = THREE.RepeatWrapping;
    floorARMTexture.wrapS = floorARMTexture.wrapT = THREE.RepeatWrapping;

    // 5.4 加载 PBR 屋顶贴图
    const roofColorTexture = textureLoader.load("/static/textures/roof/roof_slates_02_1k/roof_slates_02_diff_1k.jpg");
    const roofNormalTexture = textureLoader.load("/static/textures/roof/roof_slates_02_1k/roof_slates_02_nor_gl_1k.jpg");
    const roofARMTexture = textureLoader.load("/static/textures/roof/roof_slates_02_1k/roof_slates_02_arm_1k.jpg");
    
    roofColorTexture.repeat.set(3, 1);
    roofColorTexture.wrapS = THREE.RepeatWrapping;

    // 5.5 加载 PBR 灌木贴图
    const bushColorTexture = textureLoader.load("/static/textures/bush/leaves_forest_ground_1k/leaves_forest_ground_diff_1k.jpg");
    const bushNormalTexture = textureLoader.load("/static/textures/bush/leaves_forest_ground_1k/leaves_forest_ground_nor_gl_1k.jpg");
    const bushARMTexture = textureLoader.load("/static/textures/bush/leaves_forest_ground_1k/leaves_forest_ground_arm_1k.jpg");

    // 5.6 加载 PBR 墓碑贴图
    const graveColorTexture = textureLoader.load("/static/textures/grave/plastered_stone_wall_1k/plastered_stone_wall_diff_1k.jpg");
    const graveNormalTexture = textureLoader.load("/static/textures/grave/plastered_stone_wall_1k/plastered_stone_wall_nor_gl_1k.jpg");
    const graveARMTexture = textureLoader.load("/static/textures/grave/plastered_stone_wall_1k/plastered_stone_wall_arm_1k.jpg");

    // 6. 3D 物体搭建

    // 6.1 地面 (Floor)
    floor = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 24),
        new THREE.MeshStandardMaterial({
            map: floorColorTexture,
            aoMap: floorARMTexture,
            roughnessMap: floorARMTexture,
            metalnessMap: floorARMTexture,
            normalMap: floorNormalTexture,
        }),
    );
    floor.rotation.x = -Math.PI * 0.5;
    floor.receiveShadow = true;
    // 拷贝并赋予第二套 UV 以应用 AO 贴图
    floor.geometry.setAttribute(
        "uv2",
        new THREE.Float32BufferAttribute(floor.geometry.attributes.uv.array, 2),
    );
    scene.add(floor);

    // 6.2 鬼屋组合 (House Group)
    house = new THREE.Group();
    scene.add(house);

    // 6.2.1 墙壁 (Walls)
    walls = new THREE.Mesh(
        new THREE.BoxGeometry(4, 3, 4),
        new THREE.MeshStandardMaterial({
            map: bricksColorTexture,
            aoMap: bricksARMTexture,
            roughnessMap: bricksARMTexture,
            metalnessMap: bricksARMTexture,
            normalMap: bricksNormalTexture,
        }),
    );
    walls.position.y = 3 * 0.5;
    walls.castShadow = true;
    walls.receiveShadow = true;
    walls.geometry.setAttribute(
        "uv2",
        new THREE.Float32BufferAttribute(walls.geometry.attributes.uv.array, 2),
    );
    house.add(walls);

    // 6.2.2 屋顶 (Roof)
    roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.5, 1.8, 4),
        new THREE.MeshStandardMaterial({
            map: roofColorTexture,
            aoMap: roofARMTexture,
            roughnessMap: roofARMTexture,
            metalnessMap: roofARMTexture,
            normalMap: roofNormalTexture,
        }),
    );
    roof.position.y = 3 + 1.8 * 0.5;
    roof.rotation.y = Math.PI * 0.25;
    roof.castShadow = true;
    roof.geometry.setAttribute(
        "uv2",
        new THREE.Float32BufferAttribute(roof.geometry.attributes.uv.array, 2),
    );
    house.add(roof);

    // 6.2.3 门 (Door - 高分辨率以显示高度位移)
    door = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.2, 100, 100),
        new THREE.MeshStandardMaterial({
            map: doorColorTexture,
            transparent: true,
            alphaMap: doorAlphaTexture,
            aoMap: doorAmbientOcclusionTexture,
            displacementMap: doorHeightTexture,
            displacementScale: 0.12,
            normalMap: doorNormalTexture,
            roughnessMap: doorRoughnessTexture,
            metalnessMap: doorMetalnessTexture,
        }),
    );
    door.geometry.setAttribute(
        "uv2",
        new THREE.Float32BufferAttribute(door.geometry.attributes.uv.array, 2),
    );
    door.position.set(0, 2.2 * 0.5, 2.015); // 微调 Z 防止 Z 轴冲突
    door.castShadow = true;
    house.add(door);

    // 6.2.4 发光窗户 (Windows & Frames)
    const windowMaterial = new THREE.MeshBasicMaterial({ color: "#fca311" }); // 温暖的黄橙色
    const frameMaterial = new THREE.MeshStandardMaterial({ color: "#221611", roughness: 0.8 });

    // 窗户 1（左）
    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.14, 0.05), frameMaterial);
    frameLeft.position.set(-1.2, 1.8, 2.01);
    const windowLeft = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), windowMaterial);
    windowLeft.position.set(-1.2, 1.8, 2.04);
    house.add(frameLeft, windowLeft);

    // 窗户 2（右）
    const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.14, 0.05), frameMaterial);
    frameRight.position.set(1.2, 1.8, 2.01);
    const windowRight = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.1), windowMaterial);
    windowRight.position.set(1.2, 1.8, 2.04);
    house.add(frameRight, windowRight);

    // 6.2.5 灌木丛 (Bushes)
    const bushGeometry = new THREE.SphereGeometry(1, 24, 24);
    const bushMaterial = new THREE.MeshStandardMaterial({
        map: bushColorTexture,
        aoMap: bushARMTexture,
        roughnessMap: bushARMTexture,
        metalnessMap: bushARMTexture,
        normalMap: bushNormalTexture,
    });

    const createBush = (scale, pos) => {
        const mesh = new THREE.Mesh(bushGeometry, bushMaterial);
        mesh.scale.set(scale, scale, scale);
        mesh.position.copy(pos);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.geometry.setAttribute(
            "uv2",
            new THREE.Float32BufferAttribute(mesh.geometry.attributes.uv.array, 2),
        );
        house.add(mesh);
    };

    createBush(0.5, new THREE.Vector3(0.9, 0.2, 2.3));
    createBush(0.28, new THREE.Vector3(1.5, 0.1, 2.2));
    createBush(0.42, new THREE.Vector3(-0.9, 0.2, 2.3));
    createBush(0.18, new THREE.Vector3(-1.4, 0.08, 2.4));

    // 6.3 墓碑组 (Graveyard Graves)
    graves = new THREE.Group();
    scene.add(graves);

    // 生成几种不同外观的墓碑以丰富场景
    const graveRectGeo = new THREE.BoxGeometry(0.55, 0.8, 0.18);
    const graveMaterial = new THREE.MeshStandardMaterial({
        map: graveColorTexture,
        aoMap: graveARMTexture,
        roughnessMap: graveARMTexture,
        metalnessMap: graveARMTexture,
        normalMap: graveNormalTexture,
    });

    for (let i = 0; i < 60; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 3.6 + Math.random() * 7.5; // 不在房子内部，随机摆在环形区域内
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;

        const grave = new THREE.Mesh(graveRectGeo, graveMaterial);
        grave.position.set(x, 0.8 * 0.5 - 0.05, z); // 稍微陷入地下
        grave.rotation.y = (Math.random() - 0.5) * 0.9;
        grave.rotation.z = (Math.random() - 0.5) * 0.15; // 歪歪斜斜的墓碑
        grave.castShadow = true;
        grave.receiveShadow = true;
        grave.geometry.setAttribute(
            "uv2",
            new THREE.Float32BufferAttribute(grave.geometry.attributes.uv.array, 2),
        );
        graves.add(grave);
    }

    // 7. 灯光初始化
    
    // 7.1 暗淡的幽灵环境光
    ambientLight = new THREE.AmbientLight("#181930", 0.08);
    scene.add(ambientLight);

    // 7.2 偏蓝紫的清冷月光 (Directional)
    moonLight = new THREE.DirectionalLight("#868ab8", 0.22);
    moonLight.position.set(4, 9, -5);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 1024;
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.camera.near = 1;
    moonLight.shadow.camera.far = 30;
    moonLight.shadow.camera.top = 12;
    moonLight.shadow.camera.right = 12;
    moonLight.shadow.camera.bottom = -12;
    moonLight.shadow.camera.left = -12;
    scene.add(moonLight);

    // 7.3 门顶闪烁蜡烛灯 (PointLight)
    doorLight = new THREE.PointLight("#ff5500", 1.8, 8);
    doorLight.position.set(0, 2.2, 2.6);
    doorLight.castShadow = true;
    doorLight.shadow.mapSize.width = 512;
    doorLight.shadow.mapSize.height = 512;
    doorLight.shadow.camera.near = 0.1;
    doorLight.shadow.camera.far = 10;
    house.add(doorLight);

    // 7.4 房内温暖溢出灯光 (漏出窗户和门缝)
    houseLight = new THREE.PointLight("#ff8800", 2.2, 7);
    houseLight.position.set(0, 1.4, 0.5);
    houseLight.castShadow = true;
    houseLight.shadow.mapSize.width = 512;
    houseLight.shadow.mapSize.height = 512;
    house.add(houseLight);

    // 7.5 模拟天空雷电的白光
    lightningLight = new THREE.DirectionalLight("#ffffff", 0);
    lightningLight.position.set(-2, 15, -2);
    lightningLight.castShadow = true;
    lightningLight.shadow.mapSize.width = 1024;
    lightningLight.shadow.mapSize.height = 1024;
    scene.add(lightningLight);

    // 7.6 飘游的幽灵彩光
    ghost1 = new THREE.PointLight("#00ff66", 2.5, 4); // 绿
    ghost1.castShadow = true;
    ghost1.shadow.mapSize.width = 256;
    ghost1.shadow.mapSize.height = 256;

    ghost2 = new THREE.PointLight("#ff007f", 2.5, 4); // 桃红
    ghost2.castShadow = true;
    ghost2.shadow.mapSize.width = 256;
    ghost2.shadow.mapSize.height = 256;

    ghost3 = new THREE.PointLight("#00b4d8", 2.5, 4); // 靛蓝
    ghost3.castShadow = true;
    ghost3.shadow.mapSize.width = 256;
    ghost3.shadow.mapSize.height = 256;

    scene.add(ghost1, ghost2, ghost3);

    // 8. 粒子地表迷雾系统
    mistGeometry = new THREE.BufferGeometry();
    
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 2.0 + Math.random() * 9.5;
        
        // 粒子坐标
        positions[i * 3] = Math.sin(angle) * radius;
        positions[i * 3 + 1] = 0.05 + Math.random() * 0.35; // 漂浮在地面0-0.4米的高度
        positions[i * 3 + 2] = Math.cos(angle) * radius;

        // 漂移初速度
        velocities[i * 3] = (Math.random() - 0.5) * 0.06;
        velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.015;
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.06;
    }

    mistGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    
    mistMaterial = new THREE.PointsMaterial({
        size: 0.65,
        sizeAttenuation: true,
        map: createMistTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });

    mist = new THREE.Points(mistGeometry, mistMaterial);
    scene.add(mist);

    // 9. 调试 GUI 控制器
    gui = new GUI();
    gui.title("💀 鬼屋高保真面板");
    gui.add(params, "enableFlicker").name("门灯烛光频闪");
    gui.add(params, "enableThunder").name("暴雨雷电闪烁");
    gui.add(params, "enableMist").name("开启地表粒子雾").onChange((val) => {
        mist.visible = val;
    });
    gui.add(params, "cinematicCamera").name("启用电影级摄像机");
    gui.add(params, "fogDensity", 0.0, 0.3, 0.01).name("环境雾气浓度").onChange((val) => {
        scene.fog.density = val;
    });
    gui.add(params, "ghostSpeed", 0.1, 3.0, 0.1).name("幽灵游走速度");
    gui.add(params, "lightningFreq", 3.0, 15.0, 0.5).name("雷电最大周期(s)");

    // 10. 监听窗口大小变化
    window.addEventListener("resize", handleResize);

    // 11. 启动时钟与 Tick 循环
    const clock = new THREE.Timer();
    clock.connect(document);

    let nextFlashTime = 3.0; // 首次闪电时间
    let flashSequence = [];  // 雷电闪烁帧序列

    const tick = (timestamp) => {
        clock.update(timestamp);
        const elapsedTime = clock.getElapsed();

        // 11.1 幽灵彩光复杂的 3D 浮动动画 (利萨茹曲线运动)
        const speed = params.ghostSpeed;
        const g1Angle = elapsedTime * 0.45 * speed;
        ghost1.position.x = Math.sin(g1Angle) * (4.5 + Math.sin(elapsedTime * 0.3) * 1.5);
        ghost1.position.z = Math.cos(g1Angle) * (4.5 + Math.sin(elapsedTime * 0.3) * 1.5);
        ghost1.position.y = 0.25 + Math.sin(elapsedTime * 2.2 * speed) * 0.4;

        const g2Angle = -elapsedTime * 0.33 * speed;
        ghost2.position.x = Math.sin(g2Angle) * (6.0 + Math.cos(elapsedTime * 0.4) * 2.0);
        ghost2.position.z = Math.cos(g2Angle) * (5.5 + Math.sin(elapsedTime * 0.2) * 1.5);
        ghost2.position.y = 0.3 + Math.sin(elapsedTime * 1.6 * speed) * 0.5 + Math.cos(elapsedTime * 2.8 * speed) * 0.25;

        const g3Angle = elapsedTime * 0.22 * speed;
        ghost3.position.x = Math.sin(g3Angle) * 8.2;
        ghost3.position.z = Math.cos(g3Angle * 1.8) * 6.5;
        ghost3.position.y = 0.2 + Math.sin(elapsedTime * 3.1 * speed) * 0.35;

        // 11.2 门灯烛火波动 (多组正弦与随机噪点叠加)
        if (params.enableFlicker) {
            doorLight.intensity = 1.6 + 
                Math.sin(elapsedTime * 18.0) * 0.5 + 
                Math.sin(elapsedTime * 36.0) * 0.2 + 
                (Math.random() - 0.5) * 0.22;
        } else {
            doorLight.intensity = 1.8;
        }

        // 11.3 暴风雨雷电闪烁处理
        if (params.enableThunder) {
            // 到达雷电触发时间，生成双闪电脉冲序列
            if (elapsedTime > nextFlashTime) {
                nextFlashTime = elapsedTime + 4.0 + Math.random() * params.lightningFreq;
                flashSequence = [
                    { time: elapsedTime, intensity: 6.0 },
                    { time: elapsedTime + 0.08, intensity: 0 },
                    { time: elapsedTime + 0.14, intensity: 8.5 },
                    { time: elapsedTime + 0.45, intensity: 0 }
                ];
            }

            // 读取并应用雷电强度
            let currentLightIntensity = 0;
            if (flashSequence.length > 0) {
                for (let i = flashSequence.length - 1; i >= 0; i--) {
                    if (elapsedTime >= flashSequence[i].time) {
                        currentLightIntensity = flashSequence[i].intensity;
                        break;
                    }
                }
                // 超出最后一帧的闪烁时间，清空序列
                if (elapsedTime > flashSequence[flashSequence.length - 1].time + 0.2) {
                    flashSequence = [];
                }
            }
            lightningLight.intensity = currentLightIntensity;
        } else {
            lightningLight.intensity = 0;
        }

        // 11.4 地表迷雾粒子模拟漂移
        if (params.enableMist) {
            const posArr = mistGeometry.attributes.position.array;
            for (let i = 0; i < count; i++) {
                // 叠加微风吹动
                posArr[i * 3] += velocities[i * 3] * 0.16;
                posArr[i * 3 + 1] += velocities[i * 3 + 1] * 0.16;
                posArr[i * 3 + 2] += velocities[i * 3 + 2] * 0.16;

                // 产生起伏波浪感
                posArr[i * 3 + 1] += Math.sin(elapsedTime * 2.0 + i) * 0.001;

                // 边界重置：超出半径或者越界时自动回归另一侧
                const dx = posArr[i * 3];
                const dz = posArr[i * 3 + 2];
                const distance = Math.sqrt(dx * dx + dz * dz);
                if (distance > 11.5 || posArr[i * 3 + 1] < 0.0 || posArr[i * 3 + 1] > 0.5) {
                    const freshAngle = Math.random() * Math.PI * 2;
                    const freshRadius = 1.0 + Math.random() * 8.0;
                    posArr[i * 3] = Math.sin(freshAngle) * freshRadius;
                    posArr[i * 3 + 1] = 0.05 + Math.random() * 0.35;
                    posArr[i * 3 + 2] = Math.cos(freshAngle) * freshRadius;
                }
            }
            mistGeometry.attributes.position.needsUpdate = true;
        }

        // 11.5 电影运镜模式
        if (params.cinematicCamera) {
            const camAngle = elapsedTime * 0.04;
            camera.position.x = Math.sin(camAngle) * 9.5;
            camera.position.z = Math.cos(camAngle) * 9.5;
            camera.position.y = 3.5 + Math.sin(elapsedTime * 0.08) * 1.5;
            camera.lookAt(0, 1.3, 0);
        }

        // 11.6 控制器阻尼更新与渲染
        if (!params.cinematicCamera && controls) {
            controls.update();
        }
        renderer.render(scene, camera);

        // 循环 tick
        animationFrameId = requestAnimationFrame(tick);
    };
    tick();
};

/**
 * 窗口尺寸自适应
 */
const handleResize = () => {
    if (!containerRef.value || !renderer || !camera) return;
    const width = containerRef.value.clientWidth;
    const height = containerRef.value.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
};

// 生命周期：挂载启动
onMounted(() => {
    initThree();
});

// 生命周期：组件卸载，严格释放资源防内存溢出
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

    // 释放地表粒子资源
    if (mistGeometry) mistGeometry.dispose();
    if (mistMaterial) mistMaterial.dispose();

    // 释放房屋、地面资源
    const cleanMesh = (mesh) => {
        if (!mesh) return;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach((m) => m.dispose());
            } else {
                mesh.material.dispose();
            }
        }
    };

    cleanMesh(floor);
    cleanMesh(walls);
    cleanMesh(roof);
    cleanMesh(door);

    if (graves) {
        graves.children.forEach(cleanMesh);
    }

    // 销毁并断开渲染器
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
    background: #090a14;
    font-family: "Outfit", "Inter", system-ui, sans-serif;
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
    background: rgba(14, 18, 30, 0.72);
    border: 1px solid rgba(225, 29, 72, 0.2);
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    backdrop-filter: blur(12px);
    box-shadow:
        0 4px 30px rgba(0, 0, 0, 0.6),
        0 0 15px rgba(225, 29, 72, 0.05);
    font-size: 0.9rem;
    font-weight: 600;
    color: #f43f5e; /* Crimson red accent */
    letter-spacing: 0.05em;
    pointer-events: none;
}

.info-card {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    z-index: 10;
    max-width: 400px;
    background: rgba(10, 12, 22, 0.82); /* Graveyard dark black-blue */
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 1.6rem;
    border-radius: 14px;
    backdrop-filter: blur(20px);
    box-shadow:
        0 15px 40px rgba(0, 0, 0, 0.85),
        0 0 30px rgba(244, 63, 94, 0.04);
    color: #f8fafc;
    pointer-events: auto;
}

.info-card h3 {
    margin: 0 0 0.8rem 0;
    font-size: 1.2rem;
    color: #f43f5e;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 700;
    letter-spacing: 0.02em;
}

.info-card p {
    font-size: 0.85rem;
    margin: 0 0 0.6rem 0;
    color: #e2e8f0;
    line-height: 1.6;
}

.tag {
    font-size: 0.72rem;
    padding: 0.15rem 0.45rem;
    border-radius: 4px;
    background: rgba(244, 63, 94, 0.12);
    color: #fda4af;
    border: 1px solid rgba(244, 63, 94, 0.22);
    margin-left: 0.5rem;
    font-weight: 600;
}

.divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.08);
    margin: 1rem 0;
}

.description {
    color: #94a3b8 !important;
}

.badge-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    margin-top: 0.2rem;
}

.badge {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    background: rgba(255, 255, 255, 0.04);
    color: #cbd5e1;
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-weight: 500;
}
</style>
