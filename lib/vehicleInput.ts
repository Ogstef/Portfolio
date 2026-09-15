import type { VehicleInput } from 'ecctrl/vehicle'
export type { VehicleInput }

export enum Controls {
  forward = 'forward',
  backward = 'backward',
  steerLeft = 'steerLeft',
  steerRight = 'steerRight',
  brake = 'brake',
}

export const keyMap = [
  { name: Controls.forward,    keys: ['ArrowUp',    'KeyW'] },
  { name: Controls.backward,   keys: ['ArrowDown',  'KeyS'] },
  { name: Controls.steerLeft,  keys: ['ArrowLeft',  'KeyA'] },
  { name: Controls.steerRight, keys: ['ArrowRight', 'KeyD'] },
  { name: Controls.brake,      keys: ['Space'] },
]
