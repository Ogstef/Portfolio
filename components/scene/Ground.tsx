import { RigidBody, CuboidCollider } from '@react-three/rapier'

export default function Ground() {
  return (
    <RigidBody type="fixed">
      <CuboidCollider args={[1000, 0.05, 1000]} position={[0, -0.05, 0]} />
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[2000, 0.1, 2000]} />
        <meshStandardMaterial color="#5a3e28" roughness={1} />
      </mesh>
    </RigidBody>
  )
}
