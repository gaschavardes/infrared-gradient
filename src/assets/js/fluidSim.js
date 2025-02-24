import {
  Renderer,
  Camera,
  RenderTarget,
  Geometry,
  Program,
  Mesh,
  Color,
  Vec2,
  Box,
  NormalProgram,
  Post,
} from "ogl";
import { vec2 } from "gl-matrix";

const fragment = /* glsl */ `
	precision highp float;

	uniform sampler2D tMap;
	uniform sampler2D tFluid;
	uniform float uTime;
	varying vec2 vUv;

	void main() {
		vec3 fluid = texture2D(tFluid, vUv).rgb;
		vec2 uv = vUv - fluid.rg * 0.0002;

		gl_FragColor = mix( texture2D(tMap, uv), vec4(fluid * 0.1 + 0.5, 1), step(0.5, vUv.x) ) ;

		// Oscillate between fluid values and the distorted scene
		// gl_FragColor = mix(texture2D(tMap, uv), vec4(fluid * 0.1 + 0.5, 1), smoothstep(0.0, 0.7, sin(uTime)));
	}
`;

const baseVertex = /* glsl */ `
	precision highp float;
	attribute vec2 position;
	attribute vec2 uv;
	varying vec2 vUv;
	varying vec2 vL;
	varying vec2 vR;
	varying vec2 vT;
	varying vec2 vB;
	uniform vec2 texelSize;
	void main () {
		vUv = uv;
		vL = vUv - vec2(texelSize.x, 0.0);
		vR = vUv + vec2(texelSize.x, 0.0);
		vT = vUv + vec2(0.0, texelSize.y);
		vB = vUv - vec2(0.0, texelSize.y);
		gl_Position = vec4(position, 0, 1);
	}
`;

const clearShader = /* glsl */ `
	precision mediump float;
	precision mediump sampler2D;
	varying highp vec2 vUv;
	uniform sampler2D uTexture;
	uniform float value;
	void main () {
		gl_FragColor = value * texture2D(uTexture, vUv);
	}
`;

const splatShader = /* glsl */ `
	precision highp float;
	precision highp sampler2D;
	varying vec2 vUv;
	uniform sampler2D uTarget;
	uniform float aspectRatio;
	uniform vec3 color;
	uniform vec2 point;
	uniform float radius;
	void main () {
		vec2 p = vUv - point.xy;
		p.x *= aspectRatio;
		vec3 splat = exp(-dot(p, p) / radius) * color;
		vec3 base = texture2D(uTarget, vUv).xyz;
		gl_FragColor = vec4(base + splat, 1.0);
	}
`;

const advectionManualFilteringShader = /* glsl */ `
	precision highp float;
	precision highp sampler2D;
	varying vec2 vUv;
	uniform sampler2D uVelocity;
	uniform sampler2D uSource;
	uniform vec2 texelSize;
	uniform vec2 dyeTexelSize;
	uniform float dt;
	uniform float dissipation;
	vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
		vec2 st = uv / tsize - 0.5;
		vec2 iuv = floor(st);
		vec2 fuv = fract(st);
		vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
		vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
		vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
		vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
		return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
	}
	void main () {
		vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
		gl_FragColor = dissipation * bilerp(uSource, coord, dyeTexelSize);
		gl_FragColor.a = 1.0;
	}
`;

const advectionShader = /* glsl */ `
	precision highp float;
	precision highp sampler2D;
	varying vec2 vUv;
	uniform sampler2D uVelocity;
	uniform sampler2D uSource;
	uniform vec2 texelSize;
	uniform float dt;
	uniform float dissipation;
	void main () {
		vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
		gl_FragColor = dissipation * texture2D(uSource, coord);
		gl_FragColor.a = 1.0;
	}
`;

const divergenceShader = /* glsl */ `
	precision mediump float;
	precision mediump sampler2D;
	varying highp vec2 vUv;
	varying highp vec2 vL;
	varying highp vec2 vR;
	varying highp vec2 vT;
	varying highp vec2 vB;
	uniform sampler2D uVelocity;
	void main () {
		float L = texture2D(uVelocity, vL).x;
		float R = texture2D(uVelocity, vR).x;
		float T = texture2D(uVelocity, vT).y;
		float B = texture2D(uVelocity, vB).y;
		vec2 C = texture2D(uVelocity, vUv).xy;
		if (vL.x < 0.0) { L = -C.x; }
		if (vR.x > 1.0) { R = -C.x; }
		if (vT.y > 1.0) { T = -C.y; }
		if (vB.y < 0.0) { B = -C.y; }
		float div = 0.5 * (R - L + T - B);
		gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
	}
`;

const curlShader = /* glsl */ `
	precision mediump float;
	precision mediump sampler2D;
	varying highp vec2 vUv;
	varying highp vec2 vL;
	varying highp vec2 vR;
	varying highp vec2 vT;
	varying highp vec2 vB;
	uniform sampler2D uVelocity;
	void main () {
		float L = texture2D(uVelocity, vL).y;
		float R = texture2D(uVelocity, vR).y;
		float T = texture2D(uVelocity, vT).x;
		float B = texture2D(uVelocity, vB).x;
		float vorticity = R - L - T + B;
		gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
	}
`;

const vorticityShader = /* glsl */ `
	precision highp float;
	precision highp sampler2D;
	varying vec2 vUv;
	varying vec2 vL;
	varying vec2 vR;
	varying vec2 vT;
	varying vec2 vB;
	uniform sampler2D uVelocity;
	uniform sampler2D uCurl;
	uniform float curl;
	uniform float dt;
	void main () {
		float L = texture2D(uCurl, vL).x;
		float R = texture2D(uCurl, vR).x;
		float T = texture2D(uCurl, vT).x;
		float B = texture2D(uCurl, vB).x;
		float C = texture2D(uCurl, vUv).x;
		vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
		force /= length(force) + 0.0001;
		force *= curl * C;
		force.y *= -1.0;
		vec2 vel = texture2D(uVelocity, vUv).xy;
		gl_FragColor = vec4(vel + force * dt, 0.0, 1.0);
	}
`;

const pressureShader = /* glsl */ `
	precision mediump float;
	precision mediump sampler2D;
	varying highp vec2 vUv;
	varying highp vec2 vL;
	varying highp vec2 vR;
	varying highp vec2 vT;
	varying highp vec2 vB;
	uniform sampler2D uPressure;
	uniform sampler2D uDivergence;
	void main () {
		float L = texture2D(uPressure, vL).x;
		float R = texture2D(uPressure, vR).x;
		float T = texture2D(uPressure, vT).x;
		float B = texture2D(uPressure, vB).x;
		float C = texture2D(uPressure, vUv).x;
		float divergence = texture2D(uDivergence, vUv).x;
		float pressure = (L + R + B + T - divergence) * 0.25;
		gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
	}
`;

const gradientSubtractShader = /* glsl */ `
	precision mediump float;
	precision mediump sampler2D;
	varying highp vec2 vUv;
	varying highp vec2 vL;
	varying highp vec2 vR;
	varying highp vec2 vT;
	varying highp vec2 vB;
	uniform sampler2D uPressure;
	uniform sampler2D uVelocity;
	void main () {
		float L = texture2D(uPressure, vL).x;
		float R = texture2D(uPressure, vR).x;
		float T = texture2D(uPressure, vT).x;
		float B = texture2D(uPressure, vB).x;
		vec2 velocity = texture2D(uVelocity, vUv).xy;
		velocity.xy -= vec2(R - L, T - B);
		gl_FragColor = vec4(velocity, 0.0, 1.0);
	}
`;

export default class FluidSim {
  constructor(gl, mouse) {
    this.wSize = {
      w: window.innerWidth,
      h: window.innerHeight,
    };
    this.gl = gl;
    this.post = new Post(this.gl);
    this.mouse = mouse;
	this.offsetX = 0
	this.offsetY = 0

    window.addEventListener("resize", this.onResize);
    this.onResize();
    this.init();
  }

  init() {
    this.splats = [];
    // Resolution of simulation
    this.simRes = 32;
    this.dyeRes = 512;

    // Main inputs to control look and feel of fluid
    this.iterations = 5;
    this.densityDissipation = 0.9;
    this.velocityDissipation = 0.9;
    this.pressureDissipation = 0.1;
    this.curlStrength = 0.1;
    this.radius = 1;

    // Common uniform
    this.texelSize = { value: new Vec2(1 / this.simRes) };
    // Get supported formats and types for FBOs
    let supportLinearFiltering =
      this.gl.renderer.extensions[
        `OES_texture_${this.gl.renderer.isWebgl2 ? `` : `half_`}float_linear`
      ];
    this.halfFloat = this.gl.renderer.isWebgl2
      ? this.gl.HALF_FLOAT
      : this.gl.renderer.extensions["OES_texture_half_float"].HALF_FLOAT_OES;
    this.filtering = supportLinearFiltering ? this.gl.LINEAR : this.gl.NEAREST;
    let rgba, rg, r;

    if (this.gl.renderer.isWebgl2) {
      this.rgba = this.getSupportedFormat(
        this.gl,
        this.gl.RGBA16F,
        this.gl.RGBA,
        this.halfFloat
      );
      this.rg = this.getSupportedFormat(
        this.gl,
        this.gl.RG16F,
        this.gl.RG,
        this.halfFloat
      );
      this.r = this.getSupportedFormat(
        this.gl,
        this.gl.R16F,
        this.gl.RED,
        this.halfFloat
      );
    } else {
      this.rgba = this.getSupportedFormat(
        this.gl,
        this.gl.RGBA,
        this.gl.RGBA,
        this.halfFloat
      );
      this.rg = rgba;
      this.r = rgba;
    }

    this.createFBOs();

    this.pass = this.post.addPass({
      fragment,
      uniforms: {
        tFluid: { value: null },
        uTime: { value: 0 },
      },
    });
  }

  createFBOs() {
    this.density = this.createDoubleFBO(this.gl, {
      width: this.dyeRes,
      height: this.dyeRes,
      type: this.halfFloat,
      format: this.rgba?.format,
      internalFormat: this.rgba?.internalFormat,
      minFilter: this.filtering,
      depth: false,
    });

    this.velocity = this.createDoubleFBO(this.gl, {
      width: this.simRes,
      height: this.simRes,
      type: this.halfFloat,
      format: this.rg?.format,
      internalFormat: this.rg?.internalFormat,
      minFilter: this.filtering,
      depth: false,
    });

    this.pressure = this.createDoubleFBO(this.gl, {
      width: this.simRes,
      height: this.simRes,
      type: this.halfFloat,
      format: this.r?.format,
      internalFormat: this.r?.internalFormat,
      minFilter: this.gl.NEAREST,
      depth: false,
    });

    this.divergence = new RenderTarget(this.gl, {
      width: this.simRes,
      height: this.simRes,
      type: this.halfFloat,
      format: this.r?.format,
      internalFormat: this.r?.internalFormat,
      minFilter: this.gl.NEAREST,
      depth: false,
    });

    this.curl = new RenderTarget(this.gl, {
      width: this.simRes,
      height: this.simRes,
      type: this.halfFloat,
      format: this.r?.format,
      internalFormat: this.r?.internalFormat,
      minFilter: this.gl.NEAREST,
      depth: false,
    });

    // Geometry to be used for the simulation programs
    this.triangle = new Geometry(this.gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) },
    });

    const texelSize = this.texelSize;

    // Create fluid simulation programs
    this.clearProgram = new Mesh(this.gl, {
      geometry: this.triangle,
      program: new Program(this.gl, {
        vertex: baseVertex,
        fragment: clearShader,
        uniforms: {
          texelSize,
          uTexture: { value: null },
          value: { value: this.pressureDissipation },
        },
        depthTest: false,
        depthWrite: false,
      }),
    });

    this.splatProgram = new Mesh(this.gl, {
      geometry: this.triangle,
      program: new Program(this.gl, {
        vertex: baseVertex,
        fragment: splatShader,
        uniforms: {
          texelSize,
          uTarget: { value: null },
          aspectRatio: { value: 1 },
          color: { value: new Color() },
          point: { value: new Vec2() },
          radius: { value: this.radius / 100 },
        },
        depthTest: false,
        depthWrite: false,
      }),
    });

    this.advectionProgram = new Mesh(this.gl, {
      geometry: this.triangle,
      program: new Program(this.gl, {
        vertex: baseVertex,
        fragment: this.supportLinearFiltering
          ? advectionShader
          : advectionManualFilteringShader,
        uniforms: {
          texelSize,
          dyeTexelSize: { value: new Vec2(1 / this.dyeRes) },
          uVelocity: { value: null },
          uSource: { value: null },
          dt: { value: 0.016 },
          dissipation: { value: 1 },
        },
        depthTest: false,
        depthWrite: false,
      }),
    });

    this.divergenceProgram = new Mesh(this.gl, {
      geometry: this.triangle,
      program: new Program(this.gl, {
        vertex: baseVertex,
        fragment: divergenceShader,
        uniforms: {
          texelSize,
          uVelocity: { value: null },
        },
        depthTest: false,
        depthWrite: false,
      }),
    });

    this.curlProgram = new Mesh(this.gl, {
      geometry: this.triangle,
      program: new Program(this.gl, {
        vertex: baseVertex,
        fragment: curlShader,
        uniforms: {
          texelSize,
          uVelocity: { value: null },
        },
        depthTest: false,
        depthWrite: false,
      }),
    });

    this.vorticityProgram = new Mesh(this.gl, {
      geometry: this.triangle,
      program: new Program(this.gl, {
        vertex: baseVertex,
        fragment: vorticityShader,
        uniforms: {
          texelSize,
          uVelocity: { value: null },
          uCurl: { value: null },
          curl: { value: this.curlStrength },
          dt: { value: 0.016 },
        },
        depthTest: false,
        depthWrite: false,
      }),
    });

    this.pressureProgram = new Mesh(this.gl, {
      geometry: this.triangle,
      program: new Program(this.gl, {
        vertex: baseVertex,
        fragment: pressureShader,
        uniforms: {
          texelSize,
          uPressure: { value: null },
          uDivergence: { value: null },
        },
        depthTest: false,
        depthWrite: false,
      }),
    });

    this.gradientSubtractProgram = new Mesh(this.gl, {
      geometry: this.triangle,
      program: new Program(this.gl, {
        vertex: baseVertex,
        fragment: gradientSubtractShader,
        uniforms: {
          texelSize,
          uPressure: { value: null },
          uVelocity: { value: null },
        },
        depthTest: false,
        depthWrite: false,
      }),
    });
  }

  getSupportedFormat(gl, internalFormat, format, type) {
    if (!this.supportRenderTextureFormat(gl, internalFormat, format, type)) {
      switch (internalFormat) {
        case gl.R16F:
          return this.getSupportedFormat(gl, gl.RG16F, gl.RG, type);
        case gl.RG16F:
          return this.getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
        default:
          return null;
      }
    }

    return { internalFormat, format };
  }

  supportRenderTextureFormat(gl, internalFormat, format, type) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      internalFormat,
      4,
      4,
      0,
      format,
      type,
      null
    );

    let fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status != gl.FRAMEBUFFER_COMPLETE) return false;
    return true;
  }

  // Helper to create a ping-pong FBO pairing for simulating on GPU
  createDoubleFBO(
    gl,
    {
      width,
      height,
      wrapS,
      wrapT,
      minFilter = gl.LINEAR,
      magFilter = minFilter,
      type,
      format,
      internalFormat,
      depth,
    } = {}
  ) {
    const options = {
      width,
      height,
      wrapS,
      wrapT,
      minFilter,
      magFilter,
      type,
      format,
      internalFormat,
      depth,
    };
    const fbo = {
      read: new RenderTarget(gl, options),
      write: new RenderTarget(gl, options),
      swap: () => {
        let temp = fbo.read;
        fbo.read = fbo.write;
        fbo.write = temp;
      },
    };
    return fbo;
  }

  splat({ x, y, dx, dy }) {
    this.splatProgram.program.uniforms.uTarget.value =
      this.velocity.read.texture;
    this.splatProgram.program.uniforms.aspectRatio.value =
      this.gl.renderer.width / this.gl.renderer.height;
    this.splatProgram.program.uniforms.point.value.set(x, y);
    this.splatProgram.program.uniforms.color.value.set(dx, dy, 1);

    this.gl.renderer.render({
      scene: this.splatProgram,
      target: this.velocity.write,
      sort: false,
      update: false,
    });
    this.velocity.swap();

    this.splatProgram.program.uniforms.uTarget.value =
      this.density.read.texture;

    this.gl.renderer.render({
      scene: this.splatProgram,
      target: this.density.write,
      sort: false,
      update: false,
    });
    this.density.swap();
  }

  update(t) {
    if (vec2.length(this.mouse.velocity) > 0) {
      this.splats.push({
        x: 0.5 + this.mouse.cursor[0],
        y: 0.5 - this.mouse.cursor[1] - this.offsetY,
        dx: this.mouse.velocity[0] * this.wSize.w,
        dy: this.mouse.velocity[1] * -this.wSize.h,
      });
    }


    this.gl.renderer.autoClear = false;
    for (let i = this.splats.length - 1; i >= 0; i--) {
      this.splat(this.splats.splice(i, 1)[0]);
    }

    this.curlProgram.program.uniforms.uVelocity.value =
      this.velocity.read.texture;

    this.gl.renderer.render({
      scene: this.curlProgram,
      target: this.curl,
      sort: false,
      update: false,
    });

    this.vorticityProgram.program.uniforms.uVelocity.value =
      this.velocity.read.texture;
    this.vorticityProgram.program.uniforms.uCurl.value = this.curl.texture;

    this.gl.renderer.render({
      scene: this.vorticityProgram,
      target: this.velocity.write,
      sort: false,
      update: false,
    });
    this.velocity.swap();

    this.divergenceProgram.program.uniforms.uVelocity.value =
      this.velocity.read.texture;

    this.gl.renderer.render({
      scene: this.divergenceProgram,
      target: this.divergence,
      sort: false,
      update: false,
    });

    this.clearProgram.program.uniforms.uTexture.value =
      this.pressure.read.texture;

    this.gl.renderer.render({
      scene: this.clearProgram,
      target: this.pressure.write,
      sort: false,
      update: false,
    });
    this.pressure.swap();

    this.pressureProgram.program.uniforms.uDivergence.value =
      this.divergence.texture;

    for (let i = 0; i < this.iterations; i++) {
      this.pressureProgram.program.uniforms.uPressure.value =
        this.pressure.read.texture;

      this.gl.renderer.render({
        scene: this.pressureProgram,
        target: this.pressure.write,
        sort: false,
        update: false,
      });
      this.pressure.swap();
    }

    this.gradientSubtractProgram.program.uniforms.uPressure.value =
      this.pressure.read.texture;
    this.gradientSubtractProgram.program.uniforms.uVelocity.value =
      this.velocity.read.texture;

    this.gl.renderer.render({
      scene: this.gradientSubtractProgram,
      target: this.velocity.write,
      sort: false,
      update: false,
    });
    this.velocity.swap();

    this.advectionProgram.program.uniforms.dyeTexelSize.value.set(
      1 / this.simRes
    );
    this.advectionProgram.program.uniforms.uVelocity.value =
      this.velocity.read.texture;
    this.advectionProgram.program.uniforms.uSource.value =
      this.velocity.read.texture;
    this.advectionProgram.program.uniforms.dissipation.value =
      this.velocityDissipation;

    this.gl.renderer.render({
      scene: this.advectionProgram,
      target: this.velocity.write,
      sort: false,
      update: false,
    });
    this.velocity.swap();

    this.advectionProgram.program.uniforms.dyeTexelSize.value.set(
      1 / this.dyeRes
    );
    this.advectionProgram.program.uniforms.uVelocity.value =
      this.velocity.read.texture;
    this.advectionProgram.program.uniforms.uSource.value =
      this.density.read.texture;
    this.advectionProgram.program.uniforms.dissipation.value =
      this.densityDissipation;

    this.gl.renderer.render({
      scene: this.advectionProgram,
      target: this.density.write,
      sort: false,
      update: false,
    });
    this.density.swap();

    // Set clear back to default
    this.gl.renderer.autoClear = true;

    // Update post pass uniform with the simulation output
    this.pass.uniforms.tFluid.value = this.density.read.texture;
  }

  onResize = () => {
    this.post.resize();
    this.wSize = {
      w: window.innerWidth,
      h: window.innerHeight,
    };
  };
}
