# Requirement Overview: 3D Wuxia Web Game Project (Inspired by Where Winds Meet)

This document outlines the high-level technical requirements and architectural choices for a web-based, personal 3D Action-RPG project.

---

## 1. Technical Architecture Overview

To achieve near-native performance for a 3D Wuxia game on desktop browsers, the project will utilize an **Engine-Export architecture** coupled with a high-performance backend.

```
+-------------------------------------------------------+
|                    DESKTOP BROWSER                     |
|  +--------------------+      +---------------------+  |
|  |   HTML5 Canvas     |      | JavaScript Web Audio|  |
|  | (WebGL 2.0 / WebGPU)|     |         API         |  |
|  +--------------------+      +---------------------+  |
|           ^                            ^              |
|           | WebAssembly (Wasm)         |              |
|  +-------------------------------------------------+  |
|  |     Game Logic Engine (Godot 4.x / Unity)       |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
                           ^
                           | WebSockets / WebTransport
                           v
+-------------------------------------------------------+
|                   WEB/GAME SERVER                     |
|  +-------------------------------------------------+  |
|  |  Node.js (TypeScript) / Go / Rust               |  |
|  |  - Static File Hosting (HTML5/Wasm Assets)       |  |
|  |  - WebSocket Event Multi-threading               |  |
|  +-------------------------------------------------+  |
+-------------------------------------------------------+
```

---

## 2. Server-Side Language & Stack Options

Since this game features real-time client-server communication (or static serving for personal play), the server has two primary duties: **Hosting the game assets** and **Handling backend logic/state**.

### Option A: Node.js (TypeScript) — *Recommended for Beginners / Rapid Prototyping*
* **Why:** You can use the same ecosystem (JavaScript/TypeScript) across web development tools.
* **Libraries:** `ws` or `Socket.io` for real-time networking; `Express` or `Fastify` for asset hosting.
* **Performance:** Single-threaded event loop handles thousands of concurrent WebSocket connections efficiently via asynchronous I/O.

### Option B: Go (Golang) — *Recommended for Network Performance & Concurrency*
* **Why:** Go compiles into a single binary, consumes minimal RAM, and handles multi-threaded concurrency flawlessly via **Goroutines**.
* **Libraries:** `gorilla/websocket` or `gnet`.
* **Performance:** Excellent CPU-bound logic handling (useful if your server needs to calculate 3D hitboxes or physics validations).

### Option C: Rust — *Recommended for Ultra-low Latency / Hardcore Control*
* **Why:** Zero-cost abstractions and strict memory safety without a garbage collector.
* **Libraries:** `tokio` (async runtime), `tungstenite` (WebSockets), or game server frameworks like `Bevy` (headless).

---

## 3. Functional Requirements

### 3.1 Core Gameplay (3D Mechanics)
* **Third-Person Controller:** Standard keyboard and mouse inputs (WASD + Mouse Look). Smooth camera rotation and tracking.
* **Wuxia Movement:** Implement basic martial arts mobility:
  * Sprinting and wall-running.
  * Mid-air dashing or gliding (Updraft interaction).
* **Combat System:** Basic light/heavy attack combos using a sword, hit registration using 3D colliders, and visual particle effect triggers upon striking targets.

### 3.2 Asset & Audio Requirements
* **3D Models:** Sourced as `.gltf` or `.fbx` formats (Low-poly optimized).
* **Animations:** Character rigging mapped to combat states (Idle, Run, Attack, Glide) utilizing Adobe Mixamo assets.
* **Audio Engine:** Background looping track with trigger-based sound effects (sword slashes, wind gusts) routed through the **Web Audio API**.

---

## 4. Non-Functional & Performance Requirements

* **Target Frame Rate:** Stable **60 FPS** on standard modern desktop browsers (Chrome, Edge, Firefox) using hardware acceleration.
* **Asset Loading Budget:** Total initial package size under **100MB** to ensure rapid initial loading on a local or private web server.
* **Memory Ceiling:** Ensure runtime heap memory usage stays below **1.5 GB RAM** to prevent the browser tab from crashing.
* **Data Storage:** Persist player progress (unlocked skills, positions) locally via **IndexedDB** or browser **LocalStorage**.

---

## 5. Development Milestones

1. **Phase 1 (Prototype):** Set up the Game Engine (Godot/Unity), import a character, write WASD movement, and test local web export.
2. **Phase 2 (Wuxia Elements):** Integrate Mixamo animations for jumping, dashing, and sword swinging. Add wind particle zones.
3. **Phase 3 (Server Integration):** Write a minimal Node.js/Go backend to serve files and establish a basic live WebSocket loop.
4. **Phase 4 (Deployment):** Package the game and deploy to a free hosting environment like Itch.io for testing with friends.
