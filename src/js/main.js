
@import "./classes/file.js"
@import "./classes/effect.js"
@import "./classes/effectPass.js"
@import "./classes/renderer.js"
@import "./classes/screenshots.js"
@import "./classes/shader.js"
@import "./modules/vecTypes.js"


const yshader = {
	init() {
		// fast references
		this.content = window.find("content");
	},
	dispatch(event) {
		switch (event.type) {
			case "window.init":
				break;
			case "open-help":
				karaqu.shell("fs -u '~/help/index.md'");
				break;
		}
	}
};

window.exports = yshader;
