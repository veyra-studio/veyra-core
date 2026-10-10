/**
 * Contact shadows: the soft, dense shadow where an object meets the floor —
 * the cue that makes a product stand on something instead of floating.
 * Casters are rendered from below as depth, blurred, and shown on a plane.
 *
 * ```ts
 * const shadow = new ContactShadow({ width: 400, depth: 400, far: 300 })
 * shadow.cast(bottle)                // bottle and its children cast
 * scene.add(shadow.object)           // place it at the floor, under the bottle
 * stage.onFrame(() => shadow.update(renderer, scene))
 * ```
 *
 * Move it with `object.position`; change its size with `resize()` — don't
 * scale `object` (the capture camera would be culled wrongly).
 */
import * as THREE from 'three';
const blurVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }
`;
const blurFragment = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec2 uStep;
  varying vec2 vUv;
  void main() {
    vec4 sum = texture2D(tMap, vUv) * 0.2270270270;
    sum += texture2D(tMap, vUv + uStep * 1.3846153846) * 0.3162162162;
    sum += texture2D(tMap, vUv - uStep * 1.3846153846) * 0.3162162162;
    sum += texture2D(tMap, vUv + uStep * 3.2307692308) * 0.0702702703;
    sum += texture2D(tMap, vUv - uStep * 3.2307692308) * 0.0702702703;
    gl_FragColor = sum;
  }
`;
const planeVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const planeFragment = /* glsl */ `
  uniform sampler2D tMap;
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float a = texture2D(tMap, vec2(vUv.x, 1.0 - vUv.y)).a;
    gl_FragColor = vec4(uColor, a * uOpacity);
  }
`;
export class ContactShadow {
    /** Add this to the scene and place it at floor level. */
    object = new THREE.Group();
    layer;
    /** Plane opacity, adjustable at any time. */
    get opacity() {
        return this.planeMaterial.uniforms.uOpacity.value;
    }
    set opacity(v) {
        this.planeMaterial.uniforms.uOpacity.value = v;
        this.plane.visible = v > 0.001;
    }
    target;
    blurTarget;
    camera;
    depthMaterial;
    blurMaterial;
    planeMaterial;
    plane;
    quad;
    quadScene = new THREE.Scene();
    quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    blur;
    constructor(options) {
        const resolution = options.resolution ?? 512;
        this.layer = options.layer ?? 5;
        this.blur = options.blur ?? 3;
        const rt = () => {
            const t = new THREE.WebGLRenderTarget(resolution, resolution, { depthBuffer: false });
            t.texture.generateMipmaps = false;
            return t;
        };
        this.target = rt();
        this.blurTarget = rt();
        // Looks up from the plane.
        this.camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);
        this.camera.rotation.x = Math.PI / 2;
        this.camera.layers.set(this.layer);
        this.object.add(this.camera);
        const darkness = { value: options.darkness ?? 1 };
        this.depthMaterial = new THREE.MeshDepthMaterial({ depthTest: false, depthWrite: false });
        this.depthMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.darkness = darkness;
            shader.fragmentShader = `uniform float darkness;\n${shader.fragmentShader.replace('gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'gl_FragColor = vec4( vec3( 0.0 ), ( 1.0 - fragCoordZ ) * darkness );')}`;
        };
        this.blurMaterial = new THREE.ShaderMaterial({
            vertexShader: blurVertex,
            fragmentShader: blurFragment,
            uniforms: { tMap: { value: null }, uStep: { value: new THREE.Vector2() } },
            depthTest: false,
            depthWrite: false,
        });
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.blurMaterial);
        this.quad.frustumCulled = false;
        this.quadScene.add(this.quad);
        this.planeMaterial = new THREE.ShaderMaterial({
            vertexShader: planeVertex,
            fragmentShader: planeFragment,
            uniforms: {
                tMap: { value: this.target.texture },
                uColor: { value: new THREE.Color(options.color ?? '#000000') },
                uOpacity: { value: options.opacity ?? 0.8 },
            },
            transparent: true,
            depthWrite: false,
        });
        this.plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), this.planeMaterial);
        this.plane.renderOrder = 1;
        this.object.add(this.plane);
        this.resize(options.width, options.depth, options.far);
    }
    /** Resizes the plane (`width` × `depth`) and how high above it casters count (`far`), in world units. */
    resize(width, depth, far) {
        const c = this.camera;
        c.left = -width / 2;
        c.right = width / 2;
        c.top = depth / 2;
        c.bottom = -depth / 2;
        c.far = far;
        c.updateProjectionMatrix();
        this.plane.scale.set(width, 1, depth);
    }
    /** Marks `object` and its descendants as shadow casters. */
    cast(object) {
        object.traverse((o) => o.layers.enable(this.layer));
    }
    /** Re-renders the shadow. Call when casters move (every frame while animating). */
    update(renderer, scene) {
        if (!this.plane.visible)
            return;
        const background = scene.background;
        const override = scene.overrideMaterial;
        const clearAlpha = renderer.getClearAlpha();
        const previousTarget = renderer.getRenderTarget();
        const shadowsVisible = this.object.visible;
        this.object.visible = false;
        scene.background = null;
        scene.overrideMaterial = this.depthMaterial;
        renderer.setClearAlpha(0);
        renderer.setRenderTarget(this.target);
        renderer.clear();
        renderer.render(scene, this.camera);
        scene.overrideMaterial = override;
        scene.background = background;
        const pass = (from, to, x, y) => {
            this.blurMaterial.uniforms.tMap.value = from.texture;
            this.blurMaterial.uniforms.uStep.value.set(x, y);
            renderer.setRenderTarget(to);
            renderer.render(this.quadScene, this.quadCamera);
        };
        const step = this.blur / this.target.width;
        pass(this.target, this.blurTarget, step, 0);
        pass(this.blurTarget, this.target, 0, step);
        pass(this.target, this.blurTarget, step * 0.4, 0);
        pass(this.blurTarget, this.target, 0, step * 0.4);
        renderer.setRenderTarget(previousTarget);
        renderer.setClearAlpha(clearAlpha);
        this.object.visible = shadowsVisible;
    }
    dispose() {
        this.target.dispose();
        this.blurTarget.dispose();
        this.depthMaterial.dispose();
        this.blurMaterial.dispose();
        this.planeMaterial.dispose();
        this.plane.geometry.dispose();
        this.quad.geometry.dispose();
    }
}
//# sourceMappingURL=shadow.js.map