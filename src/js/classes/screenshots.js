
class Screenshots {
	constructor(renderer) {
		// private
		this.mTexture = null;
		this.mTarget = null;
		this.mXres = 0;
		this.mYres = 0;
		this.mRenderer = renderer;
		
		let vsSourceC = "layout(location = 0) in vec2 pos; void main() { gl_Position = vec4(pos.xy,0.0,1.0); }";
		let fsSourceC = "uniform samplerCube t; out vec4 outColor; void main() { vec2 px = gl_FragCoord.xy/vec2(4096.0,2048.0); vec2 an = 3.1415926535898 * (px*vec2(2.0, 1.0) - vec2(0.0,0.5)); vec3 rd = vec3(-cos(an.y) * sin(an.x), sin(an.y), cos(an.y) * cos(an.x)); outColor = texture(t, rd); }";
		
		let compileShader = (worked, info) => {
			if (worked === false) {
				console.log(`Failed to compile cubemap resample shader (${info.mErrorType}): ${info.mErrorStr}`);
			} else {
				this.mCubemapToEquirectProgram = info;
			}
		}

		this.mRenderer.CreateShader(vsSourceC, fsSourceC, false, true, compileShader);
	}

	Allocate(xres, yres) {
		if (xres > mXres || yres > mYres) {
			let texture = this.mRenderer.CreateTexture(this.mRenderer.TEXTYPE.T2D, xres, yres, this.mRenderer.TEXFMT.C4F32, this.mRenderer.FILTER.NONE, this.mRenderer.TEXWRP.CLAMP, null);
			let target = this.mRenderer.CreateRenderTarget(texture, null, null, null, null, false);

			if (mXres !== 0) {
				this.mRenderer.DestroyTexture(mTexture);
				this.mRenderer.DestroyRenderTarget(mTarget);
			}

			this.mTexture = texture;
			this.mTarget = target;
			this.mXres = xres;
			this.mYres = yres;
		}
	}

	GetProgram() {
		return this.mCubemapToEquirectProgram;
	}

	GetTarget() {
		return this.mTarget;
	}
}
