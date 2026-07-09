/**
 * 礼 · 宾主场景与低多边形人物（参考 Summer Afternoon 的漫步感与 toon 配色）
 */

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type MutableRefObject } from "react";
import * as THREE from "three";
import { RANK_META, type Rank } from "./liHostData";

export const PAL = {
  skyTop: "#9ecae8",
  skyBot: "#f3e4c8",
  fog: "#d4e4d0",
  grass: "#6d9a6e",
  grassLight: "#8fb892",
  stone: "#c4b8a4",
  wood: "#6b4f3a",
  pillar: "#a84838",
  roof: "#5a6a78",
  paper: "#f2ebe0",
  mat: "#c9b896",
  matEdge: "#9a7f5c",
  skin: "#e8c9a8",
  hostRobe: "#3d4f6a",
  glow: "#f0c878",
  trim: "#993C1D",
} as const;

export const WORLD = {
  minX: -5.2,
  maxX: 5.2,
  minZ: -8.2,
  maxZ: 2.2,
  interactRadius: 1.55,
  seatRadius: 1.25,
} as const;

const SEAT_ANGLES = [-0.8, -0.25, 0.25, 0.8];

export function guestWorldPos(
  index: number,
  total: number,
  seatIdx: number | null,
  seated: boolean,
): THREE.Vector3 {
  if (seated && seatIdx != null) {
    const a = SEAT_ANGLES[seatIdx] ?? 0;
    return new THREE.Vector3(Math.sin(a) * 2.6, 0, -4.2 + Math.cos(a) * 1.1);
  }
  const spread = (index - (total - 1) / 2) * 1.5;
  return new THREE.Vector3(spread, 0, -6.2);
}

export function seatWorldPos(idx: number): THREE.Vector3 {
  const a = SEAT_ANGLES[idx] ?? 0;
  return new THREE.Vector3(Math.sin(a) * 2.6, 0, -4.2 + Math.cos(a) * 1.1);
}

function toon(color: string) {
  return new THREE.MeshToonMaterial({ color });
}

type HatKind = "host" | Rank | "none";

export function LowPolyPerson({
  robeColor,
  hat = "none",
  bowTilt = 0,
  walking = false,
  walkRef,
  faceZ = 0,
}: {
  robeColor: string;
  hat?: HatKind;
  bowTilt?: number;
  walking?: boolean;
  walkRef?: MutableRefObject<number>;
  faceZ?: number;
}) {
  const upper = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const robe = useMemo(() => toon(robeColor), [robeColor]);
  const skin = useMemo(() => toon(PAL.skin), []);
  const dark = useMemo(() => toon(PAL.wood), []);

  useFrame((state) => {
    if (upper.current) {
      upper.current.rotation.x = THREE.MathUtils.lerp(upper.current.rotation.x, -bowTilt * 0.55, 0.16);
    }
    const swing = (walking || (walkRef?.current ?? 0) > 0.5)
      ? Math.sin(state.clock.elapsedTime * 9) * 0.28
      : 0;
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
  });

  return (
    <group rotation={[0, faceZ, 0]}>
      {/* 腿 */}
      <mesh ref={legL} position={[-0.1, 0.22, 0]} material={dark}>
        <boxGeometry args={[0.12, 0.44, 0.14]} />
      </mesh>
      <mesh ref={legR} position={[0.1, 0.22, 0]} material={dark}>
        <boxGeometry args={[0.12, 0.44, 0.14]} />
      </mesh>
      {/* 袍摆 */}
      <mesh position={[0, 0.55, 0]} material={robe}>
        <cylinderGeometry args={[0.2, 0.34, 0.55, 8]} />
      </mesh>
      <group ref={upper}>
        <mesh position={[0, 0.95, 0]} material={robe}>
          <boxGeometry args={[0.42, 0.38, 0.2]} />
        </mesh>
        <mesh position={[-0.3, 0.88, 0.02]} rotation={[0, 0, 0.3]} material={robe}>
          <boxGeometry args={[0.24, 0.08, 0.16]} />
        </mesh>
        <mesh position={[0.3, 0.88, 0.02]} rotation={[0, 0, -0.3]} material={robe}>
          <boxGeometry args={[0.24, 0.08, 0.16]} />
        </mesh>
        <mesh position={[0, 0.82, 0.12]} material={skin}>
          <boxGeometry args={[0.14, 0.06, 0.08]} />
        </mesh>
        <mesh position={[0, 1.18, 0]} material={skin}>
          <sphereGeometry args={[0.15, 10, 10]} />
        </mesh>
        {hat === "host" && (
          <mesh position={[0, 1.32, 0]} material={dark}>
            <boxGeometry args={[0.36, 0.06, 0.28]} />
          </mesh>
        )}
        {hat === "honored" && (
          <mesh position={[0, 1.34, 0]} material={toon("#2c241c")}>
            <boxGeometry args={[0.32, 0.08, 0.22]} />
          </mesh>
        )}
        {hat === "elder" && (
          <mesh position={[0, 1.31, -0.02]} material={toon("#4a3728")}>
            <boxGeometry args={[0.26, 0.05, 0.22]} />
          </mesh>
        )}
        {(hat === "peer" || hat === "junior") && (
          <mesh position={[0, 1.3, 0]} material={dark}>
            <cylinderGeometry args={[0.1, 0.12, 0.06, 8]} />
          </mesh>
        )}
      </group>
    </group>
  );
}

export function CourtyardScene({ atmosphere }: { atmosphere: number }) {
  const warm = atmosphere / 100;
  return (
    <>
      <color attach="background" args={[PAL.skyBot]} />
      <fog attach="fog" args={[PAL.fog, 14, 42]} />
      <hemisphereLight args={[PAL.skyTop, PAL.grass, 0.65 + warm * 0.1]} />
      <directionalLight position={[6, 12, 4]} intensity={0.85} color="#fff8e8" castShadow={false} />

      {/* 草地 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -3]} receiveShadow>
        <planeGeometry args={[28, 28]} />
        <meshToonMaterial color={PAL.grass} />
      </mesh>
      {/* 石径 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -1.8]}>
        <planeGeometry args={[3.2, 9]} />
        <meshToonMaterial color={PAL.stone} />
      </mesh>

      {/* 亭榭地坪 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -4.5]}>
        <circleGeometry args={[4.8, 48]} />
        <meshToonMaterial color={PAL.mat} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, -4.5]}>
        <ringGeometry args={[4.2, 4.8, 48]} />
        <meshToonMaterial color={PAL.matEdge} />
      </mesh>

      {/* 四柱 + 飞檐 */}
      {([-3.8, 3.8] as const).flatMap((x) =>
        [-2.2, -6.8].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh position={[0, 1.4, 0]}>
              <cylinderGeometry args={[0.13, 0.15, 2.8, 8]} />
              <meshToonMaterial color={PAL.pillar} />
            </mesh>
          </group>
        )),
      )}
      <mesh position={[0, 2.85, -4.5]}>
        <boxGeometry args={[9.2, 0.18, 5.8]} />
        <meshToonMaterial color={PAL.roof} />
      </mesh>
      <mesh position={[0, 3.05, -4.5]} rotation={[0, 0, 0]}>
        <boxGeometry args={[8.4, 0.1, 5]} />
        <meshToonMaterial color="#4a5a68" />
      </mesh>

      {/* 后屏 */}
      <mesh position={[0, 1.6, -7.5]}>
        <boxGeometry args={[8, 3.2, 0.15]} />
        <meshToonMaterial color={PAL.paper} />
      </mesh>
      {[-2.2, 0, 2.2].map((x) => (
        <mesh key={x} position={[x, 1.5, -7.38]}>
          <boxGeometry args={[1.6, 2.6, 0.06]} />
          <meshToonMaterial color="#ddd0bc" />
        </mesh>
      ))}

      {/* 案几 */}
      <group position={[0, 0, -5.2]}>
        <mesh position={[0, 0.42, 0]}>
          <boxGeometry args={[2.4, 0.1, 1]} />
          <meshToonMaterial color={PAL.wood} />
        </mesh>
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} position={[x, 0.2, 0.28]}>
            <boxGeometry args={[0.08, 0.4, 0.08]} />
            <meshToonMaterial color={PAL.wood} />
          </mesh>
        ))}
      </group>

      {/* 院墙 */}
      <mesh position={[0, 0.45, 2]}>
        <boxGeometry args={[12, 0.9, 0.2]} />
        <meshToonMaterial color={PAL.stone} />
      </mesh>

      {/* 树木点缀 */}
      <LowPolyTree position={[-6.5, 0, -1]} scale={1.1} />
      <LowPolyTree position={[6.2, 0, -2.5]} scale={0.9} />
      <LowPolyTree position={[-5.5, 0, -7]} scale={0.85} />
    </>
  );
}

function LowPolyTree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.55, 0]}>
        <cylinderGeometry args={[0.1, 0.14, 1.1, 6]} />
        <meshToonMaterial color={PAL.wood} />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <dodecahedronGeometry args={[0.65, 0]} />
        <meshToonMaterial color={PAL.grassLight} />
      </mesh>
    </group>
  );
}

export function GuestNPC({
  guest,
  index,
  total,
  phase,
  highlighted,
  seated,
}: {
  guest: {
    id: string;
    rank: Rank;
    seatIdx: number | null;
    bowFlash: number;
  };
  index: number;
  total: number;
  phase: string;
  highlighted: boolean;
  seated: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const meta = RANK_META[guest.rank];
  const target = useMemo(
    () => guestWorldPos(index, total, guest.seatIdx, seated),
    [index, total, guest.seatIdx, seated],
  );

  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.position.lerp(target, 1 - Math.exp(-4 * dt));
    const face = seated
      ? Math.atan2(-group.current.position.x, 3.5)
      : Math.atan2(-group.current.position.x, 2);
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, face, 0.08);
  });

  const bowTilt = guest.bowFlash > 0 ? 0.35 * guest.bowFlash : 0;

  return (
    <group ref={group} position={target.toArray()}>
      {highlighted && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
          <ringGeometry args={[0.45, 0.68, 32]} />
          <meshBasicMaterial color={PAL.glow} transparent opacity={0.55} side={THREE.DoubleSide} />
        </mesh>
      )}
      {seated && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.5, 20]} />
          <meshToonMaterial color={PAL.matEdge} />
        </mesh>
      )}
      <LowPolyPerson
        robeColor={meta.hex}
        hat={guest.rank}
        bowTilt={bowTilt}
        faceZ={0}
      />
      {highlighted && (phase === "greet" || phase === "banquet" || phase === "seat") && (
        <mesh position={[0, 1.75, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={PAL.glow} />
        </mesh>
      )}
    </group>
  );
}

export function SeatMarkers({ visible, count }: { visible: boolean; count: number }) {
  if (!visible) return null;
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const p = seatWorldPos(i);
        return (
          <group key={i} position={p.toArray()}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
              <ringGeometry args={[0.4, 0.62, 32]} />
              <meshBasicMaterial color={PAL.glow} transparent opacity={0.55} side={THREE.DoubleSide} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
              <circleGeometry args={[0.38, 20]} />
              <meshToonMaterial color={PAL.mat} transparent opacity={0.4} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
