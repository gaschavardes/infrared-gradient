import { vec2 } from 'gl-matrix';
import Emitter from 'event-emitter';
// import DebugController from '@/glxp/debug/debugController'

const _VEC2 = vec2.create();

export default class Mouse {
	constructor(target) {
		this.cursor = vec2.fromValues(0, 0);
		this.lastCursor = vec2.fromValues(0, 0);
		this.velocity = vec2.fromValues(0, 0);
		this.dampedCursor = vec2.fromValues(0.5, 0.5);

		this.target = target || window;
		this.wheelVelocity = vec2.fromValues(0, 0);
		this.wheel = vec2.fromValues(0, 0);
		this.lastWheel = vec2.fromValues(0, 0);
		this.screenWidth = window.innerWidth;
		this.screenHeight = window.innerHeight;
		this.isDown = false;
		this.wheelDir = null;
		this.emitter = {};

		this.preventDamping = false;

		Emitter(this.emitter);
		this.on = this.emitter.on.bind(this.emitter);
		this.off = this.emitter.off.bind(this.emitter);


		this.config = {
			damping: { value: 0.1, range: [0, 0.5] },
		};

		// DebugController.addConfig(this.config, 'Mouse')

		this.initEvents();
	}

	initEvents() {
		this.target.addEventListener('touchstart', (event) => { this.onDown(event.touches[0]); });
		this.target.addEventListener('touchend', (event) => { this.onUp(event.touches[0]); });
		this.target.addEventListener('touchmove', (event) => {
			event.preventDefault();
			this.onMouve(event.touches[0]);
		});

		this.target.addEventListener('mousedown', (event) => { this.onDown(event); });
		this.target.addEventListener('mousemove', (event) => { this.onMouve(event); });
		this.target.addEventListener('mouseup', (event) => { this.onUp(event); });

		this.target.addEventListener('wheel', (event) => { this.onWheel(event); });

		this.target.addEventListener('click', () => { this.emitter.emit('click'); });
		this.target.addEventListener('resize', () => {
			this.screenWidth = window.innerWidth;
			this.screenHeight = window.innerHeight;
		});
	}

	onDown(event) {
		this.cursor[0] = (event.clientX / this.screenWidth - 0.5);
		this.cursor[1] = (event.clientY / this.screenHeight - 0.5);
		this.lastCursor[0] = this.cursor[0];
		this.lastCursor[1] = this.cursor[1];
		this.isDown = true;
		this.emitter.emit('down', this);
	}

	onUp() {
		this.isDown = false;
		this.emitter.emit('up', this);
	}

	onWheel(event) {
		this.lastWheel[0] = this.wheel[0];
		this.lastWheel[1] = this.wheel[1];
		this.wheel[0] = event.deltaX;
		this.wheel[1] = event.deltaY;
		this.wheelDir = event.deltaY < 0 ? 'up' : 'down';
		this.emitter.emit('wheel', this);
	}

	onMouve(event) {
		this.cursor[0] = (event.clientX / this.screenWidth - 0.5);
		this.cursor[1] = (event.clientY / this.screenHeight - 0.5);
		this.emitter.emit('mouve', this);
		if (this.isDown) { this.emitter.emit('drag', this); }
	}

	update() {
		this.velocity[0] = this.cursor[0] - this.lastCursor[0];
		this.velocity[1] = this.cursor[1] - this.lastCursor[1];
		this.wheelVelocity[0] = this.wheel[0] - this.lastWheel[0];
		this.wheelVelocity[1] = this.wheel[1] - this.lastWheel[1];
		this.lastCursor[0] = this.cursor[0];
		this.lastCursor[1] = this.cursor[1];

		if (!this.preventDamping) {
			vec2.sub(_VEC2, this.cursor, this.dampedCursor);
			vec2.scale(_VEC2, _VEC2, this.config.damping.value);
			vec2.add(this.dampedCursor, this.dampedCursor, _VEC2);
		}
	}
}
