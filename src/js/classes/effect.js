
class Effect {
	constructor(vr, ac, canvas, callback, obj, forceMuted, forcePaused, resizeCallback, crashCallback) {
		this.iChannel = {
			buffer: "/cdn/img/3d-inputs/buffer/",
			texture: "/cdn/img/3d-inputs/textures/",
			webcam: "/cdn/img/3d-inputs/webcam/webcam.png",
			cubemap: "/cdn/img/3d-inputs/cubemap/",
			volume: "/cdn/img/3d-inputs/volume/",
		};

		this.mCanvas = canvas;
		this.mGLContext = canvas.getContext("webgl2", this.glOpts);
		this.mXres = canvas.width;
		this.mYres = canvas.height;
		this.mCreated = false;
		this.mWebVR = vr;
		this.mRenderingStereo = false;
		this.mRenderer = new Renderer(this.mGLContext);
		this.mAudioContext = ac;
		this.mForceMuted = ac === null ? true : forceMuted;
		this.mForcePaused = forcePaused;
		this.mGainNode = null;
		this.mPasses = [];
		this.mFrame = 0;
		this.mTextureCallbackFun = callback;
		this.mTextureCallbackObj = obj;
		this.mMaxBuffers = 4;
		this.mMaxCubeBuffers = 1;
		this.mMaxPasses = this.mMaxBuffers + 4;
		this.mBuffers = [];
		this.mCubeBuffers = [];
		this.mScreenshotSytem = new Screenshots(this.mRenderer);
		this.mCompilationTime = 0;

		var caps = this.mRenderer.GetCaps();
		this.mIs20 = caps.mIsGL20;
		this.mShaderTextureLOD = caps.mShaderTextureLOD;
		//-------------
		if (ac !== null) {   
			this.mGainNode = ac.createGain();
			if (!forceMuted) this.mGainNode.connect(ac.destination);
			if (this.mForceMuted) this.mGainNode.gain.value = 0.0;
			else this.mGainNode.gain.value = 1.0;
		}

		let vsSourceC = "layout(location = 0) in vec2 pos; void main() { gl_Position = vec4(pos.xy,0.0,1.0); }";
		let fsSourceC = "uniform vec4 v; uniform sampler2D t; out vec4 outColor; void main() { outColor = textureLod(t, gl_FragCoord.xy / v.zw, 0.0); }";
		this.mRenderer.CreateShader(vsSourceC, fsSourceC, false, true, (worked, info) => {
			if (worked === false) console.log(`Failed to compile shader to copy buffers : ${info.mErrorStr}`);
			else this.mProgramCopy = info;
		});

		let vsSourceD = "layout(location = 0) in vec2 pos; void main() { gl_Position = vec4(pos.xy,0.0,1.0); }";
		let fsSourceD = "uniform vec4 v; uniform sampler2D t; out vec4 outColor; void main() { vec2 uv = gl_FragCoord.xy / v.zw; outColor = texture(t, vec2(uv.x,1.0-uv.y)); }";
		this.mRenderer.CreateShader(vsSourceD, fsSourceD, false, true, (worked, info) => {
			if (worked === false) console.log(`Failed to compile shader to downscale buffers : ${info.mErrorStr}`);
			else this.mProgramDownscale = info;
		});

		// set all buffers and cubemaps to null
		for (let i=0; i<this.mMaxBuffers; i++) {
			this.mBuffers[i] = {
				mTexture: [null, null], 
				mTarget:  [null, null], 
				mResolution: [0, 0],
				mLastRenderDone: 0,
				mThumbnailRenderTarget: null,
				mThumbnailTexture: null,
				mThumbnailBuffer:  null,
				mThumbnailRes: [0, 0]
			};
		}
		for (let i=0; i<this.mMaxCubeBuffers; i++) {
			this.mCubeBuffers[i] = {
				mTexture: [null, null], 
				mTarget:  [null, null], 
				mResolution: [0, 0],
				mLastRenderDone: 0,
				mThumbnailRenderTarget: null,
				mThumbnailTexture: null,
				mThumbnailBuffer:  null,
				mThumbnailRes: [0, 0]
			};
		}
		//-------
		let keyboardData = new Uint8Array(256 * 3);
		for (let j=0; j<(256*3); j++) {
			keyboardData[j] = 0;
		}
		let kayboardTexture = this.mRenderer.CreateTexture(this.mRenderer.TEXTYPE.T2D, 256, 3, this.mRenderer.TEXFMT.C1I8, this.mRenderer.FILTER.NONE, this.mRenderer.TEXWRP.CLAMP, null);
		let keyboardImage = new Image();
		this.mKeyboard = { mData: keyboardData, mTexture: kayboardTexture, mIcon: keyboardImage };

		let iResize = (xres, yres) => {
				xres = Math.round(+xres / this.mTextureCallbackObj.mQuality);
 				yres = Math.round(+yres / this.mTextureCallbackObj.mQuality);
				this.mCanvas.width = xres;
				this.mCanvas.height = yres;
				this.mXres = xres;
				this.mYres = yres;
				this.ResizeBuffers(xres, yres);
				resizeCallback(xres, yres);
			},
			bestAttemptFallback = () => {
				let devicePixelRatio = window.devicePixelRatio || 1;
				let xres = Math.round(this.mCanvas.offsetWidth  * devicePixelRatio) | 0;
				let yres = Math.round(this.mCanvas.offsetHeight * devicePixelRatio) | 0;
				iResize(xres, yres);
			};

		this.mRO = new ResizeObserver((entries, observer) => {
			var entry = entries[0];
			if (!entry["devicePixelContentBoxSize"]) {
				observer.unobserve(this.mCanvas);
				console.log("WARNING: This browser doesn't support ResizeObserver + device-pixel-content-box (2)");
				bestAttemptFallback();
				window.addEventListener("resize", bestAttemptFallback);
			} else {
				// prevent this - causes infinite resize
				return;
				
				let box = entry.devicePixelContentBoxSize[0];
				let xres = box.inlineSize;
				let yres = box.blockSize;
				iResize(xres, yres);
			}
		});

		try {
			this.mRO.observe(this.mCanvas, { box: ["device-pixel-content-box"] });
		} catch (e) {
			console.log("WARNING: This browser doesn't support ResizeObserver + device-pixel-content-box (1)");
			bestAttemptFallback();
			window.addEventListener("resize", bestAttemptFallback);
		}

		this.mCreated = true;
	}

	get glOpts() {
		return {
			alpha: false, 
			depth: false, 
			stencil: false, 
			antialias: false, 
			premultipliedAlpha: false, 
			preserveDrawingBuffer: true, 
			powerPreference: "high-performance",
		};
	}

	Load(jobj) {
		let numPasses = jobj.renderpass.length;
		if (numPasses < 1 || numPasses > this.mMaxPasses) {
			if (this.mTextureCallbackObj.mDebug) {
				APP.els.details.state.html(`Corrupted Shader - ${numPasses}`);
			}
			return false;
		}
		this.mPasses = [];
		for (let j=0; j<numPasses; j++) {
			let rpass = jobj.renderpass[j];
			// skip sound passes if in thumbnail mode
			if (this.mForceMuted && rpass.type === "sound") continue;

			let wpass = new EffectPass(this.mRenderer, this.mIs20, this.mIsLowEnd, this.mShaderTextureLOD,
									   this.mTextureCallbackFun, this.mTextureCallbackObj, this.mForceMuted, this.mForcePaused, this.mGainNode,
									   this.mProgramDownscale, j, this);

			wpass.Create(rpass.type, this.mAudioContext);

			let numInputs = rpass.inputs.length;
			for (let i = 0; i < 4; i++) {
				wpass.NewTexture(this.mAudioContext, i, null, null, null);
			}
			for (let i = 0; i < numInputs; i++) {
				let lid  = rpass.inputs[i].channel;
				let mType = rpass.inputs[i].type;
				let mID  = rpass.inputs[i].id;
				let mSrc = this.iChannel[mType] + rpass.inputs[i].filepath;
				let mSampler = rpass.inputs[i].sampler;

				wpass.NewTexture(this.mAudioContext, lid, { mType, mID, mSrc, mSampler, mSrc }, this.mBuffers, this.mCubeBuffers, this.mKeyboard);
			}
			for (let i = 0; i < 4; i++) {
				wpass.SetOutputs(i, null);
			}
			let numOutputs = rpass.outputs.length;
			for (let i = 0; i < numOutputs; i++) {
				let outputID = rpass.outputs[i].id;
				let outputCH = rpass.outputs[i].channel;
				wpass.SetOutputs(outputCH, outputID);
			}
			// create some hardcoded names. This should come from the DB
			let rpassName = "";
			if (rpass.type === "common" ) rpassName = "Common";
			if (rpass.type === "sound"  ) rpassName = "Sound";
			if (rpass.type === "image"  ) rpassName = "Image";
			if (rpass.type === "buffer" ) rpassName = "Buffer "+ String.fromCharCode(65 + assetID_to_bufferID(wpass.mOutputs[0]));
			if (rpass.type === "cubemap") rpassName = "Cube A";// " + String.fromCharCode(65 + assetID_to_bufferID(this.mPasses[j].mOutputs[0]));
			
			wpass.SetName(rpassName);
			wpass.SetCode(rpass.code);

			this.mPasses.push(wpass);
		}
		return true;
	}

	ResizeBuffers(xres, yres) {
		for (let i=0; i<this.mMaxBuffers; i++ ) {
			this.ResizeBuffer(i, xres, yres, true);
		}
	}

	IsEnabledVR() {
		return this.mRenderingStereo ? true : false;
	}

	EnableVR() {
		if(!this.mWebVR.IsSupported()) return;
		if(this.mRenderingStereo) return;

		this.mRenderingStereo = true;
		this.mWebVR.Enable();
	}

	DisableVR() {
		if(!this.mWebVR.IsSupported()) return;
		if(!this.mRenderingStereo) return;

		this.mRenderingStereo = false;
		this.mWebVR.Disable();
	}

	GetTexture(passid, slot) {
		return this.mPasses[passid].GetTexture(slot);
	}

	NewTexture(passid, slot, url) {
		return this.mPasses[passid].NewTexture(this.mAudioContext, slot, url, this.mBuffers, this.mCubeBuffers, this.mKeyboard);
	}

	SetOutputs(passid, slot, url) {
		this.mPasses[passid].SetOutputs(slot, url);
	}

	SetOutputsByBufferID(passid, slot, id) {
		this.mPasses[passid].SetOutputsByBufferID(slot, id);
	}

	GetAcceptsLinear(passid, slot) {
		return this.mPasses[passid].GetAcceptsLinear(slot);
	}

	GetAcceptsMipmapping(passid, slot) {
		return this.mPasses[passid].GetAcceptsMipmapping(slot);
	}

	GetAcceptsWrapRepeat(passid, slot) {
		return this.mPasses[passid].GetAcceptsWrapRepeat(slot);
	}

	GetAcceptsVFlip(passid, slot) {
		return this.mPasses[passid].GetAcceptsVFlip(slot);
	}

	SetSamplerFilter(passid, slot, str) {
		this.mPasses[passid].SetSamplerFilter(slot, str, this.mBuffers, this.mCubeBuffers);
	}

	GetTranslatedShaderSource(passid) {
		return this.mPasses[passid].GetTranslatedShaderSource();
	}

	GetSamplerFilter(passid, slot) {
		return this.mPasses[passid].GetSamplerFilter(slot);
	}

	SetSamplerWrap(passid, slot, str) {
		this.mPasses[passid].SetSamplerWrap(slot, str, this.mBuffers);
	}

	GetSamplerWrap(passid, slot) {
		return this.mPasses[passid].GetSamplerWrap(slot);
	}
	
	SetSamplerVFlip(passid, slot, str) {
		this.mPasses[passid].SetSamplerVFlip(slot, str);
	}
	
	GetSamplerVFlip(passid, slot) {
		return this.mPasses[passid].GetSamplerVFlip(slot);
	}
	
	GetHeaderSize(passid) {
		return this.mPasses[passid].mHeaderLength + 
			   this.mRenderer.GetShaderHeaderLines(1);
	}

	ResizeBuffer(i, xres, yres, skipIfNotExists) {
		if (skipIfNotExists && this.mBuffers[i].mTexture[0] === null) return;

		let oldXres = this.mBuffers[i].mResolution[0];
		let oldYres = this.mBuffers[i].mResolution[1];

		if (oldXres !== xres || oldYres !== yres ) {
			let needCopy = (this.mBuffers[i].mTexture[0] !== null);
			let texture1 = this.mRenderer.CreateTexture(this.mRenderer.TEXTYPE.T2D,
								xres, yres,
								this.mRenderer.TEXFMT.C4F32,
								(needCopy) ? this.mBuffers[i].mTexture[0].mFilter : this.mRenderer.FILTER.NONE,
								(needCopy) ? this.mBuffers[i].mTexture[0].mWrap   : this.mRenderer.TEXWRP.CLAMP, 
								null);

			let texture2 = this.mRenderer.CreateTexture(this.mRenderer.TEXTYPE.T2D,
								xres, yres,
								this.mRenderer.TEXFMT.C4F32,
								(needCopy) ? this.mBuffers[i].mTexture[1].mFilter : this.mRenderer.FILTER.NONE,
								(needCopy) ? this.mBuffers[i].mTexture[1].mWrap   : this.mRenderer.TEXWRP.CLAMP, 
								null);

			let target1 = this.mRenderer.CreateRenderTarget(texture1, null, null, null, null, false);
			let target2 = this.mRenderer.CreateRenderTarget(texture2, null, null, null, null, false);

			if (needCopy) {
				let v = [0, 0, Math.min(xres, oldXres), Math.min(yres, oldYres)];
				this.mRenderer.SetBlend(false);
				this.mRenderer.SetViewport(v);
				this.mRenderer.AttachShader(this.mProgramCopy);
				let l1 = this.mRenderer.GetAttribLocation(this.mProgramCopy, "pos");
				let vOld = [0, 0, oldXres, oldYres];
				this.mRenderer.SetShaderConstant4FV("v", vOld);

				// Copy old buffers 1 to new buffer
				this.mRenderer.SetRenderTarget(target1);
				this.mRenderer.AttachTextures(1, this.mBuffers[i].mTexture[0], null, null, null);
				this.mRenderer.DrawUnitQuad_XY(l1);

				// Copy old buffers 2 to new buffer
				this.mRenderer.SetRenderTarget(target2);
				this.mRenderer.AttachTextures(1, this.mBuffers[i].mTexture[1], null, null, null);
				this.mRenderer.DrawUnitQuad_XY(l1);

				// Deallocate old memory
				this.mRenderer.DestroyTexture(this.mBuffers[i].mTexture[0]);
				this.mRenderer.DestroyRenderTarget(this.mBuffers[i].mTarget[0]);
				this.mRenderer.DestroyTexture(this.mBuffers[i].mTexture[1]);
				this.mRenderer.DestroyRenderTarget(this.mBuffers[i].mTarget[1]);
			}
			// Store new buffers
			this.mBuffers[i].mTexture = [texture1,texture2], 
			this.mBuffers[i].mTarget = [target1, target2 ], 
			this.mBuffers[i].mLastRenderDone = 0;
			this.mBuffers[i].mResolution[0] = xres;
			this.mBuffers[i].mResolution[1] = yres;
		}
	}

	Compile(preventCache, onResolve) {
		let Self = this,
			to = Shader.getRealTime(),
			allPromisses = [],
			numPasses = this.mPasses.length;
		for (let j=0; j<numPasses; j++) {
			allPromisses.push(new Promise((resolve, reject) => {
				Self.NewShader(j, preventCache, () => resolve(1));
			}));
		}
		// aggregated callback when all passes have been compiled
		Promise.all(allPromisses).then(values => {
			let totalError = false;
			for (let j = 0; j < numPasses; j++) {
				if (Self.mPasses[j].mError) {
					totalError = true;
					break;
				}
			}
			Self.mCompilationTime = Shader.getRealTime() - to;
			onResolve(!totalError);
		}).catch(console.log);
	}

	NewShader(passid, preventCache, onResolve) {
		let commonSourceCodes = [];
		for (let i=0; i<this.mPasses.length; i++) {
			if (this.mPasses[i].mType === "common") {
				commonSourceCodes.push(this.mPasses[i].mSource);
			}
		}
		this.mPasses[passid].NewShader(commonSourceCodes, preventCache, onResolve);
	}

	GetErrorGlobal() {
		for (let i=0; i<this.mPasses.length; i++) {
			if (this.mPasses[i].mError) {
				return true;
			}
		}
		return false;
	}

	GetTotalCompilationTime() {
		return this.mCompilationTime/1000;
	}

	GetError(id) {
		return this.mPasses[id].mError;
	}

	GetErrorStr(id) {
		return this.mPasses[id].mErrorStr;
	}

	UpdateInputs(passid, forceUpdate) {
		this.mPasses[passid].UpdateInputs(this.mAudioContext, forceUpdate, this.mKeyboard);
	}

	ResetTime() {
		this.mFrame = 0;
		this.mAudioContext.resume();

		let num = this.mPasses.length;
		for (let i=0; i<num; i++) {
			this.mPasses[i].mFrame = 0;
			for (let j=0; j<this.mPasses[i].mInputs.length; j++) {
				this.mPasses[i].RewindInput(this.mAudioContext, j);
			}
		}
	}

	RequestAnimationFrame(id) {
		if (this.mRenderingStereo && this.mWebVR.IsPresenting()) {
			this.mWebVR.RequestAnimationFrame(id);
		} else {
			requestAnimationFrame(id);
		}
	}

	PauseInput(passid, id) {
		return this.mPasses[passid].TooglePauseInput(this.mAudioContext, id);
	}

	ToggleMuteInput(passid, id) {
		return this.mPasses[passid].ToggleMuteInput(this.mAudioContext, id);
	}

	RewindInput(passid, id) {
		this.mPasses[passid].RewindInput(this.mAudioContext, id);
	}

	ResumeOutputs() {
		let wa = this.mAudioContext;
		let num = this.mPasses.length;
		for (let i=0; i<num; i++) {
			this.mPasses[i].ResumeOutput(wa);
		}
	}

	StopOutputs() {
		let wa = this.mAudioContext;
		let num = this.mPasses.length;
		for (let i=0; i<num; i++) {
			this.mPasses[i].StopOutput(wa);
		}
	}

	Paint(time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, isPaused) {
		let wa = this.mAudioContext;
		let da = new Date();
		let vrData = null;
		if (this.mRenderingStereo) vrData = this.mWebVR.GetData();
		let xres = this.mXres / 1;
		let yres = this.mYres / 1;

		if (this.mFrame === 0) {
			for (let i=0; i<this.mMaxBuffers; i++) {
				if (this.mBuffers[i].mTexture[0] !== null) {
					this.mRenderer.SetRenderTarget(this.mBuffers[i].mTarget[0]);
					this.mRenderer.Clear(this.mRenderer.CLEAR.Color, [0.0,0.0,0.0,0.0], 1.0, 0);
					this.mRenderer.SetRenderTarget(this.mBuffers[i].mTarget[1]);
					this.mRenderer.Clear(this.mRenderer.CLEAR.Color, [0.0,0.0,0.0,0.0], 1.0, 0);
					this.mRenderer.CreateMipmaps(this.mBuffers[i].mTexture[0]);
					this.mRenderer.CreateMipmaps(this.mBuffers[i].mTexture[1]);
				}
			}
			for (let i=0; i<this.mMaxCubeBuffers; i++) {
				if (this.mCubeBuffers[i].mTexture[0] !== null) {
					for (let face=0; face<6; face++) {
						this.mRenderer.SetRenderTargetCubeMap(this.mCubeBuffers[i].mTarget[0], face);
						this.mRenderer.Clear(this.mRenderer.CLEAR.Color, [0.0,0.0,0.0,0.0], 1.0, 0);
						this.mRenderer.SetRenderTargetCubeMap(this.mCubeBuffers[i].mTarget[1], face);
						this.mRenderer.Clear(this.mRenderer.CLEAR.Color, [0.0,0.0,0.0,0.0], 1.0, 0);
						this.mRenderer.CreateMipmaps(this.mCubeBuffers[i].mTexture[0]);
						this.mRenderer.CreateMipmaps(this.mCubeBuffers[i].mTexture[1]);
					}
				}
			}
		}
		let num = this.mPasses.length;
		// render sound first
		for (let i=0; i<num; i++) {
			if (this.mPasses[i].mType !== "sound") continue;
			if (this.mPasses[i].mProgram === null) continue;
			this.mPasses[i].Paint(vrData, wa, da, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, isPaused, null, false, this.mBuffers, this.mCubeBuffers, this.mKeyboard, this);
		}
		// render buffers second
		for (let i=0; i<num; i++) {
			if (this.mPasses[i].mType !== "buffer") continue;
			if (this.mPasses[i].mProgram === null) continue;
			let bufferID = assetID_to_bufferID(this.mPasses[i].mOutputs[0]);
			// check if any downstream pass needs mipmaps when reading from this buffer
			let needMipMaps = false;
			for (let j=0; j<num; j++) {
				for (let k=0; k<this.mPasses[j].mInputs.length; k++) {
					let inp = this.mPasses[j].mInputs[k];
					if (inp !==null && inp.mInfo.mType==="buffer" && inp.id === bufferID && inp.mInfo.mSampler.filter === "mipmap") {
						needMipMaps = true;
						break;
					}
				}
			}
			this.mPasses[i].Paint(vrData, wa, da, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, isPaused, bufferID, needMipMaps, this.mBuffers, this.mCubeBuffers, this.mKeyboard, this);
		}
		// render cubemap buffers second
		for (let i=0; i<num; i++ ) {
			if (this.mPasses[i].mType !== "cubemap") continue;
			if (this.mPasses[i].mProgram === null) continue;
			let bufferID = 0; //assetID_to_bufferID( this.mPasses[i].mOutputs[0]);
			// check if any downstream pass needs mipmaps when reading from this buffer
			let needMipMaps = false;
			for (let j=0; j<num; j++) {
				for (let k=0; k<this.mPasses[j].mInputs.length; k++) {
					let inp = this.mPasses[j].mInputs[k];
					if (inp !==null && inp.mInfo.mType === "cubemap") {
						if (assetID_to_cubemapBuferID(inp.mInfo.mID)===0 && inp.mInfo.mSampler.filter === "mipmap") {
							needMipMaps = true;
							break;
						}
					}
				}
			}
			this.mPasses[i].Paint(vrData, wa, da, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, isPaused, bufferID, needMipMaps, this.mBuffers, this.mCubeBuffers, this.mKeyboard, this);
		}
		// render image last
		for (let i=0; i<num; i++) {
			if (this.mPasses[i].mType !== "image") continue;
			if (this.mPasses[i].mProgram === null) continue;
			this.mPasses[i].Paint(vrData, wa, da, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, isPaused, null, false, this.mBuffers, this.mCubeBuffers, this.mKeyboard, this);
		}   
		// erase keypresses
		for (let k=0; k<256; k++) {
		   this.mKeyboard.mData[ k + 1*256 ] = 0;
		}
		this.mRenderer.UpdateTexture(this.mKeyboard.mTexture, 0, 0, 256, 3, this.mKeyboard.mData);
		if (this.mRenderingStereo) this.mWebVR.Finish();
		this.mFrame++;
	}

	calcFlags() {
		let mFlagVR = false,
			mFlagWebcam = false,
			mFlagSoundInput = false,
			mFlagSoundOutput = false,
			mFlagKeyboard = false,
			mFlagMultipass = false,
			mFlagMusicStream = false;
		
		this.mPasses.map(pass => {
			if (pass.mType === "sound") mFlagSoundOutput = true;
			if (pass.mType === "buffer") mFlagMultipass = true;

			for (let i = 0; i < 4; i++) {
				if (pass.mInputs[i] === null) continue;
				if (pass.mInputs[i].mInfo.mType === "webcam") mFlagWebcam = true;
				else if (pass.mInputs[i].mInfo.mType === "keyboard") mFlagKeyboard = true;
				else if (pass.mInputs[i].mInfo.mType === "mic") mFlagSoundInput = true;
				else if (pass.mInputs[i].mInfo.mType === "musicstream") mFlagMusicStream = true;
			}

			let n1 = pass.mSource.indexOf("mainVR(");
			let n2 = pass.mSource.indexOf("mainVR (");
			if (n1 > 0 || n2 > 0) mFlagVR = true;
		});

		return { mFlagVR, mFlagWebcam, mFlagSoundInput, mFlagSoundOutput, mFlagKeyboard, mFlagMultipass, mFlagMusicStream };
	}

}
