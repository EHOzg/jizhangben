import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";

// Define the demos list for easy sidebar generation and routing
export const demos = [
	{
		path: "/demo/01",
		name: "Demo01",
		meta: {
			title: "Demo 01: Hello Cube",
			description: "A spinning wireframe cube showing basic setup.",
		},
		component: () => import("../views/Demo01.vue"),
	},
	{
		path: "/demo/02",
		name: "Demo02",
		meta: {
			title: "Demo 02: Orbit Controls",
			description: "Interactive OrbitControls setup with standard lighting.",
		},
		component: () => import("../views/Demo02.vue"),
	},
	{
		path: "/demo/03",
		name: "Demo03",
		meta: {
			title: "Demo 03: Texture Map",
			description: "Loading and mapping door color texture.",
		},
		component: () => import("../views/Texture.vue"),
	},
	{
		path: "/demo/04",
		name: "Demo04",
		meta: {
			title: "Demo 04: Materials Sandbox",
			description:
				"Playing with basic, normal, phong, standard, and physical materials.",
		},
		component: () => import("../views/Material.vue"),
	},
	{
		path: "/demo/05",
		name: "Demo05",
		meta: {
			title: "Demo 05: Diamond Sandbox",
			description:
				"Simulating realistic diamond optics (IOR 2.417 & dispersion).",
		},
		component: () => import("../views/Diamond.vue"),
	},
	{
		path: "/demo/06",
		name: "Demo06",
		meta: {
			title: "Demo 06: Amber Sandbox",
			description:
				"Simulating realistic organic amber with prehistoric inclusions.",
		},
		component: () => import("../views/Amber.vue"),
	},
	{
		path: "/demo/07",
		name: "Demo07",
		meta: {
			title: "Demo 07: 3D Typography",
			description:
				"Rendering premium 3D text using font layouts and physical materials.",
		},
		component: () => import("../views/Text3D.vue"),
	},
	{
		path: "/demo/08",
		name: "Demo08",
		meta: {
			title: "Demo 08: Lights Showroom",
			description:
				"Interactive showroom of Three.js lights, helper visuals, and shadows.",
		},
		component: () => import("../views/Lights.vue"),
	},
	{
		path: "/demo/09",
		name: "Demo09",
		meta: {
			title: "Demo 09: Shadows Sandbox",
			description:
				"Diving deep into Three.js shadow maps, precision tuning (bias, radius), and helpers.",
		},
		component: () => import("../views/Shadows.vue"),
	},
	{
		path: "/demo/10",
		name: "Demo10",
		meta: {
			title: "Demo 10: Baked Shadows",
			description:
				"Contrast real-time shadow maps with pre-baked lightmaps and dynamic contact shadows.",
		},
		component: () => import("../views/BakedShadows.vue"),
	},
	{
		path: "/demo/11",
		name: "Demo11",
		meta: {
			title: "Demo 11: Haunted House",
			description: "",
		},
		component: () => import("../views/hauntedhouse.vue"),
	},
];

const routes = [
	{
		path: "/",
		name: "Home",
		component: Home,
		meta: { title: "Dashboard" },
	},
	...demos,
];

const router = createRouter({
	history: createWebHistory(),
	routes,
});

export default router;
