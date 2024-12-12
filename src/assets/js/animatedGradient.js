import {
  Renderer,
  Transform,
  Camera,
  Program,
  Color,
  Mesh,
  Triangle,
  Vec2,
  Texture,
  Flowmap,
} from "ogl";
import FluidSim from "./fluidSim";
import glslify from "glslify";
import Mouse from "./mouse";
import Raf from "./raf";
import gsap from 'gsap'
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger)

const vertex = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
	vUv = uv;
	gl_Position = vec4(position, 0, 1);
}
`;
const glsl = require("glslify");

const fragment = /* glsl */ glslify`

precision highp float;

uniform float uTime;
uniform float uRatio;
uniform vec3 uColor1;
uniform vec3 uColor2;
uniform vec3 uColor3;
uniform vec2 uResolution;
uniform sampler2D uTexture1;
uniform sampler2D uTexture2;
uniform sampler2D tFlow;
uniform sampler2D tFluid;
uniform float uPixelProgress;
uniform float uPixelProgress2;
uniform vec2 uMousePos;
uniform float uMouseVel;
uniform float uPixelSize;
uniform float uProgress;
#define S(a,b,t) smoothstep(a,b,t)

varying vec2 vUv;


vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x*34.0)+1.0)*x);
}

float snoise(vec2 v)
  {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
// First corner
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

// Other corners
  vec2 i1;
  //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
  //i1.y = 1.0 - i1.x;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  // x0 = x0 - 0.0 + 0.0 * C.xx ;
  // x1 = x0 - i1 + 1.0 * C.xx ;
  // x2 = x0 - 1.0 + 2.0 * C.xx ;
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

// Permutations
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
    + i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

// Gradients: 41 points uniformly over a line, mapped onto a diamond.
// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

// Normalise gradients implicitly by scaling m
// Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

// Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float circle(in vec2 _st, in float _radius, in float smooth){
    vec2 dist = _st-vec2(0.5);
    dist.y *= uResolution.y/uResolution.x;
	return 1.-smoothstep(_radius-(_radius*0.01 + smooth),
						_radius+(_radius*0.01 + smooth),
                         dot(dist,dist)*4.0);
}

float plot(vec2 st) {    
    return smoothstep(0.02, 0.0, st.x);
}



// Created by inigo quilez - iq/2014
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.
vec2 hash( vec2 p )
{
    p = vec2( dot(p,vec2(2127.1,81.17)), dot(p,vec2(1269.5,283.37)) );
	return fract(sin(p)*43758.5453);
}

float noise( in vec2 p )
{
    vec2 i = floor( p );
    vec2 f = fract( p );
	
	vec2 u = f*f*(3.0-2.0*f);

    float n = mix( mix( dot( -1.0+2.0*hash( i + vec2(0.0,0.0) ), f - vec2(0.0,0.0) ), 
                        dot( -1.0+2.0*hash( i + vec2(1.0,0.0) ), f - vec2(1.0,0.0) ), u.x),
                   mix( dot( -1.0+2.0*hash( i + vec2(0.0,1.0) ), f - vec2(0.0,1.0) ), 
                        dot( -1.0+2.0*hash( i + vec2(1.0,1.0) ), f - vec2(1.0,1.0) ), u.x), u.y);
	return 0.5 + 0.5*n;
}

mat2 Rot(float a)
{
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
}

void main() {
	vec2 coordinates = vUv - 0.5;

	vec3 flow = texture2D(tFluid, vUv).rgb;
	// vec2 fluidUv = vUv - fluid.rg * 0.0002;


	float noiseValX = noise(vec2(vUv.x * ( 5. * sin(uTime * 0.001)), vUv.y * ( 5. * cos(uTime * 0.001))));
	float noiseValY = noise(vec2(vUv.y * ( 5. * sin(uTime * 0.001)), vUv.x * ( 5. * cos(uTime * 0.001))));
   
	vec2 pixelSize =  vec2(40./(uResolution.x), 40./uResolution.y);
	vec2 positionHover = floor( coordinates/(pixelSize) )*(pixelSize) + .5;
	
	float circleCenter = circle(vec2(vUv.x + (noiseValX - 0.5 ) * 0.25, vUv.y + (noiseValX- 0.5) * 0.25 ), .1, 2.);
	float centerNoise = noise(vec2(uTime * 0.001 + vUv.x * (3. + 1. * sin(uTime * 0.001)), vUv.y * (3. + 1. * cos(uTime * 0.001))));
	centerNoise = smoothstep(centerNoise, 0.2,  0.5);
	float center = smoothstep(min(centerNoise + circleCenter, 1.) , 1., 0.3);



    float ratio = uResolution.x / uResolution.y;

	float noiseTime = uTime * 0.005;
    vec2 tuv = vUv;
    tuv -= .5;

    // rotate with Noise
    float degree = noise(vec2(noiseTime*.1 - flow.b * 0.1, tuv.x*tuv.y + flow.b * 0.1));

    tuv.y *= 1./ratio;
    tuv *= Rot(radians((degree-.5)*720.+180.));
	tuv.y *= ratio;

    
    // Wave warp with sin
    float frequency = 5.;
    float amplitude = 5.;
    float speed = noiseTime * 2.;
    tuv.x += sin(tuv.y*frequency+speed)/amplitude;
   	tuv.y += sin(tuv.x*frequency*1.5+speed)/(amplitude*.5);
    
    
    // draw the image
    vec3 layer1 = mix(uColor1, uColor3, clamp(S(-.3, .2, (tuv*Rot(radians(-5.))).x)  * (1. + clamp(flow.b,-1., 1.)) , 0., 1.));
    
    vec3 layer2 = mix(uColor2, uColor3, clamp(S(-.3, .2, (tuv*Rot(radians(-5.))).x)  * (1. + clamp(flow.b,-1., 1.)) , 0., 1.));
    
    vec3 finalComp = mix(layer1, layer2, S(.5, -.3, tuv.y  * (1. + clamp(flow.b,-1., 1.)) ));
	
    
    vec3 col = finalComp;



	gl_FragColor.rgb = mix(col, vec3(0.), pow(circleCenter * 0., 1.5)) ;
	// gl_FragColor.rgb = flow * 0.1 + 0.5;
	gl_FragColor.a = 1.;
}
`;

export default class animatedGradient {
  constructor(dom) {
	this.domSize = dom.getBoundingClientRect()
    this.wSize = {
      w: this.domSize.width,
      h: this.domSize.height,
    };

    this.dom = dom;
    this.offsetY = 0;
	this.offsetX = 0;
    this.time = 0;


    this.init();
  }

  init() {
    this.renderer = new Renderer({ dpr: 2 });
    this.renderer.setSize(this.wSize.w, this.wSize.h);
    this.gl = this.renderer.gl;
    this.dom.appendChild(this.gl.canvas);
    this.gl.clearColor(1, 1, 1, 1);

    this.scene = new Transform();
    this.camera = new Camera(this.gl, {
      near: 0.5,
      far: 1000,
      aspect: this.wSize.w / this.wSize.h,
    });
    this.camera.position.set(0, 0, 0);

    this.mouse = new Mouse(this.dom);
    this.raf = new Raf();

    // this.raf.suscribe("gradient", this.animate, 60);

    this.fluidSim = new FluidSim(this.gl, this.mouse);
	this.fluidSim.offsetX = this.domSize.left / window.innerWidth

    this.setFlow();
    this.setPlane();
    this.animate();

    window.addEventListener("resize", this.onResize);
	this.setScrollTrigger()
  }

  setPlane() {
    this.resolution = new Vec2(this.wSize.w, this.wSize.h);
    const geometry = new Triangle(this.gl);
    this.texture = new Texture(this.gl);

    const program = new Program(this.gl, {
      vertex,
      fragment,
      uniforms: {
        uTime: { value: 0 },
        uColor3: { value: new Color("#9F327E") },
        uColor2: { value: new Color("#EA6644") },
        uColor1: { value: new Color("#F5B532") },
        uResolution: { value: this.resolution },
        uPixelProgress: { value: 1 },
        uPixelProgress2: { value: 1 },
        uRatio: { value: 16 / 9 },
        uMousePos: { value: new Vec2() },
        uMouseVel: { value: 1 },
        tFlow: this.flowmap.uniform,
        tFluid: { value: null },
        uPixelSize: { value: this.type === 3 ? 50 : 200 },
        uProgress: { value: 0 },
      },
    });

    this.mesh = new Mesh(this.gl, { geometry, program });
    this.mesh.setParent(this.scene);

    // console.log(Mouse)

    this.animate();
  }

  setFlow() {
    this.flowmap = new Flowmap(this.gl, { dissipation: 0.99, size: 300 });
  }

  setScrollTrigger(){
	this.scroll = ScrollTrigger.create({
		trigger: this.dom,
		start: 'top bottom',
		end: 'bottom top',
		onUpdate: (self) => {
			this.offsetY = (self.progress - 0.5) * 2
			if(this.fluidSim){
				this.fluidSim.offsetY = this.offsetY
			}
		},
		onEnter: () => {
			this.raf.suscribe("gradient", this.animate, 60);
		},
		onEnterBack: () => {
			this.raf.suscribe("gradient", this.animate, 60);
		},
		onLeave: () => {
			this.raf.unsuscribe("gradient", this.animate, 60);
		},
		onLeaveBack: () => {
			this.raf.unsuscribe("gradient", this.animate, 60);
		}
	})
  }

  animate = () => {
    this.time++;

    this.mouse.update();

    if (this.fluidSim) {
      this.fluidSim.update(this.time);
    }

    //UPDATE FLOWMAP
    this.flowmap.aspect = this.wSize.w / this.wSize.h;
    this.flowmap.mouse.copy(
      new Vec2(
        this.mouse.cursor[0] + 0.5,
        -this.mouse.cursor[1] + 0.5 + this.offset
      )
    );

    const velocityVec = new Vec2(
      this.mouse.velocity[0],
      this.mouse.velocity[1]
    );
    this.flowmap.velocity.lerp(velocityVec, 0.1);

    this.flowmap.update();

    if (this.fluidSim) {
      this.mesh.program.uniforms.tFluid.value =
        this.fluidSim.density.read.texture;
    } else {
      this.mesh.program.uniforms.tFluid.value = this.texture;
    }

    this.mesh.program.uniforms.uTime.value = this.time;
    this.renderer.render({ scene: this.scene, camera: this.camera });
  };

  onResize = () => {
    this.wSize = {
      w: this.dom.getBoundingClientRect().width,
      h: this.dom.getBoundingClientRect().height,
    };
    this.renderer.setSize(this.wSize.w, this.wSize.h);
    this.mesh.program.uniforms.uResolution.value = new Vec2(
      this.wSize.w,
      this.wSize.h
    );
  };
}
