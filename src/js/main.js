
@import "./classes/file.js"
@import "./classes/effect.js"
@import "./classes/effectPass.js"
@import "./classes/renderer.js"
@import "./classes/screenshots.js"
@import "./classes/shader.js"
@import "./modules/vecTypes.js"

@import "./modules/test.js"


const yshader = {
	init() {
		// fast references
		this.els = {
			content: window.find("content"),
			canvas: window.find(".main-canvas"),
			details: {
				resolution: window.find(".resolution"),
				quality: window.find(".quality"),
				time: window.find(".time"),
				frameRate: window.find(".frameRate"),
				state: window.find(".state"),
			},
			textures: {
				el: window.find(".textures"),
				iChannel0: window.find(".iChannel0")[0],
				iChannel1: window.find(".iChannel1")[0],
				iChannel2: window.find(".iChannel2")[0],
				iChannel3: window.find(".iChannel3")[0],
			}
		};
		
		// check debug mode
		if (this.debug) this.els.content.addClass("debug");

		// instantiate shader object
		this.shader = new Shader(this.els.canvas[0], 1, this.debug);

		// DEV-ONLY-START
		Test.init(this);
		// DEV-ONLY-END
	},
	dispatch(event) {
		let Self = yshader,
			name,
			value,
			el;
		switch (event.type) {
			// system events
			case "window.init":
				// populate menu
				window.bluePrint
					.selectNodes(`//Shaders/*[not(@hidden)]`)
					.map(xShader => window.menuBar.add({
						"parent": "//MenuBar//Menu[@name='Shaders']",
						"name": xShader.getAttribute("name"),
						"click": "select-shader",
						"check-group": "selected-file",
						// "is-checked": 1,
					}));
				break;
			case "window.resize":
				Self.shader.quality = Self.shader.quality;
				break;
			case "window.close":
				if (Self.opener) {
					Self.opener.callback({ ...Self.opener, type: "yshader-close" });
				}
				break;
			// custom events
			case "open-help":
				karaqu.shell("fs -u '~/help/index.md'");
				break;
			case "set-quality":
				Self.quality(+event.arg);
				break;
			case "select-shader":
				name = event.name || event.xMenu.getAttribute("name");
				Self.start(name);
				break;
			case "toggle-shader":
			case "pause-shader":
				Self.pause();
				break;
			case "run-shader":
				Self.shader.Load({
					ver: "0.1",
					renderpass: [{
						inputs: [],
						outputs: [],
						type: "image",
						code: event.code,
					}],
				});
				// save referennce to opener
				Self.opener = event;
				// reset & play if paused
				if (Self.shader.paused) Self.shader.resetPlay();
				break;
		}
	},
	pause() {
		if (this.shader) this.shader.pauseTime();
		// make sure window is focused
		// if (!window.isFocues) window.focus();
	},
	quality(i) {
		this.shader.quality = +i;
		// make sure window is focused
		// if (!window.isFocues) window.focus();
	},
	start(name) {
		let xPath = `//Shaders/*[@name="${name}"]`,
			xShader = window.bluePrint.selectSingleNode(xPath),
			xRenderpass = xShader.selectNodes(`./renderpass`),
			data = {
				ver: "0.1",
				renderpass: []
			};
		// loop render passes
		xRenderpass.map(xPass => {
			let pass = {
					inputs: [],
					outputs: [],
					code: xPass.selectSingleNode(`./code`).textContent,
					type: xPass.getAttribute("type"),
				};
			// loop input nodes
			xPass.selectNodes(`./inputs`).map(xInput => {
				pass.inputs.push({
						id: xInput.getAttribute("id"),
						channel: xInput.getAttribute("channel"),
						filepath: xInput.getAttribute("filepath"),
						type: xInput.getAttribute("type"),
						sampler: {
						    filter: xInput.getAttribute("s-filter"),
						    wrap: xInput.getAttribute("s-wrap"),
						    vflip: xInput.getAttribute("s-vflip"),
						    srgb: xInput.getAttribute("s-srgb"),
						    internal: xInput.getAttribute("s-internal"),
						}
					});
			});
			xPass.selectNodes(`./outputs`).map(xOutput => {
				pass.outputs.push({
						id: xOutput.getAttribute("id"),
						channel: xOutput.getAttribute("channel"),
					});
			});
			// add to render pass array
			data.renderpass.push(pass);
		});
		// init shader, in not already
		if (!this.shader) this.shader = new Shader(this.els.canvas[0], 1, this.debug);
		// return console.log(data);
		this.shader.Load(data);
		// reset & play if paused
		if (this.shader.paused) this.shader.resetPlay();
		// make sure window is focused
		// if (!window.isFocues) window.focus();
	}
};

const APP = yshader;

window.exports = yshader;
