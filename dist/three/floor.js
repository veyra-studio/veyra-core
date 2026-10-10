/**
 * A glossy floor — black acrylic, polished stone, a wet table — that
 * reflects what stands on it. The scene is rendered once more from a camera
 * mirrored in the floor (only the layers you choose). The floor shows that
 * image fading and blurring with the height of what it reflects, the way a
 * real glossy surface does: sharp at the contact, gone a little higher up.
 * Height is reconstructed from the mirror render's depth, so the look holds
 * at any camera angle, grazing ones included.
 *
 * ```ts
 * const floor = new ReflectiveFloor({ width: 3000, depth: 3000, fade: [0, 300] })
 * scene.add(floor.mesh)                      // horizontal, facing +y
 * stage.onFrame(() => floor.update(renderer, scene, camera), Phase.render - 1)
 * ```
 */
import * as THREE from 'three';
const vertexShader = /* glsl */ `
  uniform mat4 textureMatrix;
  varying vec4 vProj;
  varying vec3 vWorld;
  void main() {
    vProj = textureMatrix * vec4(position, 1.0);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const fragmentShader = /* glsl */ `
  uniform sampler2D tReflection;
  uniform sampler2D tDepth;
  uniform mat4 uMirrorInverse;
  uniform vec3 uFloor;
  uniform vec3 uNormal;
  uniform vec3 uTint;
  uniform float uStrength;
  uniform vec2 uFade;
  uniform float uBlur;
  varying vec4 vProj;
  varying vec3 vWorld;
  void main() {
    vec2 uv = vProj.xy / vProj.w;
    // Height above the floor of the point this pixel reflects.
    float depth = texture2D(tDepth, uv).x;
    vec4 p = uMirrorInverse * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    float height = max(0.0, dot(p.xyz / p.w - uFloor, uNormal));
    float fade = 1.0 - smoothstep(uFade.x, uFade.y, height);
    float lod = uBlur * smoothstep(0.0, uFade.y, height);
    vec4 r = textureLod(tReflection, uv, lod);
    gl_FragColor = vec4(r.rgb * uTint, r.a * uStrength * fade);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
export class ReflectiveFloor {
    /** The floor. Add it to the scene; it lies in the XZ plane at its position's y. */
    mesh;
    target;
    material;
    mirror = new THREE.PerspectiveCamera();
    textureMatrix = new THREE.Matrix4();
    scale;
    layer;
    // Scratch.
    plane = new THREE.Plane();
    normal = new THREE.Vector3();
    floorPos = new THREE.Vector3();
    camPos = new THREE.Vector3();
    rotation = new THREE.Matrix4();
    lookAt = new THREE.Vector3();
    view = new THREE.Vector3();
    look = new THREE.Vector3();
    clip = new THREE.Vector4();
    q = new THREE.Vector4();
    size = new THREE.Vector2();
    mirrorInverse = new THREE.Matrix4();
    constructor(options) {
        this.scale = options.resolution ?? 0.5;
        this.layer = options.layer;
        this.target = new THREE.WebGLRenderTarget(1, 1, {
            type: THREE.HalfFloatType,
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter,
            depthTexture: new THREE.DepthTexture(1, 1),
        });
        const [fadeStart, fadeEnd] = options.fade ?? [0, Math.max(options.width, options.depth) / 8];
        this.material = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                tReflection: { value: this.target.texture },
                tDepth: { value: this.target.depthTexture },
                textureMatrix: { value: this.textureMatrix },
                uMirrorInverse: { value: this.mirrorInverse },
                uFloor: { value: this.floorPos },
                uNormal: { value: this.normal },
                uTint: { value: new THREE.Color(options.tint ?? '#ffffff') },
                uStrength: { value: options.strength ?? 0.35 },
                uFade: { value: new THREE.Vector2(fadeStart, fadeEnd) },
                uBlur: { value: options.blur ?? 4 },
            },
            transparent: true,
            depthWrite: false,
        });
        this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(options.width, options.depth).rotateX(-Math.PI / 2), this.material);
        this.mesh.renderOrder = -1;
    }
    /** Sets the heights above the floor where reflected objects start fading and are gone. */
    setFade(start, end) {
        ;
        this.material.uniforms.uFade.value.set(start, end);
    }
    /** Reflection strength, adjustable at any time. */
    get strength() {
        return this.material.uniforms.uStrength.value;
    }
    set strength(v) {
        this.material.uniforms.uStrength.value = v;
    }
    /** Renders the reflection for `camera`. Call before rendering the scene with it. */
    update(renderer, scene, camera) {
        if (!this.mesh.visible || this.strength <= 0.001)
            return;
        renderer.getDrawingBufferSize(this.size);
        const w = Math.max(1, Math.round(this.size.x * this.scale));
        const h = Math.max(1, Math.round(this.size.y * this.scale));
        if (this.target.width !== w || this.target.height !== h)
            this.target.setSize(w, h);
        this.mesh.updateMatrixWorld();
        camera.updateMatrixWorld();
        this.floorPos.setFromMatrixPosition(this.mesh.matrixWorld);
        this.camPos.setFromMatrixPosition(camera.matrixWorld);
        this.rotation.extractRotation(this.mesh.matrixWorld);
        this.normal.set(0, 1, 0).applyMatrix4(this.rotation);
        this.view.subVectors(this.floorPos, this.camPos);
        if (this.view.dot(this.normal) > 0)
            return; // looking at the floor from below
        // Mirror the camera in the floor plane.
        this.view.reflect(this.normal).negate().add(this.floorPos);
        this.rotation.extractRotation(camera.matrixWorld);
        this.lookAt.set(0, 0, -1).applyMatrix4(this.rotation).add(this.camPos);
        this.look.subVectors(this.floorPos, this.lookAt).reflect(this.normal).negate().add(this.floorPos);
        const mirror = this.mirror;
        mirror.position.copy(this.view);
        mirror.up.set(0, 1, 0).applyMatrix4(this.rotation).reflect(this.normal);
        mirror.lookAt(this.look);
        mirror.far = camera.far;
        mirror.updateMatrixWorld();
        mirror.projectionMatrix.copy(camera.projectionMatrix);
        if (this.layer !== undefined)
            mirror.layers.set(this.layer);
        else
            mirror.layers.mask = camera.layers.mask;
        this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
        this.textureMatrix.multiply(mirror.projectionMatrix).multiply(mirror.matrixWorldInverse).multiply(this.mesh.matrixWorld);
        // Oblique near plane: clip everything below the floor (Lengyel).
        this.plane.setFromNormalAndCoplanarPoint(this.normal, this.floorPos).applyMatrix4(mirror.matrixWorldInverse);
        this.clip.set(this.plane.normal.x, this.plane.normal.y, this.plane.normal.z, this.plane.constant);
        const e = mirror.projectionMatrix.elements;
        this.q.set((Math.sign(this.clip.x) + e[8]) / e[0], (Math.sign(this.clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
        this.clip.multiplyScalar(2 / this.clip.dot(this.q));
        e[2] = this.clip.x;
        e[6] = this.clip.y;
        e[10] = this.clip.z + 1;
        e[14] = this.clip.w;
        this.mirrorInverse.multiplyMatrices(mirror.projectionMatrix, mirror.matrixWorldInverse).invert();
        const previous = renderer.getRenderTarget();
        const clearAlpha = renderer.getClearAlpha();
        const shadowAuto = renderer.shadowMap.autoUpdate;
        this.mesh.visible = false;
        renderer.shadowMap.autoUpdate = false;
        renderer.setClearAlpha(0);
        renderer.setRenderTarget(this.target);
        renderer.state.buffers.depth.setMask(true);
        renderer.clear();
        renderer.render(scene, mirror);
        renderer.setRenderTarget(previous);
        renderer.setClearAlpha(clearAlpha);
        renderer.shadowMap.autoUpdate = shadowAuto;
        this.mesh.visible = true;
    }
    dispose() {
        this.target.dispose();
        this.material.dispose();
        this.mesh.geometry.dispose();
    }
}
//# sourceMappingURL=floor.js.map