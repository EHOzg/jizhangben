<template>
  <div class="app-layout">
    <!-- Sidebar Navigation -->
    <aside class="sidebar">
      <div class="sidebar-header" @click="router.push('/')">
        <div class="logo-icon"></div>
        <div class="logo-text">
          <span class="logo-title">Three.js</span>
          <span class="logo-subtitle">Demo Space</span>
        </div>
      </div>

      <nav class="sidebar-nav">
        <router-link
          to="/"
          class="nav-item home-link"
          :class="{ active: isActive('/') }"
        >
          <span class="nav-icon">📊</span>
          <span class="nav-label">控制面板</span>
        </router-link>

        <div class="nav-section-title">我的 3D 实验 (Demos)</div>

        <div class="demos-list">
          <router-link
            v-for="demo in demos"
            :key="demo.path"
            :to="demo.path"
            class="nav-item demo-link"
            :class="{ active: isActive(demo.path) }"
          >
            <div class="active-indicator"></div>
            <div class="demo-info">
              <span class="demo-title">{{ demo.meta.title }}</span>
              <span class="demo-desc">{{ demo.meta.description }}</span>
            </div>
          </router-link>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="tech-badge">
          <span class="tech-dot active"></span>
          <span>Three.js v0.184.0</span>
        </div>
        <div class="tech-badge">
          <span class="tech-dot active"></span>
          <span>Vue 3 + Vite</span>
        </div>
      </div>
    </aside>

    <!-- Main View Area -->
    <main class="main-content">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<script setup>
import { computed } from "vue"
import { useRouter, useRoute } from "vue-router"
import { demos } from "./router"

const router = useRouter()
const route = useRoute()

// Check if a route path is currently active
const isActive = (path) => {
  return route.path === path
}
</script>

<style scoped>
.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background-color: var(--bg-color);
}

/* Sidebar Styling */
.sidebar {
  width: 280px;
  height: 100%;
  background: var(--bg-sidebar);
  border-right: 1px solid var(--border-color);
  backdrop-filter: blur(20px);
  display: flex;
  flex-direction: column;
  z-index: 100;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 1.8rem 1.5rem;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.sidebar-header:hover {
  opacity: 0.9;
}

.logo-icon {
  width: 32px;
  height: 32px;
  background: var(--primary-gradient);
  border-radius: 8px;
  position: relative;
  box-shadow: 0 0 15px rgba(0, 242, 254, 0.4);
}

.logo-icon::after {
  content: "";
  position: absolute;
  top: 25%;
  left: 25%;
  width: 50%;
  height: 50%;
  border: 2px solid #030712;
  border-radius: 3px;
  transform: rotate(45deg);
}

.logo-text {
  display: flex;
  flex-direction: column;
}

.logo-title {
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--text-primary);
}

.logo-subtitle {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.sidebar-nav {
  flex: 1;
  padding: 1.5rem 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-item {
  display: flex;
  align-items: center;
  padding: 0.8rem 1rem;
  border-radius: 8px;
  color: var(--text-secondary);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.nav-item:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.04);
}

.home-link {
  gap: 0.8rem;
  font-weight: 500;
  margin-bottom: 1rem;
  border: 1px solid transparent;
}

.home-link.active {
  background: var(--glass-bg);
  border-color: var(--glass-border);
  color: var(--primary-color);
  box-shadow: var(--glass-shadow);
}

.nav-section-title {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.1em;
  padding-left: 1rem;
  margin-bottom: 0.5rem;
}

.demos-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.demo-link {
  padding: 0.8rem 1rem;
  align-items: flex-start;
  gap: 0.5rem;
}

.active-indicator {
  position: absolute;
  left: 0;
  top: 15%;
  height: 70%;
  width: 3px;
  background: var(--primary-gradient);
  border-radius: 0 4px 4px 0;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.demo-link.active .active-indicator {
  opacity: 1;
}

.demo-link.active {
  color: var(--text-primary);
  background: rgba(0, 242, 254, 0.05);
}

.demo-info {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.demo-title {
  font-size: 0.9rem;
  font-weight: 600;
}

.demo-link.active .demo-title {
  color: var(--primary-color);
}

.demo-desc {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 220px;
}

.demo-link:hover .demo-desc {
  color: var(--text-secondary);
}

.sidebar-footer {
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.tech-badge {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.tech-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}

.tech-dot.active {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

/* Main Content Area Styling */
.main-content {
  flex: 1;
  height: 100%;
  position: relative;
  overflow: hidden;
}

/* Transition Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
