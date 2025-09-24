// Minimal three.js type shims used by LiquidEther.tsx to satisfy CI builds
// Replace with `@types/three` or more complete typings later.

declare module 'three' {
  export class WebGLRenderer {
    domElement: HTMLElement;
    autoClear: boolean;
    setClearColor(color: Color, alpha?: number): void;
    setPixelRatio(r: number): void;
    setSize(w: number, h: number, updateStyle?: boolean): void;
  }
  export class Clock {
    start(): void;
    getDelta(): number;
  }
  export class DataTexture {
    constructor(data: Uint8Array, width: number, height: number, format: any);
    magFilter: any;
    minFilter: any;
    wrapS: any;
    wrapT: any;
    generateMipmaps: boolean;
    needsUpdate: boolean;
  }
  export class Vector2 {
    constructor(x?: number, y?: number);
    set(x: number, y: number): void;
  }
  export class Vector4 {
    constructor(x?: number, y?: number, z?: number, w?: number);
    set(x: number, y: number, z: number, w: number): void;
  }
  export class Color {
    constructor(color?: string | number);
    r: number;
    g: number;
    b: number;
  }
  export const LinearFilter: any;
  export const RGBAFormat: any;
  export const ClampToEdgeWrapping: any;
  export const LinearMipmapLinearFilter: any;
  export const NearestFilter: any;
}
