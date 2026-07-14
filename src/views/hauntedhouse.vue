<template>
    <div class="demo-container">
        <div class="demo-tag">Demo 11: Haunted House (鬼屋)</div>
        <div ref="containerRef" class="canvas-container"></div>
        <!-- <div class="info-card">
            <h3>💀 3D 鬼屋与迷雾环境</h3>
            <p>
                <strong>环境光影 (Shadows):</strong> Shadow Map
                <span class="tag">PCSS 阴影</span>
            </p>
            <p>
                <strong>氛围要素 (Elements):</strong>
                迷雾、墓碑、南瓜灯与鬼屋建筑
            </p>
            <div class="divider"></div>
            <p class="description">
                基于 Three.js 的 <strong>阴影贴图 (Shadow Map)</strong> 与
                <strong>指数雾 (FogExp2)</strong>
                技术，渲染出充满迷雾、阴森恐怖的经典鬼屋场景。利用点光源模拟飘忽不定的南瓜灯微光，实现墓地阴影的动态投射。
            </p>
            <p class="tip">
                💡 提示：在 Script
                中练习加载门、墙壁、屋顶、墓碑的纹理贴图（Color, Roughness,
                Normal, AO），并开启阴影投射以获得真实的恐怖氛围！
            </p>
        </div> -->
    </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import GUI from "lil-gui";

// 声明全局 WebGL 变量（避免 Vue 响应式代理代理这些对象以提升性能）
let scene, camera, renderer, controls, textureLoader, animationFrameId, gui;
let house, floor, walls, roof, door, graves;

// canvas 挂载容器
const containerRef = ref(null);

/**
 * 初始化 Three.js 场景
 */
const initThree = () => {
    if (!containerRef.value) return;

    // 1. 场景初始化
    scene = new THREE.Scene();
    scene.background = new THREE.Color("#0c101b");

    // 2. 相机初始化
    camera = new THREE.PerspectiveCamera(
        75,
        containerRef.value.clientWidth / containerRef.value.clientHeight,
        0.1,
        1000,
    );
    camera.position.set(0, 3, 6);
    camera.lookAt(0, 0, 0);

    // 3. 渲染器初始化并挂载 DOM
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(
        containerRef.value.clientWidth,
        containerRef.value.clientHeight,
    );
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.value.appendChild(renderer.domElement);

    // 4. 轨道控制器初始化
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // 启用阻尼感，让旋转更平滑

    // 5. 加载器初始化
    textureLoader = new THREE.TextureLoader();

    // 6. 添加 3D 物体 (后续你可以在此继续练习)
    // 地面 (Floor)
    floor = new THREE.Mesh(
        new THREE.PlaneGeometry(20, 20),
        new THREE.MeshStandardMaterial({ color: "#a9c388" }),
    );
    floor.rotation.x = -Math.PI * 0.5;
    scene.add(floor);

    // 鬼屋分组 (House Group)
    house = new THREE.Group();
    scene.add(house);

    // 墙壁
    walls = new THREE.Mesh(
        new THREE.BoxGeometry(4, 2.5, 4), //  宽度x、高度y、深度z
        new THREE.MeshStandardMaterial({ color: "#ac8eb2" }),
    );
    walls.position.y = 2.5 * 0.5;
    house.add(walls);

    // 屋顶
    roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.5, 1, 4),
        new THREE.MeshStandardMaterial({ color: "#b35f45" }),
    );

    roof.position.y = 2.5 + 1 * 0.5;
    roof.rotation.y = Math.PI * 0.25;
    house.add(roof);

    //  门
    door = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.MeshStandardMaterial({ color: "#aa7b7b" }),
    );
    door.position.y = 1;
    door.position.z = 2; // 出现z轴冲突 (两个平面在争夺谁在上面 就会这样)
    door.position.z = 2.01; // 再往z轴正半轴移动0.01 以解除Z轴冲突
    house.add(door);

    // 1. 创建一份共享的几何体和材质
    const bushGeometry = new THREE.SphereGeometry(1, 16, 16);
    const bushMaterial = new THREE.MeshStandardMaterial({ color: "#89c854" });

    // 2. 创建第一个灌木丛 (大)
    const bush1 = new THREE.Mesh(bushGeometry, bushMaterial);
    bush1.scale.set(0.5, 0.5, 0.5); // 缩放
    bush1.position.set(0.8, 0.2, 2.2); // 位置

    // 3. 创建第二个灌木丛 (中)
    const bush2 = new THREE.Mesh(bushGeometry, bushMaterial);
    bush2.scale.set(0.25, 0.25, 0.25);
    bush2.position.set(1.4, 0.1, 2.1);

    // 4. 创建第三个灌木丛 (小)
    const bush3 = new THREE.Mesh(bushGeometry, bushMaterial);
    bush3.scale.set(0.4, 0.4, 0.4);
    bush3.position.set(-0.8, 0.1, 2.2);

    // 5. 创建第四个灌木丛
    const bush4 = new THREE.Mesh(bushGeometry, bushMaterial);
    bush4.scale.set(0.15, 0.15, 0.15);
    bush4.position.set(-1, 0.05, 2.6);

    house.add(bush1, bush2, bush3, bush4);

    // 墓碑
    graves = new THREE.Group(); // 新组
    scene.add(graves);

    const graveGeometry = new THREE.BoxGeometry(0.6, 0.8, 0.2);
    const graveMaterial = new THREE.MeshStandardMaterial({ color: "#b2b6b1" });

    // 墓碑的位置有讲究
    // 1、位置远点但是又不能超出floor
    // 2、墓碑不能在房子内
    // 3、墓碑不能重叠
    // 4、墓碑的朝向随机角度
    // 5、将墓碑的位置定位在房子周围的圆上

    for (let i = 0; i < 50; i++) {
        const angle = Math.random() * Math.PI * 2;
        // 圆半径需要大于的房子 但是有小于floor 不在里面 不在外面的 随机
        const radius = 3 + Math.random() * 6;
        const x = Math.sin(angle) * radius;
        const z = Math.cos(angle) * radius;

        const grave = new THREE.Mesh(graveGeometry, graveMaterial);
        grave.position.set(x, 0.3, z);
        grave.rotation.y = (Math.random() - 0.5) * 0.8;
        grave.rotation.z = (Math.random() - 0.5) * 0.8;
        graves.add(grave);
    }

    // 7. 灯光初始化
    // 环境光 (Ambient Light)
    const ambientLight = new THREE.AmbientLight("b9d5ff", 0.12);
    scene.add(ambientLight);

    // 月光
    const moonLight = new THREE.DirectionalLight("#b9d5ff", 0.12);
    moonLight.position.set(4, 5, -2);
    scene.add(moonLight);

    // 门顶灯
    const doorLight = new THREE.PointLight("#ff7d46", 1, 7); // 点光源 光颜色 光线的强度以坎德拉为单位来衡量 光线的最大照射范围
    // 计算公式：光源的实际发光强度由 颜色 × 强度 (intensity) 决定
    // 物理模式 (Physically Correct)：在较新的 Three.js 版本中默认开启此模式。在此模式下，光照强度属性（intensity）直接以坎德拉（cd）为单位
    // 满月夜：约 0.5 cd 普通客厅：约 50 cd 室内办公室：约 350 cd 直射阳光：约 50,000 cd
    doorLight.position.set(0, 2.2, 2.7);
    house.add(doorLight);

    // 8. 调试面板初始化
    gui = new GUI();
    gui.title("Nice debug UI");

    gui.add(ambientLight, "intensity")
        .min(0)
        .max(5)
        .step(0.01)
        .name("环境光强度");

    gui.add(moonLight, "intensity").min(0).max(5).step(0.01).name("月光强度");
    gui.add(moonLight.position, "x").min(-5).max(5).step(0.001);
    gui.add(moonLight.position, "y").min(-5).max(5).step(0.001);
    gui.add(moonLight.position, "z").min(-5).max(5).step(0.001);

    // 9. 监听窗口大小变化
    window.addEventListener("resize", handleResize);

    // 10. 启动动画帧循环 (Tick)
    const tick = () => {
        // 更新控制器阻尼
        if (controls) controls.update();

        // 执行渲染
        renderer.render(scene, camera);

        // 递归循环
        animationFrameId = requestAnimationFrame(tick);
    };
    tick();
};

/**
 * 窗口尺寸改变自适应
 */
const handleResize = () => {
    if (!containerRef.value || !renderer || !camera) return;
    const width = containerRef.value.clientWidth;
    const height = containerRef.value.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
};

// 生命周期：挂载后初始化
onMounted(() => {
    initThree();
});

// 生命周期：卸载前释放资源防止内存泄漏
onUnmounted(() => {
    // 1. 注销事件监听
    window.removeEventListener("resize", handleResize);

    // 2. 停止动画帧循环
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    // 3. 销毁轨道控制器
    if (controls) {
        controls.dispose();
    }

    // 4. 释放网格资源（几何体与材质）
    if (floor) {
        floor.geometry.dispose();
        floor.material.dispose();
    }

    // 5. 销毁渲染器并移除 DOM 节点
    if (renderer) {
        renderer.dispose();
        renderer.domElement?.parentNode?.removeChild(renderer.domElement);
    }

    // 6. 销毁调试面板
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
    background: #030712;
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
    background: rgba(10, 18, 16, 0.8); /* Dark ghostly teal tint */
    border: 1px solid rgba(0, 255, 200, 0.25);
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    backdrop-filter: blur(12px);
    box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.5),
        0 0 15px rgba(0, 255, 200, 0.05);
    font-size: 0.9rem;
    font-weight: 600;
    color: #00ffcc; /* Ghostly neon green/cyan */
    letter-spacing: 0.05em;
    pointer-events: none;
}

.info-card {
    position: absolute;
    bottom: 2rem;
    left: 2rem;
    z-index: 10;
    max-width: 380px;
    background: rgba(12, 16, 22, 0.88); /* Deep graveyard navy-black */
    border: 1px solid rgba(0, 255, 200, 0.15);
    padding: 1.5rem;
    border-radius: 12px;
    backdrop-filter: blur(20px);
    box-shadow:
        0 10px 40px rgba(0, 0, 0, 0.7),
        0 0 20px rgba(0, 255, 200, 0.05);
    color: #f8fafc;
    pointer-events: auto;
}

.info-card h3 {
    margin-bottom: 0.8rem;
    font-size: 1.15rem;
    color: #00ffcc; /* Ghostly accent */
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.info-card p {
    font-size: 0.85rem;
    margin-bottom: 0.6rem;
    color: #cbd5e1;
    line-height: 1.55;
}

.tag {
    font-size: 0.75rem;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    background: rgba(139, 92, 246, 0.15); /* Mysterious purple */
    color: #a78bfa;
    border: 1px solid rgba(139, 92, 246, 0.25);
    margin-left: 0.5rem;
    font-weight: 500;
}

.divider {
    height: 1px;
    background: rgba(0, 255, 200, 0.1);
    margin: 0.8rem 0;
}

.description {
    color: #94a3b8 !important;
}

.tip {
    color: #a78bfa !important; /* Spooky purple for tips */
    font-weight: 500;
    margin-top: 0.4rem;
}
</style>
