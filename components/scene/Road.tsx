// Road runs along positive Z toward the stops (z=30, 60, 90, 120).
// Starts just behind spawn (z=-8) and ends past the last stop (z=135).

const ROAD_LENGTH = 250   // total length
const ROAD_CENTER_Z = 125  // midpoint between z=-8 and z=135
const ROAD_WIDTH   = 8

const DASH_COUNT   = 24
const DASH_LENGTH  = 2
const DASH_GAP     = (ROAD_LENGTH - DASH_COUNT * DASH_LENGTH) / (DASH_COUNT + 1)

export default function Road() {
  const dashes = Array.from({ length: DASH_COUNT }, (_, i) => {
    const z = -8 + DASH_GAP + i * (DASH_LENGTH + DASH_GAP) + DASH_LENGTH / 2
    return z
  })

  return (
    <group>
      {/* Road surface */}
      <mesh position={[0, 0.01, ROAD_CENTER_Z]} receiveShadow>
        <boxGeometry args={[ROAD_WIDTH, 0.02, ROAD_LENGTH]} />
        <meshStandardMaterial color="#111122" />
      </mesh>

      {/* Road edges */}
      {([-ROAD_WIDTH / 2, ROAD_WIDTH / 2] as number[]).map((x) => (
        <mesh key={x} position={[x, 0.02, ROAD_CENTER_Z]}>
          <boxGeometry args={[0.12, 0.02, ROAD_LENGTH]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* Dashed centre line */}
      {dashes.map((z) => (
        <mesh key={z} position={[0, 0.02, z]}>
          <boxGeometry args={[0.08, 0.02, DASH_LENGTH]} />
          <meshStandardMaterial color="#ffdd55" emissive="#ffdd55" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  )
}
