<template>
  <div class="home-container">
    <div class="welcome-header">
      <h1 class="welcome-title">
        Three.js <span class="gradient-text">3D 实验空间</span>
      </h1>
      <p class="welcome-subtitle">
        欢迎来到你的 WebGL 3D 实验沙盒。在这里，你可以自由创作、测试和沉淀你的 Three.js Demos，所有实验都在独立的组件中运行，互不干扰。
      </p>

      <div class="action-bar">
        <button class="btn-primary" @click="startLearning">
          <span>进入首个 Demo</span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
          </svg>
        </button>
      </div>
    </div>

    <div class="stats-overview">
      <div class="stat-card">
        <div class="stat-num gradient-text">{{ demos.length }}</div>
        <div class="stat-label">已创建 Demo 数</div>
      </div>
      <div class="stat-card">
        <div class="stat-num gradient-text">Vue 3</div>
        <div class="stat-label">前端开发驱动</div>
      </div>
      <div class="stat-card">
        <div class="stat-num gradient-text">WebGL</div>
        <div class="stat-label">渲染引擎技术</div>
      </div>
    </div>

    <div class="section-title">
      <h2>实验分类指南</h2>
      <p>常用的 Three.js 核心技术实验方向</p>
    </div>

    <div class="path-grid">
      <div v-for="(step, idx) in learningSteps" :key="idx" class="path-card">
        <div class="card-glow" :class="step.color"></div>
        <div class="card-header">
          <span class="card-icon">{{ step.icon }}</span>
          <span class="card-step-num">Step 0{{ idx + 1 }}</span>
        </div>
        <h3>{{ step.title }}</h3>
        <p>{{ step.desc }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useRouter } from "vue-router"
import { demos } from "../router"

const router = useRouter()

const learningSteps = [
  {
    title: "基础与几何体",
    desc: "了解场景 (Scene)、相机 (Camera) 和渲染器 (Renderer)，以及基本几何体形状与变换。",
    icon: "📐",
    color: "from-cyan-400 to-blue-500",
  },
  {
    title: "光影与材质",
    desc: "学习基础材质、纹理贴图、光源类型以及阴影的开启与调优，让 Demo 具有真实感。",
    icon: "💡",
    color: "from-purple-500 to-pink-500",
  },
  {
    title: "交互与控制",
    desc: "使用 OrbitControls 实现场景缩放旋转，利用 Raycaster 实现鼠标点击与物体交互。",
    icon: "🎮",
    color: "from-amber-400 to-orange-500",
  },
  {
    title: "粒子与高级特效",
    desc: "探索粒子系统 (Points)、自定义着色器 (Shaders)、后期处理合成 (Post-Processing)。",
    icon: "✨",
    color: "from-emerald-400 to-teal-500",
  },
]

// eslint-disable-next-line no-unused-vars
const startLearning = () => {
  if (demos.length > 0) {
    router.push(demos[0].path)
  }
}
</script>

<style scoped>
.home-container {
  padding: 4rem 3rem;
  max-width: 1200px;
  margin: 0 auto;
  overflow-y: auto;
  height: 100%;
}

.welcome-header {
  margin-bottom: 4rem;
  max-width: 800px;
}

.welcome-title {
  font-size: 3.5rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin-bottom: 1.5rem;
  line-height: 1.2;
}

.welcome-subtitle {
  font-size: 1.15rem;
  color: var(--text-secondary);
  line-height: 1.8;
  margin-bottom: 2rem;
}

.btn-primary {
  background: var(--primary-gradient);
  color: #030712;
  border: none;
  padding: 0.8rem 1.8rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 20px rgba(0, 242, 254, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(0, 242, 254, 0.5);
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem;
  margin-bottom: 5rem;
}

.stat-card {
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  padding: 2rem;
  border-radius: 12px;
  text-align: center;
  backdrop-filter: blur(8px);
  transition:
    transform 0.3s ease,
    border-color 0.3s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 255, 255, 0.15);
}

.stat-num {
  font-size: 2.5rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.stat-label {
  font-size: 0.9rem;
  color: var(--text-muted);
  font-weight: 500;
}

.section-title {
  margin-bottom: 2.5rem;
}

.section-title h2 {
  font-size: 1.8rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.section-title p {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.path-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 2rem;
  margin-bottom: 4rem;
}

.path-card {
  position: relative;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  padding: 2.5rem 2rem;
  overflow: hidden;
  backdrop-filter: blur(12px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-glow {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(90deg, transparent, transparent);
  transition: all 0.3s ease;
}

.path-card:hover .card-glow {
  background: var(--primary-gradient);
}

.path-card:hover {
  transform: translateY(-6px);
  border-color: rgba(0, 242, 254, 0.3);
  box-shadow: 0 10px 30px -10px rgba(0, 242, 254, 0.15);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.card-icon {
  font-size: 2rem;
}

.card-step-num {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 600;
}

.path-card h3 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.8rem;
}

.path-card p {
  color: var(--text-secondary);
  font-size: 0.9rem;
  line-height: 1.6;
}
</style>
