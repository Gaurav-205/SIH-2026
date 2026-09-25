import { useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Cycle } from "../data/types";
import { rainColor } from "../components/scales";
import { useIsDark } from "@/lib/theme";

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const UP = 5;          // upsampling factor for a smooth surface
const CELL = 0.32;     // world units per grid cell
const HEIGHT = 1.1;    // world units for 1500 m

function bilinear(a: Float32Array, nLat: number, nLon: number, fi: number, fj: number) {
  const i0 = Math.max(0, Math.min(nLat - 1, Math.floor(fi))), j0 = Math.max(0, Math.min(nLon - 1, Math.floor(fj)));
  const i1 = Math.min(nLat - 1, i0 + 1), j1 = Math.min(nLon - 1, j0 + 1);
  const ti = Math.min(1, Math.max(0, fi - i0)), tj = Math.min(1, Math.max(0, fj - j0));
  const v00 = a[i0 * nLon + j0], v01 = a[i0 * nLon + j1], v10 = a[i1 * nLon + j0], v11 = a[i1 * nLon + j1];
  return (v00 * (1 - tj) + v01 * tj) * (1 - ti) + (v10 * (1 - tj) + v11 * tj) * ti;
}

function Surface({ cycle, field }: { cycle: Cycle; field: Float32Array }) {
  const g = cycle.region;
  // Heights and colours are built together (a few thousand vertices, cheap to rebuild on a view change)
  const geo = useMemo(() => {
    const W = g.nLon * CELL, D = g.nLat * CELL;
    const sx = (g.nLon - 1) * UP, sz = (g.nLat - 1) * UP;
    const geom = new THREE.PlaneGeometry(W, D, sx, sz);
    geom.rotateX(-Math.PI / 2);
    const pos = geom.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const sea = new THREE.Color("#8FB6CF"), c = new THREE.Color();
    for (let r = 0; r <= sz; r++) for (let q = 0; q <= sx; q++) {
      const idx = r * (sx + 1) + q;
      const fi = (g.nLat - 1) - r / UP, fj = q / UP;       // row 0 = north (far)
      const e = bilinear(cycle.elevation, g.nLat, g.nLon, fi, fj);
      pos.setY(idx, e < 0 ? -0.02 : (e / 1500) * HEIGHT);
      const [cr, cg, cb] = rainColor(bilinear(field, g.nLat, g.nLon, fi, fj));
      c.setRGB(cr / 255, cg / 255, cb / 255, THREE.SRGBColorSpace);
      if (e < 0) c.copy(sea).lerp(new THREE.Color(cr / 255, cg / 255, cb / 255), 0.25);
      colors.set([c.r, c.g, c.b], idx * 3);
    }
    geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geom.computeVertexNormals();
    return geom;
  }, [cycle, field, g]);

  // Free GPU memory of the previous surface when the view changes
  useEffect(() => () => geo.dispose(), [geo]);

  return <mesh geometry={geo}><meshStandardMaterial vertexColors roughness={0.85} metalness={0} /></mesh>;
}

function Columns({ cycle, threshold }: { cycle: Cycle; threshold: number }) {
  const g = cycle.region;
  const cols = useMemo(() => {
    const out: { x: number; z: number; y: number; h: number }[] = [];
    for (let c = 0; c < cycle.p90.length; c++) {
      if (cycle.elevation[c] < 0 || cycle.p90[c] < threshold) continue;
      const i = Math.floor(c / g.nLon), j = c % g.nLon;
      const x = (j - (g.nLon - 1) / 2) * CELL, z = -((i - (g.nLat - 1) / 2) * CELL);
      const base = (cycle.elevation[c] / 1500) * HEIGHT;
      out.push({ x, z, y: base, h: 0.15 + (cycle.p90[c] / 300) * 0.9 });
    }
    return out;
  }, [cycle, threshold, g]);
  return (
    <group>
      {cols.map((k, n) => (
        <mesh key={n} position={[k.x, k.y + k.h / 2, k.z]}>
          <cylinderGeometry args={[0.028, 0.028, k.h, 8]} />
          <meshStandardMaterial color="#F2A541" emissive="#F2A541" emissiveIntensity={0.35} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  );
}

export default function TerrainScene({ cycle, field, showColumns = true, autoRotate = false, label }: {
  cycle: Cycle; field: Float32Array; showColumns?: boolean; autoRotate?: boolean; label: string;
}) {
  const still = prefersReducedMotion();
  const dark = useIsDark();
  const span = Math.max(cycle.region.nLat, cycle.region.nLon) * CELL;
  return (
    <div className="h-full w-full" role="img" aria-label={label}>
      <Canvas dpr={[1, 1.75]} camera={{ position: [-span * 0.95, span * 0.7, span * 0.55], fov: 38 }}>
        <color attach="background" args={[dark ? "#111929" : "#F2F4F7"]} />
        <hemisphereLight args={["#FFFFFF", "#9FB3C4", 0.9]} />
        <directionalLight position={[-3, 6, 4]} intensity={1.4} />
        <Surface cycle={cycle} field={field} />
        {showColumns && <Columns cycle={cycle} threshold={204.5} />}
        <OrbitControls enableDamping makeDefault autoRotate={autoRotate && !still} autoRotateSpeed={0.6}
          minPolarAngle={0.25} maxPolarAngle={1.25} minDistance={span * 0.5} maxDistance={span * 2.2} />
      </Canvas>
    </div>
  );
}
