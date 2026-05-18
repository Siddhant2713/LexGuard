"use client"

import { useEffect, useRef } from "react"

export default function WebGLBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    // LOCAL variable — each effect invocation captures its own `cancelled`.
    // A shared ref doesn't work because Effect 2 setting it to true/false
    // would accidentally unblock Effect 1's stale async continuation.
    let cancelled = false
    let frameId = 0
    let disposeScene: (() => void) | null = null

    ;(async () => {
      const THREE = await import("three")

      // If cleanup ran while we were awaiting the import, bail immediately.
      if (cancelled) return

      const canvas = canvasRef.current
      if (!canvas) return

      // ── Renderer ──────────────────────────────────────────────────────────
      // Do NOT call canvas.getContext("webgl") before this — it would claim
      // the context and then Three.js would fail with "Canvas has an existing
      // context of a different type". Let Three.js be the sole context creator.
      let renderer: THREE.WebGLRenderer
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
      } catch {
        console.warn("WebGL not available — background animation disabled.")
        return
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setSize(window.innerWidth, window.innerHeight)

      // ── Scene ─────────────────────────────────────────────────────────────
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        100,
      )
      camera.position.z = 5

      // ── Particles ─────────────────────────────────────────────────────────
      const count = 700
      const positions = new Float32Array(count * 3)
      for (let i = 0; i < count; i++) {
        positions[i * 3]     = (Math.random() - 0.5) * 20
        positions[i * 3 + 1] = (Math.random() - 0.5) * 12
        positions[i * 3 + 2] = (Math.random() - 0.5) * 8
      }
      const geo = new THREE.BufferGeometry()
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3))

      // Use PointsMaterial — no custom uniforms, no stale WebGL locations.
      const mat = new THREE.PointsMaterial({
        color: 0xBCB8AA,   // warm stone — visible on parchment bg
        size: 0.05,
        transparent: true,
        opacity: 0.65,
        sizeAttenuation: true,
      })

      const points = new THREE.Points(geo, mat)
      scene.add(points)

      // ── Mouse repulsion (plain JS, no uniforms) ───────────────────────────
      let mouseX = 0
      let mouseY = 0
      const onMouseMove = (e: MouseEvent) => {
        if (cancelled) return
        mouseX = (e.clientX / window.innerWidth)  * 2 - 1
        mouseY = -(e.clientY / window.innerHeight) * 2 + 1
      }

      // ── Resize ────────────────────────────────────────────────────────────
      const onResize = () => {
        if (cancelled) return
        camera.aspect = window.innerWidth / window.innerHeight
        camera.updateProjectionMatrix()
        renderer.setSize(window.innerWidth, window.innerHeight)
      }

      window.addEventListener("mousemove", onMouseMove)
      window.addEventListener("resize", onResize)

      // ── Render loop ───────────────────────────────────────────────────────
      let t = 0
      const tick = () => {
        if (cancelled) return   // stop if this effect instance was cleaned up
        t += 0.004

        // Gentle drift animation
        points.rotation.y = t * 0.04
        points.rotation.x = Math.sin(t * 0.3) * 0.04

        // Subtle camera nudge toward mouse
        camera.position.x += (mouseX * 1.2 - camera.position.x) * 0.02
        camera.position.y += (mouseY * 0.8 - camera.position.y) * 0.02
        camera.lookAt(scene.position)

        renderer.render(scene, camera)
        frameId = requestAnimationFrame(tick)
      }
      frameId = requestAnimationFrame(tick)

      // Register disposal for this specific async run
      disposeScene = () => {
        cancelAnimationFrame(frameId)
        window.removeEventListener("mousemove", onMouseMove)
        window.removeEventListener("resize", onResize)
        geo.dispose()
        mat.dispose()
        renderer.dispose()
      }

      // If cleanup already ran before this line was reached, dispose now.
      if (cancelled) disposeScene()
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(frameId)
      disposeScene?.()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.5,
      }}
    />
  )
}
