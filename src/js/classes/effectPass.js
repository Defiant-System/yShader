
class EffectPass {
	constructor(renderer, is20, isLowEnd, hasShaderTextureLOD, callback, obj, forceMuted, forcePaused, outputGainNode, copyProgram, id, effect) {
		this.mID = id;
		this.mInputs  = [null, null, null, null ];
		this.mOutputs = [null, null, null, null ];
		this.mSource = null;

		this.mGainNode = outputGainNode;
		this.mSoundShaderCompiled = false;

		this.mEffect = effect;
		this.mRenderer = renderer;
		this.mProgramCopy = copyProgram; 
		this.mCompilationTime = 0;

		this.mType = "none";
		this.mName = "none";
		this.mFrame = 0;

		this.mShaderTextureLOD = hasShaderTextureLOD;
		this.mIs20 = is20;
		this.mIsLowEnd = isLowEnd;
		this.mTextureCallbackFun = callback;
		this.mTextureCallbackObj = obj;
		this.mForceMuted = forceMuted;
		this.mForcePaused = forcePaused;
	}

	MakeHeaderImage() {
		let inputs = this.mInputs.map((inp, i) => {
				let out = "";
				if (inp === null) out += `uniform sampler2D iChannel${i};`;
				else if (inp.mInfo.mType==="cubemap") out += `uniform samplerCube iChannel${i};`;
				else if (inp.mInfo.mType==="volume") out += `uniform sampler3D iChannel${i};`;
				else out += `uniform sampler2D iChannel${i};`;

				let sampler = "sampler2D";
				if (inp === null) sampler = "sampler2D";
				else if (inp.mInfo.mType === "cubemap") sampler = "samplerCube";
				else if (inp.mInfo.mType === "volume") sampler = "sampler3D";

				out += `uniform struct {
					${sampler} sampler;
					vec3  size;
					float time;
					int   loaded;
				}iCh${i};\n`

				return out;
			});

		this.mHeaderLength = 0;
		this.mHeader = `#define HW_PERFORMANCE ${ this.mIsLowEnd === true ? "0" : "1" }
			uniform vec3      iResolution;
			uniform float     iTime;
			uniform float     iChannelTime[4];
			uniform vec4      iMouse;
			uniform vec4      iDate;
			uniform float     iSampleRate;
			uniform vec3      iChannelResolution[4];
			uniform int       iFrame;
			uniform float     iTimeDelta;
			uniform float     iFrameRate;

			${inputs.join("\n")}
			
			void mainImage( out vec4 c, in vec2 f );
			void st_assert( bool cond );
			void st_assert( bool cond, int v );

			out vec4 shader_out_color;
			void st_assert( bool cond, int v ) {if(!cond){if(v==0)shader_out_color.x=-1.0;else if(v==1)shader_out_color.y=-1.0;else if(v==2)shader_out_color.z=-1.0;else shader_out_color.w=-1.0;}}
			void st_assert( bool cond        ) {if(!cond)shader_out_color.x=-1.0;}
			void main( void )
			{
				shader_out_color = vec4(1.0,1.0,1.0,1.0); 
				vec4 color = vec4(0.0,0.0,0.0,1.0);
				mainImage( color, gl_FragCoord.xy );
				if(shader_out_color.x<0.0) color=vec4(1.0,0.0,0.0,1.0);
				if(shader_out_color.y<0.0) color=vec4(0.0,1.0,0.0,1.0);
				if(shader_out_color.z<0.0) color=vec4(0.0,0.0,1.0,1.0);
				if(shader_out_color.w<0.0) color=vec4(1.0,1.0,0.0,1.0);
				shader_out_color = vec4(color.xyz,1.0);
			}\n`;
	}

	MakeHeaderBuffer() {
		let inputs = this.mInputs.map((inp, i) => {
				let out = "";
				if (inp === null) out += `uniform sampler2D iChannel${i};`;
				else if (inp.mInfo.mType==="cubemap" ) out += `uniform samplerCube iChannel${i};`;
				else if (inp.mInfo.mType==="volume"  ) out += `uniform sampler3D iChannel${i};`;
				else out += `uniform sampler2D iChannel${i};`;
				return out;
			});

		this.mHeaderLength = 0;
		this.mHeader = `#define HW_PERFORMANCE ${ this.mIsLowEnd === true ? "0" : "1" }
			uniform vec3      iResolution;
			uniform float     iTime;
			uniform float     iChannelTime[4];
			uniform vec4      iMouse;
			uniform vec4      iDate;
			uniform float     iSampleRate;
			uniform vec3      iChannelResolution[4];
			uniform int       iFrame;
			uniform float     iTimeDelta;
			uniform float     iFrameRate;

			${inputs.join("\n")}

			void mainImage( out vec4 c,  in vec2 f );

			out vec4 outColor;
			void main( void ) {
				vec4 color = vec4(0.0,0.0,0.0,1.0);
				mainImage( color, gl_FragCoord.xy );
				outColor = color;
			}\n`;
	}

	MakeHeaderCubemap() {
		let inputs = this.mInputs.map((inp, i) => {
				let out = "";
				if (inp === null) out += `uniform sampler2D iChannel${i};`;
				else if (inp.mInfo.mType === "cubemap") out += `uniform samplerCube iChannel${i};`;
				else if (inp.mInfo.mType === "volume") out += `uniform sampler3D iChannel${i};`;
				else out += `uniform sampler2D iChannel${i};`;
				return out;
			});

		this.mHeaderLength = 0;
		this.mHeader = `#define HW_PERFORMANCE ${ this.mIsLowEnd === true ? "0" : "1" }
				uniform vec3      iResolution;
				uniform float     iTime;
				uniform float     iChannelTime[4];
				uniform vec4      iMouse;
				uniform vec4      iDate;
				uniform float     iSampleRate;
				uniform vec3      iChannelResolution[4];
				uniform int       iFrame;
				uniform float     iTimeDelta;
				uniform float     iFrameRate;

			${inputs.join("\n")}

			void mainCubemap( out vec4 c, in vec2 f, in vec3 ro, in vec3 rd );

			uniform vec4 unViewport;
			uniform vec3 unCorners[5];
			out vec4 outColor;

			void main( void ) {
				vec4 color = vec4(0.0,0.0,0.0,1.0);
				vec3 ro = unCorners[4];
				vec2 uv = (gl_FragCoord.xy - unViewport.xy)/unViewport.zw; 
				vec3 rd = normalize( mix( mix( unCorners[0], unCorners[1], uv.x ),
										  mix( unCorners[3], unCorners[2], uv.x ), uv.y ) - ro); 

				mainCubemap( color, gl_FragCoord.xy-unViewport.xy, ro, rd );
				outColor = color;
			}\n`;
	}

	MakeHeaderSound() {
		let inputs = this.mInputs.map((inp, i) => {
				let out = "";
				if (inp !== null && inp.mInfo.mType === "cubemap") out += `uniform samplerCube iChannel${i};`;
				else out += `uniform sampler2D iChannel${i};`;
				return out;
			});

		this.mHeaderLength = 0;
		this.mHeader = `#define HW_PERFORMANCE ${ this.mIsLowEnd === true ? "0" : "1" }
				uniform float     iChannelTime[4];
				uniform float     iTimeOffset;
				uniform int       iSampleOffset;
				uniform vec4      iDate;
				uniform float     iSampleRate;
				uniform vec3      iChannelResolution[4];

			${inputs.join("\n")}

			vec2 mainSound( in int samp, float time );

			out vec4 outColor;
			void main() {
				float t = iTimeOffset + ((gl_FragCoord.x-0.5) + (gl_FragCoord.y-0.5)*512.0)/iSampleRate;
				int   s = iSampleOffset + int(gl_FragCoord.y-0.2)*512 + int(gl_FragCoord.x-0.2);
				vec2 y = mainSound( s, t );
				vec2 v  = floor((0.5+0.5*y)*65536.0);
				vec2 vl = mod(v,256.0)/255.0;
				vec2 vh = floor(v/256.0)/255.0;
				outColor = vec4(vl.x,vh.x,vl.y,vh.y);
			}\n`;
	}

	MakeHeaderCommon() {
		this.mHeaderLength = 6;
		this.mHeader = `uniform vec4      iDate;
						uniform float     iSampleRate;
						out vec4 outColor;
						void main( void ) {
							outColor = vec4(0.0);
						}\n`;
	}

	MakeHeader() {
		switch (this.mType) {
			case "image": this.MakeHeaderImage(); break;
			case "sound": this.MakeHeaderSound(); break;
			case "buffer": this.MakeHeaderBuffer(); break;
			case "common": this.MakeHeaderCommon(); break;
			case "cubemap": this.MakeHeaderCubemap(); break;
			default: console.error("ERROR 4");
		}
	}

	CreateImage(wa) {
		this.MakeHeader();
		this.mSampleRate = 44100;
		this.mSupportsVR = false;
		this.mProgram = null;
		this.mError = false;
		this.mErrorStr = "";
		this.mTranslatedSource = null;
	}

	CreateBuffer(wa) {
		this.MakeHeader();
		this.mSampleRate = 44100;
		this.mSupportsVR = false;
		this.mProgram = null;
		this.mError = false;
		this.mErrorStr = "";
		this.mTranslatedSource = null;
	}

	CreateCubemap(wa) {
		this.MakeHeader();
		this.mSampleRate = 44100;
		this.mProgram = null;
		this.mError = false;
		this.mErrorStr = "";
		this.mTranslatedSource = null;
	}

	CreateCommon(wa) {
		this.mProgram = null;
		this.mError = false;
		this.mErrorStr = "";
		this.MakeHeader();
	}

	CreateSound(wa) {
		this.MakeHeader();
		this.mProgram = null;
		this.mError = false;
		this.mErrorStr = "";
		this.mTranslatedSource = null;
		this.mSampleRate = 44100;
		this.mPlayTime = 60*3;
		this.mPlaySamples = this.mPlayTime*this.mSampleRate;
		this.mBuffer = wa.createBuffer(2, this.mPlaySamples, this.mSampleRate);
		//-------------------
		this.mTextureDimensions = 512;
		this.mRenderTexture = this.mRenderer.CreateTexture(this.mRenderer.TEXTYPE.T2D, 
														   this.mTextureDimensions, this.mTextureDimensions,
														   this.mRenderer.TEXFMT.C4I8,
														   this.mRenderer.FILTER.NONE,
														   this.mRenderer.TEXWRP.CLAMP, null);
		this.mRenderFBO = this.mRenderer.CreateRenderTarget(this.mRenderTexture, null, null, null, null, false);
		// ArrayBufferView pixels;
		this.mTmpBufferSamples = this.mTextureDimensions * this.mTextureDimensions;
		this.mData = new Uint8Array(this.mTmpBufferSamples * 4);
		this.mPlaying = false;
	}

	Create(passType, wa) {
		this.mType = passType;
		this.mSource = null;

		switch (passType) {
			case "image": this.CreateImage(wa); break;
			case "sound": this.CreateSound(wa); break;
			case "buffer": this.CreateBuffer(wa); break;
			case "common": this.CreateCommon(wa); break;
			case "cubemap": this.CreateCubemap(wa); break;
			default: console.error("ERROR 1");
		}
	}

	SetName(passName) {
		this.mName = passName;
	}

	SetCode(src) {
		this.mSource = src;
	}

	DestroyImage() {}
	DestroyBuffer() {}
	DestroyCubemap() {}
	DestroyCommon() {}

	DestroySound(wa) {
		if (this.mPlayNode !== null) this.mPlayNode.stop();
		this.mPlayNode = null;
		this.mBuffer = null;
		this.mData = null;
		this.mRenderer.DestroyRenderTarget(this.mRenderFBO);
		this.mRenderer.DestroyTexture(this.mRenderTexture);
	}

	Destroy(wa) {
		this.mSource = null;
		switch (this.mType) {
			case "image": this.DestroyImage(wa); break;
			case "sound": this.DestroySound(wa); break;
			case "buffer": this.DestroyBuffer(wa); break;
			case "common": this.DestroyCommon(wa); break;
			case "cubemap": this.DestroyCubemap(wa); break;
			default: console.error("ERROR 2");
		}
	}

	DestroyInput(id) {
		if (this.mInputs[id] === null) return;
		if (this.mInputs[id].mInfo.mType === "texture") {
			if (this.mInputs[id].globject !== null) {
				this.mRenderer.DestroyTexture(this.mInputs[id].globject);
			}
		}
		if (this.mInputs[id].mInfo.mType === "volume") {
			if (this.mInputs[id].globject !== null) {
				this.mRenderer.DestroyTexture(this.mInputs[id].globject);
			}
		} else if (this.mInputs[id].mInfo.mType === "webcam") {
			this.mInputs[id].video.pause();
			this.mInputs[id].video.src = "";

			if (this.mInputs[id].video.srcObject !== null) {
				let tracks = this.mInputs[id].video.srcObject.getVideoTracks();
				if (tracks) tracks[0].stop();
			}
			this.mInputs[id].video = null;
			if (this.mInputs[id].globject !== null) {
				this.mRenderer.DestroyTexture(this.mInputs[id].globject);
			}
		} else if (this.mInputs[id].mInfo.mType === "video") {
			this.mInputs[id].video.pause();
			this.mInputs[id].video = null;
			if (this.mInputs[id].globject !== null) {
				this.mRenderer.DestroyTexture(this.mInputs[id].globject);
			}
		} else if (this.mInputs[id].mInfo.mType === "music" || this.mInputs[id].mInfo.mType === "musicstream") {
			this.mInputs[id].audio.pause();
			this.mInputs[id].audio.mSound.mFreqData = null;
			this.mInputs[id].audio.mSound.mWaveData = null;
			this.mInputs[id].audio = null;

			if (this.mInputs[id].globject !== null) {
				this.mRenderer.DestroyTexture(this.mInputs[id].globject);
			}
		} else if (this.mInputs[id].mInfo.mType === "cubemap") {
			if (this.mInputs[id].globject !== null) {
				this.mRenderer.DestroyTexture(this.mInputs[id].globject);
			}
		} else if (this.mInputs[id].mInfo.mType === "keyboard") {
			//if (this.mInputs[id].globject != null)
			  //  this.mRenderer.DestroyTexture(this.mInputs[id].globject);
		} else if (this.mInputs[id].mInfo.mType === "mic") {
			this.mInputs[id].mic = null;
			if (this.mInputs[id].globject !== null) {
				this.mRenderer.DestroyTexture(this.mInputs[id].globject);
			}
		}
		this.mInputs[id] = null;
	}

	TooglePauseInput(wa, id) {
		let inp = this.mInputs[id];

		if (inp === null) {
			// ---
		} else {
			switch (inp.mInfo.mType) {
				case "texture": break;
				case "volume": break;
				case "video":
					if (inp.video.mPaused) {
						inp.video.play();
						inp.video.mPaused = false;
					} else {
						inp.video.pause();
						inp.video.mPaused = true;
					}
					return inp.video.mPaused;
				case "music":
				case "musicstream":
					wa.resume()
					if (inp.audio.mPaused) {
						if (inp.loaded) inp.audio.play();
						inp.audio.mPaused = false;
					} else {
						inp.audio.pause();
						inp.audio.mPaused = true;
					}
					return inp.audio.mPaused;
			}
		}
		return null;
	}

	StopInput(id) {
		let inp = this.mInputs[id];

		if (inp === null) {
			// ---
		} else {
			switch (inp.mInfo.mType) {
				case "texture": break;
				case "volume": break;
				case "video":
					if (inp.video.mPaused === false) {
						inp.video.pause();
						inp.video.mPaused = true;
					}
					return inp.video.mPaused;
				case "music":
				case "musicstream":
					if (inp.audio.mPaused === false) {
						inp.audio.pause();
						inp.audio.mPaused = true;
					}
					return inp.audio.mPaused;
			}
		}
		return null;
	}

	ResumeInput(id) {
		let inp = this.mInputs[id];

		if (inp === null) {
			// ---
		} else {
			switch (inp.mInfo.mType) {
				case "texture": break;
				case "volume": break;
				case "video":
					if (inp.video.mPaused) {
						inp.video.play();
						inp.video.mPaused = false;
					}
					return inp.video.mPaused;
				case "music":
				case "musicstream":
					if (inp.audio.mPaused) {
						inp.audio.play();
						inp.audio.mPaused = false;
					}
					return inp.audio.mPaused;
			}
		}
		return null;
	}

	RewindInput(wa, id) {
		let inp = this.mInputs[id];

		if (inp === null) {
			// ---
		} else {
			switch (inp.mInfo.mType) {
				case "texture": break;
				case "volume": break;
				case "video":
					if (inp.loaded) {
						inp.video.currentTime = 0;
					}
					break;
				case "music":
				case "musicstream":
					wa.resume()
					if (inp.loaded) {
						inp.audio.currentTime = 0;
					}
					break;
			}
		}
	}

	MuteInput( wa, id) {
		let inp = this.mInputs[id];
		if (inp === null) return;

		switch (inp.mInfo.mType) {
			case "video":
				inp.video.muted = true;
				inp.video.mMuted = true;
				break;
			case "music":
			case "musicstream":
				if (wa !== null) inp.audio.mSound.mGain.gain.value = 0.0;
				inp.audio.mMuted = true;
				break;
		}
	}

	UnMuteInput( wa, id) {
		let inp = this.mInputs[id];
		if (inp === null) return;

		switch (inp.mInfo.mType) {
			case "video":
				inp.video.muted = false;
				inp.video.mMuted = false;
				break;
			case "music":
			case "musicstream":
				if (wa !== null) inp.audio.mSound.mGain.gain.value = 1.0;
				inp.audio.mMuted = false;
				break;
		}
	}

	ToggleMuteInput( wa, id) {
		var me = this;
		let inp = this.mInputs[id];
		if (inp===null) return null;

		switch (inp.mInfo.mType) {
			case "video":
				if (inp.video.mMuted) this.UnMuteInput(wa,id);
				else this.MuteInput(wa,id);
				return inp.video.mMuted;
			case "music":
			case "musicstream":
				if (inp.audio.mMuted) this.UnMuteInput(wa,id);
				else this.MuteInput(wa,id);
				return inp.audio.mMuted;
		}
		return null;
	}

	UpdateInputs(wa, forceUpdate, keyboard) {
		for (let i=0; i<this.mInputs.length; i++) {
			let inp = this.mInputs[i];

			if (inp === null) {
				if (forceUpdate) {
					if (this.mTextureCallbackFun!==null) {
						this.mTextureCallbackFun(this.mTextureCallbackObj, i, null, false, 0, 0, -1.0, this.mID);
					}
				}
			} else {
				switch (inp.mInfo.mType) {
					case "texture":
						if (inp.loaded && forceUpdate) {
							if (this.mTextureCallbackFun !== null) {
								this.mTextureCallbackFun(this.mTextureCallbackObj, i, inp.image, true, 1, 1, -1.0, this.mID);
							}
						}
						break;
					case "volume":
						if (inp.loaded && forceUpdate) {
							if (this.mTextureCallbackFun !== null) {
								this.mTextureCallbackFun(this.mTextureCallbackObj, i, inp.mPreview, true, 1, 1, -1.0, this.mID);
							}
						}
						break;
					case "cubemap":
						if (inp.loaded && forceUpdate) {
							if (this.mTextureCallbackFun!==null) {
								let img = (assetID_to_cubemapBuferID(inp.mInfo.mID) === -1) ? inp.image[0] : inp.mImage;
								this.mTextureCallbackFun(this.mTextureCallbackObj, i, img, true, 2, 1, -1.0, this.mID);
							}
						}
						break;
					case "keyboard":
						if (this.mTextureCallbackFun !== null) {
							this.mTextureCallbackFun(this.mTextureCallbackObj, i, {mImage:keyboard.mIcon,mData:keyboard.mData}, false, 6, 0, -1.0, this.mID);
						}
						break;
					case "video":
						if (inp.video.readyState === inp.video.HAVE_ENOUGH_DATA) {
							if (this.mTextureCallbackFun !== null) {
								this.mTextureCallbackFun(this.mTextureCallbackObj, i, inp.video, false, 3, 1, -1, this.mID);
							}
						}
						break;
					case "music":
					case "musicstream":
						if (inp.loaded && inp.audio.mPaused === false && inp.audio.mForceMuted === false) {
							if (wa !== null) {
								inp.audio.mSound.mAnalyser.getByteFrequencyData(inp.audio.mSound.mFreqData);
								inp.audio.mSound.mAnalyser.getByteTimeDomainData(inp.audio.mSound.mWaveData);
							}
							if (this.mTextureCallbackFun !== null) {
								if (inp.mInfo.mType === "music") this.mTextureCallbackFun(this.mTextureCallbackObj, i, {wave: (wa===null)? null : inp.audio.mSound.mFreqData}, false, 4, 1, inp.audio.currentTime, this.mID);
								else if (inp.mInfo.mType === "musicstream") this.mTextureCallbackFun(this.mTextureCallbackObj, i, {wave: (wa===null)? null : inp.audio.mSound.mFreqData, info: inp.audio.soundcloudInfo}, false, 8, 1, inp.audio.currentTime, this.mID);
							}
						} else if (inp.loaded === false) {
							if (this.mTextureCallbackFun !== null) {
								this.mTextureCallbackFun(this.mTextureCallbackObj, i, {wave: null}, false, 4, 0, -1.0, this.mID);
							}
						}
						break;
					case "mic":
						if (inp.loaded && inp.mForceMuted === false) {
							if (wa !== null) {
								inp.mAnalyser.getByteFrequencyData( inp.mFreqData);
								inp.mAnalyser.getByteTimeDomainData(inp.mWaveData);
							}
							if (this.mTextureCallbackFun !== null) {
								this.mTextureCallbackFun(this.mTextureCallbackObj, i, {wave: ((wa===null) ? null : inp.mFreqData) }, false, 5, 1, 0, this.mID);
							}
						}
						break;
					case "buffer":
						if (inp.loaded && forceUpdate) {
							if (this.mTextureCallbackFun !== null) {
								this.mTextureCallbackFun(this.mTextureCallbackObj, i, {texture:inp.image, data: null}, true, 9, 1, -1.0, this.mID);
							}
						}
						break;
				}
			}
		}
	}

	Sampler2Renderer(sampler) {
		let mFilter = this.mRenderer.FILTER.NONE;
		if (sampler.filter === "linear") mFilter = this.mRenderer.FILTER.LINEAR;
		if (sampler.filter === "mipmap") mFilter = this.mRenderer.FILTER.MIPMAP;

		let mWrap = this.mRenderer.TEXWRP.REPEAT;
		if (sampler.wrap === "clamp") mWrap = this.mRenderer.TEXWRP.CLAMP;

		let mVFlip = false;
		if (sampler.vflip === "true") mVFlip = true;

		return { mFilter, mWrap, mVFlip };
	}

	GetSamplerVFlip(id) {
		let inp = this.mInputs[id];
		return inp.mInfo.mSampler.vflip;
	}

	GetTranslatedShaderSource () {
		return this.mTranslatedSource;
	}

	SetSamplerVFlip(id, str)  {
		let renderer = this.mRenderer;
		let inp = this.mInputs[id];
		let filter = false;

		if (str === "true") filter = true;

		if (inp === null) {
			// ---
		} else if (inp.mInfo.mType === "texture") {
			if (inp.loaded) {
				renderer.SetSamplerVFlip(inp.globject, filter, inp.image);
				inp.mInfo.mSampler.vflip = str;
			}
		} else if (inp.mInfo.mType === "volume") {
		} else if (inp.mInfo.mType === "video") {
			if (inp.loaded) {
				renderer.SetSamplerVFlip(inp.globject, filter, inp.image);
				inp.mInfo.mSampler.vflip = str;
			}
		} else if (inp.mInfo.mType === "cubemap") {
			if (inp.loaded) {
				renderer.SetSamplerVFlip(inp.globject, filter, inp.image);
				inp.mInfo.mSampler.vflip = str;
			}
		} else if (inp.mInfo.mType === "webcam") {
			if (inp.loaded) {
				renderer.SetSamplerVFlip(inp.globject, filter, null);
				inp.mInfo.mSampler.vflip = str;
			}
		}
	}

	GetAcceptsVFlip(id) {
		let inp = this.mInputs[id];
		if (inp === null) return false;

		switch (inp.mInfo.mType) {
			case "texture": return true;
			case "volume": return false;
			case "video": return true;
			case "cubemap": return true;
			case "webcam": return true;
			case "music": return false;
			case "musicstream": return false;
			case "mic": return false;
			case "keyboard": return false;
			case "buffer": return false;
		}
		return true;
	}

	GetSamplerFilter(id) {
		let inp = this.mInputs[id];
		if( inp === null) return;
		return inp.mInfo.mSampler.filter;
	}

	SetSamplerFilter(id, str, buffers, cubeBuffers)  {
		let renderer = this.mRenderer;
		let inp = this.mInputs[id];
		let filter = renderer.FILTER.NONE;
		
		if (str === "linear") filter = renderer.FILTER.LINEAR;
		if (str === "mipmap") filter = renderer.FILTER.MIPMAP;

		if (inp === null) {
			// ---
		} else {
			switch (inp.mInfo.mType) {
				case "texture":
					if (inp.loaded) {
						renderer.SetSamplerFilter(inp.globject, filter, true);
						inp.mInfo.mSampler.filter = str;
					}
					break;
				case "volume":
					if (inp.loaded) {
						renderer.SetSamplerFilter(inp.globject, filter, true);
						inp.mInfo.mSampler.filter = str;
					}
					break;
				case "video":
					if (inp.loaded)  {
						renderer.SetSamplerFilter(inp.globject, filter, true);
						inp.mInfo.mSampler.filter = str;
					}
					break;
				case "cubemap":
					if (inp.loaded) {
						if (assetID_to_cubemapBuferID(inp.mInfo.mID) === 0) {
							renderer.SetSamplerFilter(cubeBuffers[0].mTexture[0], filter, true);
							renderer.SetSamplerFilter(cubeBuffers[0].mTexture[1], filter, true);
							inp.mInfo.mSampler.filter = str;
						} else {
							renderer.SetSamplerFilter(inp.globject, filter, true);
							inp.mInfo.mSampler.filter = str;
						}
					}
					break;
				case "webcam":
					if (inp.loaded) {
						renderer.SetSamplerFilter(inp.globject, filter, true);
						inp.mInfo.mSampler.filter = str;
					}
					break;
				case "buffer":
					renderer.SetSamplerFilter(buffers[inp.id].mTexture[0], filter, true);
					renderer.SetSamplerFilter(buffers[inp.id].mTexture[1], filter, true);
					inp.mInfo.mSampler.filter = str;
					break;
				case "keyboard":
					inp.mInfo.mSampler.filter = str;
					break;
			}
		}
	}

	GetAcceptsMipmapping(id) {
		let inp = this.mInputs[id];
		if (inp === null) return false;
		switch (inp.mInfo.mType) {
			case "texture": return true;
			case "volume": return true;
			case "video": return this.mIs20;
			case "cubemap": return true;
			case "webcam": return this.mIs20;
			case "music": return false;
			case "musicstream": return false;
			case "mic": return false;
			case "keyboard": return false;
			case "buffer": return this.mIs20;
		}
		return false;
	}

	GetAcceptsLinear(id) {
		let inp = this.mInputs[id];
		if (inp === null) return false;
		switch (inp.mInfo.mType) {
			case "texture": return true;
			case "volume": return true;
			case "video": return true;
			case "cubemap": return true;
			case "webcam": return true;
			case "music": return true;
			case "musicstream": return true;
			case "mic": return true;
			case "keyboard": return false;
			case "buffer": return true;
		}
		return false;
	}

	GetAcceptsWrapRepeat(id) {
		let inp = this.mInputs[id];
		if (inp === null) return false;
		switch (inp.mInfo.mType) {
			case "texture": return true;
			case "volume": return true;
			case "video": return this.mIs20;
			case "cubemap": return false;
			case "webcam": return this.mIs20;
			case "music": return false;
			case "musicstream": return false;
			case "mic": return false;
			case "keyboard": return false;
			case "buffer": return this.mIs20;
		}
		return false;
	}

	GetSamplerWrap(id) {
		let inp = this.mInputs[id];
		return inp.mInfo.mSampler.wrap;
	}

	SetSamplerWrap(id, str, buffers) {
		var renderer = this.mRenderer;
		let inp = this.mInputs[id];
		let restr = renderer.TEXWRP.REPEAT;
		if (str === "clamp") restr = renderer.TEXWRP.CLAMP;

		if (inp === null)  {
			// ---
		} else {
			switch (inp.mInfo.mType) {
				case "texture":
					if (inp.loaded) {
						renderer.SetSamplerWrap(inp.globject, restr);
						inp.mInfo.mSampler.wrap = str;
					}
					break;
				case "volume":
					if (inp.loaded) {
						renderer.SetSamplerWrap(inp.globject, restr);
						inp.mInfo.mSampler.wrap = str;
					}
					break;
				case "video":
					if (inp.loaded) {
						renderer.SetSamplerWrap(inp.globject, restr);
						inp.mInfo.mSampler.wrap = str;
					}
					break;
				case "cubemap":
					if (inp.loaded){
						renderer.SetSamplerWrap(inp.globject, restr);
						inp.mInfo.mSampler.wrap = str;
					}
					break;
				case "webcam":
					if (inp.loaded) {
						renderer.SetSamplerWrap(inp.globject, restr);
						inp.mInfo.mSampler.wrap = str;
					}
					break;
				case "buffer":
					renderer.SetSamplerWrap(buffers[inp.id].mTexture[0], restr);
					renderer.SetSamplerWrap(buffers[inp.id].mTexture[1], restr);
					inp.mInfo.mSampler.wrap = str;
					break;
			}
		}
	}


	GetTexture(slot) {
		let inp = this.mInputs[slot];
		if (inp === null) return null;
		return inp.mInfo;
	}

	SetOutputs(slot, id) {
		this.mOutputs[slot] = id;
	}

	SetOutputsByBufferID(slot, id) {
		if (this.mType==="buffer") {
			this.mOutputs[slot] = bufferID_to_assetID(id);
			this.mEffect.ResizeBuffer(id, this.mEffect.mXres, this.mEffect.mYres, false);
		} else if (this.mType==="cubemap") {
			this.mOutputs[slot] = cubamepBufferID_to_assetID(id);
			this.mEffect.ResizeCubemapBuffer(id, 1024, 1024);
		}
	}

	NewShaderSound(shaderCode, commonShaderCodes) {
		let vsSource = "layout(location = 0) in vec2 pos; void main() { gl_Position = vec4(pos.xy,0.0,1.0); }";

		let fsSource = this.mHeader;
		commonShaderCodes.map(e => { fsSource += e +"\n" });
		this.mHeaderLength = fsSource.split(/\r\n|\r|\n/).length;
		this.mSoundShaderCompiled = false;
		fsSource += shaderCode;

		return [vsSource, fsSource];
	}

	NewShaderImage(shaderCode, commonShaderCodes) {
		this.mSupportsVR = false;

		let vsSource = "layout(location = 0) in vec2 pos; void main() { gl_Position = vec4(pos.xy,0.0,1.0); }"
		let fsSource = this.mHeader;
		commonShaderCodes.map(e => { fsSource += e + "\n" });
		this.mHeaderLength = fsSource.split(/\r\n|\r|\n/).length;
		fsSource += shaderCode;

		return [vsSource, fsSource];
	}

	NewShaderCubemap(shaderCode, commonShaderCodes) {
		let vsSource = "layout(location = 0) in vec2 pos; void main() { gl_Position = vec4(pos.xy,0.0,1.0); }";
		let fsSource = this.mHeader;
		commonShaderCodes.map(e => { fsSource += e + "\n" });
		this.mHeaderLength = fsSource.split(/\r\n|\r|\n/).length;
		fsSource += shaderCode;

		return [vsSource, fsSource];
	}

	NewShaderCommon(shaderCode) {
		let vsSource = "layout(location = 0) in vec2 pos; void main() { gl_Position = vec4(pos.xy,0.0,1.0); }";
		let fsSource = this.mHeader + shaderCode;
		return [vsSource, fsSource];
	}

	NewShader(commonSourceCodes, preventCache, onResolve) {
		if (this.mRenderer === null) return;

		let vs_fs = null;

		switch (this.mType) {
			case "sound": vs_fs = this.NewShaderSound(this.mSource, commonSourceCodes); break;
			case "image": vs_fs = this.NewShaderImage(this.mSource, commonSourceCodes); break;
			case "buffer": vs_fs = this.NewShaderImage(this.mSource, commonSourceCodes); break;
			case "common": vs_fs = this.NewShaderCommon(this.mSource); break;
			case "cubemap": vs_fs = this.NewShaderCubemap(this.mSource, commonSourceCodes); break;
			default: return console.error(`ERROR 3: "${this.mType}"`);
		}

		let doneFn = (worked, info) => {
				if (worked === true) {
					if (this.mType === "sound") this.mSoundShaderCompiled = true;
					this.mCompilationTime = info.mTime;
					this.mError = false;
					this.mErrorStr = "No Errors";
					if (this.mProgram !== null) this.mRenderer.DestroyShader(this.mProgram);
					this.mTranslatedSource = this.mRenderer.GetTranslatedShaderSource(info);
					this.mProgram = info;
				} else {
					this.mError = true;
					this.mErrorStr = info.mErrorStr;
				}
				onResolve();
			};
		this.mRenderer.CreateShader(vs_fs[0], vs_fs[1], preventCache, false, doneFn);
	}

	NewTexture(wa, slot, url, buffers, cubeBuffers, keyboard) {
		let Self = this,
			renderer = this.mRenderer,
			rti,
			texture = {
				mInfo: url,
				globject: null,
				loaded: false,
			};
		if (renderer === null) return;

		if (url === null || url.mType === null) {
			if (this.mTextureCallbackFun !== null) {
				this.mTextureCallbackFun(this.mTextureCallbackObj, slot, null, true, 0, 0, -1.0, this.mID);
			}
			this.DestroyInput(slot);
			this.mInputs[slot] = null;
			this.MakeHeader();

			return {
				mFailed: false,
				mNeedsShaderCompile: false
			};
		}

		switch (url.mType) {
			case "texture":
				texture.image = new Image;
				texture.image.crossOrigin = "";
				texture.image.onload = () => {
					let rti = this.Sampler2Renderer(url.mSampler);
					// O.M.G. FIX THIS
					let channels = renderer.TEXFMT.C4I8;
					if (url.mID === "Xdf3zn"
						|| url.mID === "4sf3Rn"
						|| url.mID === "4dXGzn"
						|| url.mID === "4sf3Rr") channels = renderer.TEXFMT.C1I8;
					texture.globject = renderer.CreateTextureFromImage(renderer.TEXTYPE.T2D, texture.image, channels, rti.mFilter, rti.mWrap, rti.mVFlip);
					texture.loaded = true;
					if (this.mTextureCallbackFun !== null) {
						this.mTextureCallbackFun(this.mTextureCallbackObj, slot, texture.image, true, 1, 1, -1.0, this.mID);
					}
				};
				texture.image.src = url.mSrc;

				this.DestroyInput(slot);
				this.mInputs[slot] = texture;
				this.MakeHeader();
				return {
					mFailed: false,
					mNeedsShaderCompile:(this.mInputs[slot] === null) || (
										(this.mInputs[slot].mInfo.mType !== "texture") && 
										(this.mInputs[slot].mInfo.mType !== "webcam") && 
										(this.mInputs[slot].mInfo.mType !== "mic") && 
										(this.mInputs[slot].mInfo.mType !== "music") && 
										(this.mInputs[slot].mInfo.mType !== "musicstream") && 
										(this.mInputs[slot].mInfo.mType !== "keyboard") && 
										(this.mInputs[slot].mInfo.mType !== "video"))
				};
			case "volume":
				texture.mImage = { mData: null, mXres: 1, mYres: 0, mZres: 0 };
				texture.mPreview = new Image;
				texture.mPreview.crossOrigin = "";

				var xmlHttp = new XMLHttpRequest();
				if (xmlHttp === null) return { mFailed: true };

				xmlHttp.open("GET", url.mSrc, true);
				xmlHttp.responseType = "arraybuffer";
				xmlHttp.onerror = () => console.error("Error 1 loading Volume");
				xmlHttp.onload = function() {
					let data = xmlHttp.response;
					if (!data) return console.error("Error 2 loading Volume");

					let file = new File(data);
					let signature = file.ReadUInt32();
					let binNumChannels = file.ReadUInt8();
					let binLayout = file.ReadUInt8();
					let binFormat = file.ReadUInt16();
					let format = renderer.TEXFMT.C1I8;

					texture.mImage.mXres = file.ReadUInt32();
					texture.mImage.mYres = file.ReadUInt32();
					texture.mImage.mZres = file.ReadUInt32();

					if (binNumChannels === 1 && binFormat === 0) format = renderer.TEXFMT.C1I8;
					else if (binNumChannels === 2 && binFormat === 0) format = renderer.TEXFMT.C2I8;
					else if (binNumChannels === 3 && binFormat === 0) format = renderer.TEXFMT.C3I8;
					else if (binNumChannels === 4 && binFormat === 0) format = renderer.TEXFMT.C4I8;
					else if (binNumChannels === 1 && binFormat === 10) format = renderer.TEXFMT.C1F32;
					else if (binNumChannels === 2 && binFormat === 10) format = renderer.TEXFMT.C2F32;
					else if (binNumChannels === 3 && binFormat === 10) format = renderer.TEXFMT.C3F32;
					else if (binNumChannels === 4 && binFormat === 10) format = renderer.TEXFMT.C4F32;
					else return;

					let buffer = new Uint8Array(data, 20); // skip 16 bytes (header of .bin)
					let rti = Self.Sampler2Renderer(url.mSampler);

					texture.globject = renderer.CreateTexture(renderer.TEXTYPE.T3D, texture.mImage.mXres, texture.mImage.mYres, format, rti.mFilter, rti.mWrap, buffer);

					if (texture.globject === null) {
						console.error("Error 4: loading Volume");
						return { mFailed: true };
					}
					if (Self.mTextureCallbackFun !== null) {
						Self.mTextureCallbackFun(Self.mTextureCallbackObj, slot, texture.mPreview, true, 1, 1, -1.0, Self.mID);
					}
					// load icon for it
					texture.mPreview.onload = function() {
						if (Self.mTextureCallbackFun !== null) {
							Self.mTextureCallbackFun(Self.mTextureCallbackObj, slot, texture.mPreview, true, 1, 1, -1.0, Self.mID);
						}
					}
					texture.loaded = true;
					texture.mPreview.src = url.mPreviewSrc;
				}
				xmlHttp.send("");

				this.DestroyInput(slot);
				this.mInputs[slot] = texture;
				this.MakeHeader();
				return {
					mFailed: false,
					mNeedsShaderCompile: (this.mInputs[slot] == null) || (this.mInputs[slot].mInfo.mType != "volume")
				};
			case "cubemap":
				rti = this.Sampler2Renderer(url.mSampler);

				if (assetID_to_cubemapBuferID(url.mID) !== -1) {
					texture.mImage = new Image();
					texture.mImage.onload = function() {
						texture.loaded = true;
						if (Self.mTextureCallbackFun !== null) {
							Self.mTextureCallbackFun(Self.mTextureCallbackObj, slot, texture.mImage, true, 2, 1, -1.0, Self.mID);
						}
					}
					texture.mImage.src = "res/media/cubemap00.png";

					this.mEffect.ResizeCubemapBuffer(0, 1024, 1024);
				} else {
					texture.image = [new Image(), new Image(), new Image(), new Image(), new Image(), new Image()];

					let numLoaded = 0;

					texture.image.map((img, i) => {
						img.mId = i;
						img.crossOrigin = "";
						img.onload = function() {
							var id = this.mId;
							numLoaded++;
							if (numLoaded === 6) {
								texture.globject = renderer.CreateTextureFromImage(renderer.TEXTYPE.CUBEMAP, texture.image, renderer.TEXFMT.C4I8, rti.mFilter, rti.mWrap, rti.mVFlip);
								texture.loaded = true;
								if (Self.mTextureCallbackFun !== null) {
									Self.mTextureCallbackFun(Self.mTextureCallbackObj, slot, texture.image[0], true, 2, 1, -1.0, Self.mID);
								}
							}
						};

						if (i === 0) {
							texture.image[i].src = url.mSrc;
						} else {
							let n = url.mSrc.lastIndexOf(".");
							texture.image[i].src = url.mSrc.substring(0, n) +"_"+ i + url.mSrc.substring(n, url.mSrc.length);
						}
					});
				}

				this.DestroyInput(slot);
				this.mInputs[slot] = texture;
				this.MakeHeader();
				return {
					mFailed: false,
					mNeedsShaderCompile: (this.mInputs[slot] == null) || (this.mInputs[slot].mInfo.mType != "cubemap")
				};
			case "webcam":
				texture.video = document.createElement("video");
				texture.video.width = 320;
				texture.video.height = 240;
				texture.video.autoplay = true;
				texture.video.loop = true;
				texture.mForceMuted = this.mForceMuted;
				texture.mImage = null;

				rti = Self.Sampler2Renderer(url.mSampler);

				let loadImageInsteadOfWebCam = function() {
						texture.mImage = new Image();
						texture.mImage.onload = function() {
							texture.loaded = true;
							texture.globject = renderer.CreateTextureFromImage(renderer.TEXTYPE.T2D, texture.mImage, renderer.TEXFMT.C4I8, rti.mFilter, rti.mWrap, rti.mVFlip);
							if (Self.mTextureCallbackFun !== null) {
								Self.mTextureCallbackFun(Self.mTextureCallbackObj, slot, texture.mImage, true, 7, 1, -1.0, Self.mID);
							}
						};
						texture.mImage.src = Self.mEffect.iChannel.webcam;
					};
				loadImageInsteadOfWebCam();

				if (typeof navigator.getUserMedia !== "undefined" && texture.mForceMuted === false) {
					texture.video.addEventListener("canplay", event => {
						try {
							texture.mImage = null;
							if (texture.globject != null) {
								renderer.DestroyTexture(texture.globject);
							}
							texture.globject = renderer.CreateTextureFromImage(renderer.TEXTYPE.T2D, texture.video, renderer.TEXFMT.C4I8, rti.mFilter, rti.mWrap, rti.mVFlip);
							texture.loaded = true;
						} catch(error) {
							loadImageInsteadOfWebCam();
							console.error(`Your browser can not transfer webcam data to the GPU.`);
						}
					});

					navigator.mediaDevices
						.getUserMedia({ "video": { width: 1280, height: 720 }, "audio": false })
						.then(stream => { texture.video.srcObject = stream })
						.catch(error => {
							loadImageInsteadOfWebCam();
							console.error(`Unable to capture WebCam. Please reload the page.`);
						});
				}
				this.DestroyInput(slot);
				this.mInputs[slot] = texture;
				this.MakeHeader();

				return {
					mFailed: false,
					mNeedsShaderCompile:(this.mInputs[slot] == null) || (
										(this.mInputs[slot].mInfo.mType != "texture") && 
										(this.mInputs[slot].mInfo.mType != "webcam") && 
										(this.mInputs[slot].mInfo.mType != "mic") && 
										(this.mInputs[slot].mInfo.mType != "music") && 
										(this.mInputs[slot].mInfo.mType != "musicstream") && 
										(this.mInputs[slot].mInfo.mType != "keyboard") && 
										(this.mInputs[slot].mInfo.mType != "video"))
				};
			case "mic":
				let num = 512;
				texture.mForceMuted = this.mForceMuted;
				texture.mAnalyser = null;
				texture.mFreqData = new Uint8Array(num);
				texture.mWaveData = new Uint8Array(num);

				if (wa === null || typeof navigator.getUserMedia === "undefined") {
					if (!texture.mForceMuted) console.error(`Shader: Web Audio not implement in this browser`);
					texture.mForceMuted = true; 
				}
				if (texture.mForceMuted) {
					texture.globject = renderer.CreateTexture(renderer.TEXTYPE.T2D, num, 2, renderer.TEXFMT.C1I8, renderer.FILTER.LINEAR, renderer.TEXWRP.CLAMP, null);
					texture.loaded = true;
				} else {
					let success = stream => {
							texture.globject = renderer.CreateTexture(renderer.TEXTYPE.T2D, 512, 2, renderer.TEXFMT.C1I8, renderer.FILTER.LINEAR, null)
							texture.mic = wa.createMediaStreamSource(stream);
							texture.mAnalyser = wa.createAnalyser();
							texture.mic.connect(texture.mAnalyser);
							texture.loaded = true;
						},
						failure = error => {
							console.error(`Unable open Mic. Please reload the page.`);
						};
		    		navigator.getUserMedia({ "audio": true }, success, failure);
				}

				this.DestroyInput(slot);
				this.mInputs[slot] = texture;
				this.MakeHeader();

				return {
		            mFailed: false,
		            mNeedsShaderCompile:(this.mInputs[slot] === null ) || (
										(this.mInputs[slot].mInfo.mType !== "texture") && 
										(this.mInputs[slot].mInfo.mType !== "webcam") && 
										(this.mInputs[slot].mInfo.mType !== "mic") && 
										(this.mInputs[slot].mInfo.mType !== "music") && 
										(this.mInputs[slot].mInfo.mType !== "musicstream") && 
										(this.mInputs[slot].mInfo.mType !== "keyboard") && 
										(this.mInputs[slot].mInfo.mType !== "video"))
		        };
			case "video":
				texture.video = document.createElement("video");
				texture.video.loop = true;
				texture.video.preload = "auto";
				texture.video.mPaused = this.mForcePaused;
				texture.video.mMuted = true;
				texture.video.muted = true;
				if (this.mForceMuted === true) texture.video.volume = 0;
				texture.video.autoplay = false;
				texture.video.hasFalled = false;
				
				rti = this.Sampler2Renderer(url.mSampler);

				texture.video.addEventListener("canplay", event => {
					texture.video.play()
						.then(() => {
						   texture.video.mPaused = false;
						   texture.globject = renderer.CreateTextureFromImage(renderer.TEXTYPE.T2D, texture.video, renderer.TEXFMT.C4I8, rti.mFilter, rti.mWrap, rti.mVFlip);
						   texture.loaded = true;
						   if (this.mTextureCallbackFun != null) {
							   this.mTextureCallbackFun(this.mTextureCallbackObj, slot, texture.video, true, 3, 1, -1.0, this.mID);
						   }
						})
			            .catch(error => console.error(error));
				});

				texture.video.addEventListener("error", event => {
					if (texture.video.hasFalled === true) {
						return console.error(`Error: cannot load video`);
					}
					let str = texture.video.src;
					str = str.substr(0, str.lastIndexOf(".")) +".mp4";
					texture.video.src = str;
					texture.video.hasFalled = true;
				});
				texture.video.src = url.mSrc;

				this.DestroyInput(slot);
				this.mInputs[slot] = texture;
				this.MakeHeader();

				return {
					mFailed: false,
					mNeedsShaderCompile:(this.mInputs[slot] === null ) || (
										(this.mInputs[slot].mInfo.mType !== "texture") && 
										(this.mInputs[slot].mInfo.mType !== "webcam") && 
										(this.mInputs[slot].mInfo.mType !== "mic") && 
										(this.mInputs[slot].mInfo.mType !== "music") && 
										(this.mInputs[slot].mInfo.mType !== "musicstream") && 
										(this.mInputs[slot].mInfo.mType !== "keyboard") && 
										(this.mInputs[slot].mInfo.mType !== "video"))
				};
			case "music":
			case "musicstream":
				texture.audio = document.createElement("audio");
				texture.audio.loop = true;
				texture.audio.mMuted = this.mForceMuted;
				texture.audio.mForceMuted = this.mForceMuted;
				texture.audio.muted = this.mForceMuted;
				if (this.mForceMuted === true) texture.audio.volume = 0;
				texture.audio.autoplay = false;
				texture.audio.hasFalled = false;
				texture.audio.mPaused = false;
				texture.audio.mSound = {};

				if (this.mForceMuted === false) {
					if (url.mType === "musicstream" && SC === null) {
						console.error(`Shader: Soundcloud could not be reached`);
						texture.audio.mForceMuted = true;
					}
				}
				if (wa === null && this.mForceMuted === false) {
					console.error(`Shader: Web Audio not implement in this browser`);
					texture.audio.mForceMuted = true;
				}
				if (texture.audio.mForceMuted) {
					let num = 512;
					texture.globject = renderer.CreateTexture(renderer.TEXTYPE.T2D, 512, 2, renderer.TEXFMT.C1I8, renderer.FILTER.LINEAR, renderer.TEXWRP.CLAMP, null);
					texture.audio.mSound.mFreqData = new Uint8Array(num);
					texture.audio.mSound.mWaveData = new Uint8Array(num);
					texture.loaded = true;
				}
				texture.audio.addEventListener("canplay", function() {
					if (texture === null || texture.audio === null) return;
					if (this.mForceMuted) return;
					if (texture.loaded === true) return;

					texture.globject = renderer.CreateTexture(renderer.TEXTYPE.T2D, 512, 2, renderer.TEXFMT.C1I8, renderer.FILTER.LINEAR, renderer.TEXWRP.CLAMP, null)
					texture.audio.mSound.mSource = wa.createMediaElementSource(texture.audio);
					texture.audio.mSound.mAnalyser = wa.createAnalyser();
					texture.audio.mSound.mGain = wa.createGain();
					texture.audio.mSound.mSource.connect(texture.audio.mSound.mAnalyser);
					texture.audio.mSound.mAnalyser.connect(texture.audio.mSound.mGain);
					texture.audio.mSound.mGain.connect(Self.mGainNode);
					texture.audio.mSound.mFreqData = new Uint8Array(texture.audio.mSound.mAnalyser.frequencyBinCount);
					texture.audio.mSound.mWaveData = new Uint8Array(texture.audio.mSound.mAnalyser.frequencyBinCount);

					if (texture.audio.mPaused) {
						texture.audio.pause();
					} else {
						texture.audio.play()
							.then(() => {/*console.log("ok");*/})
							.catch(error => console.error(error));
					}
					texture.loaded = true;
				});

				texture.audio.addEventListener("error", function() {
					   if (this.mForceMuted) return;
					   if (texture.audio.hasFalled === true) return;
					   let str = texture.audio.src;
					   str = str.substr(0,str.lastIndexOf(".")) +".ogg";
					   texture.audio.src = str;
					   texture.audio.hasFalled = true;
				});

				if (!texture.audio.mForceMuted) {
					if (url.mType === "musicstream") {
						let success = song => {
								if (song.streamable === true) {
									texture.audio.crossOrigin = "anonymous";
									texture.audio.src = song.stream_url;
									texture.audio.soundcloudInfo = song;
								} else {
									console.error(`Shader: Soundcloud 3 - This track cannot be streamed`);
								}
							},
							failure = error => {
								if (this.mTextureCallbackFun !== null) {
									this.mTextureCallbackFun(this.mTextureCallbackObj, slot, { wave: null }, false, 4, 0, -1.0, this.mID);
								}
							};
						SC.resolve(url.mSrc, success, failure);
					} else {
						texture.audio.src = url.mSrc;
					}
				}

				if (this.mTextureCallbackFun !== null) {
					if (url.mType === "music") this.mTextureCallbackFun(this.mTextureCallbackObj, slot, { wave: null }, false, 4, 0, -1.0, this.mID);
					else if (url.mType === "musicstream") this.mTextureCallbackFun(this.mTextureCallbackObj, slot, { wave: null, info: texture.audio.soundcloudInfo}, false, 8, 0, -1.0, this.mID);
				}

				this.DestroyInput( slot );
				this.mInputs[slot] = texture;
				this.MakeHeader();

				return {
					mFailed: false,
					mNeedsShaderCompile:(this.mInputs[slot] === null) || (
										(this.mInputs[slot].mInfo.mType !== "texture") && 
										(this.mInputs[slot].mInfo.mType !== "webcam") && 
										(this.mInputs[slot].mInfo.mType !== "mic") && 
										(this.mInputs[slot].mInfo.mType !== "music") && 
										(this.mInputs[slot].mInfo.mType !== "musicstream") && 
										(this.mInputs[slot].mInfo.mType !== "keyboard") && 
										(this.mInputs[slot].mInfo.mType !== "video"))
				};
			case "keyboard":
				texture.keyboard = {};

				if (this.mTextureCallbackFun !== null) {
					this.mTextureCallbackFun(this.mTextureCallbackObj, slot, { mImage: keyboard.mIcon, mData: keyboard.mData }, false, 6, 1, -1.0, this.mID);
				}
				this.DestroyInput(slot);
				this.mInputs[slot] = texture;
				this.MakeHeader();

				return {
					mFailed: false,
					mNeedsShaderCompile:(this.mInputs[slot] === null) || (
										(this.mInputs[slot].mInfo.mType !== "texture") && 
										(this.mInputs[slot].mInfo.mType !== "webcam") && 
										(this.mInputs[slot].mInfo.mType !== "mic") && 
										(this.mInputs[slot].mInfo.mType !== "music") && 
										(this.mInputs[slot].mInfo.mType !== "musicstream") && 
										(this.mInputs[slot].mInfo.mType !== "keyboard") && 
										(this.mInputs[slot].mInfo.mType !== "video"))
				};
			case "buffer":
				texture.image = new Image();
				texture.image.onload = () => {
					if (this.mTextureCallbackFun !== null) {
						this.mTextureCallbackFun(this.mTextureCallbackObj, slot, { texture: texture.image, data: null }, true, 9, 1, -1.0, this.mID);
					}
				}
				texture.image.src = url.mSrc;
				texture.id = assetID_to_bufferID(url.mID);
				texture.loaded = true;

				this.DestroyInput(slot);
				this.mInputs[slot] = texture;
				this.mEffect.ResizeBuffer(texture.id, this.mEffect.mXres, this.mEffect.mYres, false);
				this.SetSamplerFilter(slot, url.mSampler.filter, buffers, cubeBuffers, true);
				this.SetSamplerVFlip(slot, url.mSampler.vflip);
				this.SetSamplerWrap(slot, url.mSampler.wrap, buffers);
				this.MakeHeader();

				return {
					mFailed: false,
					mNeedsShaderCompile:(this.mInputs[slot] === null) || (
										(this.mInputs[slot].mInfo.mType !== "texture") && 
										(this.mInputs[slot].mInfo.mType !== "webcam") && 
										(this.mInputs[slot].mInfo.mType !== "mic") && 
										(this.mInputs[slot].mInfo.mType !== "music") && 
										(this.mInputs[slot].mInfo.mType !== "musicstream") && 
										(this.mInputs[slot].mInfo.mType !== "keyboard") && 
										(this.mInputs[slot].mInfo.mType !== "video"))
				};
			default:
				console.error("input type error");
		}
		
		return { mFailed: true };
	}

	PaintImage(vrData, wa, d, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, buffers, cubeBuffers, keyboard) {
		let times = [0.0, 0.0, 0.0, 0.0];
		let dates = [d.getFullYear(), d.getMonth(), d.getDate(),
					 d.getHours() * 60 * 60 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000];
		let mouse = [mousePosX, mousePosY, mouseOriX, mouseOriY];
		let resos = [0.0,0.0,0.0, 0.0,0.0,0.0, 0.0,0.0,0.0, 0.0,0.0,0.0];
		let texIsLoaded = [0, 0, 0, 0];
		let texID = [null, null, null, null];

		for (let i=0; i<this.mInputs.length; i++) {
			let inp = this.mInputs[i];

			if (inp === null) {
				// ---
			} else if (inp.mInfo.mType === "texture") {
				if (inp.loaded === true) {
					texID[i] = inp.globject;
					texIsLoaded[i] = 1;
					resos[3*i+0] = inp.image.width;
					resos[3*i+1] = inp.image.height;
					resos[3*i+2] = 1;
				}
			} else if (inp.mInfo.mType === "volume") {
				if (inp.loaded === true) {
					texID[i] = inp.globject;
					texIsLoaded[i] = 1;
					resos[3*i+0] = inp.mImage.mXres;
					resos[3*i+1] = inp.mImage.mYres;
					resos[3*i+2] = inp.mImage.mZres;
				}
			} else if (inp.mInfo.mType === "keyboard") {
				texID[i] = keyboard.mTexture;
				texIsLoaded[i] = 1;
				resos[3*i+0] = 256;
				resos[3*i+1] = 3;
				resos[3*i+2] = 1;
			} else if (inp.mInfo.mType === "cubemap") {
				if (inp.loaded === true) {
					let id = assetID_to_cubemapBuferID(inp.mInfo.mID);
					if (id !==- 1) {
						texID[i] = cubeBuffers[id].mTexture[cubeBuffers[id].mLastRenderDone];
						resos[3*i+0] = cubeBuffers[id].mResolution[0];
						resos[3*i+1] = cubeBuffers[id].mResolution[1];
						resos[3*i+2] = 1;
						texIsLoaded[i] = 1;

						// hack. in webgl2.0 we have samplers, so we don't need this crap here
						let filter = this.mRenderer.FILTER.NONE;
						if (inp.mInfo.mSampler.filter === "linear") filter = this.mRenderer.FILTER.LINEAR;
						else if (inp.mInfo.mSampler.filter === "mipmap") filter = this.mRenderer.FILTER.MIPMAP;
						this.mRenderer.SetSamplerFilter(texID[i], filter, false);
					} else {
						texID[i] = inp.globject;
						texIsLoaded[i] = 1;
					}
				}
			} else if (inp.mInfo.mType === "webcam") {
				if (inp.loaded === true) {
					if (inp.mImage !== null) {
						if (this.mTextureCallbackFun !== null) {
							this.mTextureCallbackFun(this.mTextureCallbackObj, i, inp.mImage, false, 7, 1, -1, this.mID);
						}
						texID[i] = inp.globject;
						texIsLoaded[i] = 1;
						resos[3*i+0] = inp.mImage.width;
						resos[3*i+1] = inp.mImage.height;
						resos[3*i+2] = 1;
					} else if (inp.video.readyState === inp.video.HAVE_ENOUGH_DATA) {
						if (this.mTextureCallbackFun !== null) {
							this.mTextureCallbackFun(this.mTextureCallbackObj, i, inp.video, false, 7, 1, -1, this.mID);
						}
						texID[i] = inp.globject;
						this.mRenderer.UpdateTextureFromImage(inp.globject, inp.video);
						if (inp.mInfo.mSampler.filter === "mipmap") this.mRenderer.CreateMipmaps(inp.globject);
						resos[3*i+0] = inp.video.videoWidth;
						resos[3*i+1] = inp.video.videoHeight;
						resos[3*i+2] = 1;
						texIsLoaded[i] = 1;
					}
				} else {
					texID[i] = null;
					texIsLoaded[i] = 0;
					resos[3*i+0] = inp.video.width;
					resos[3*i+1] = inp.video.height;
					resos[3*i+2] = 1;
				}
			} else if(inp.mInfo.mType === "video") {
				if (inp.video.mPaused === false) {
					if (this.mTextureCallbackFun !== null) {
						this.mTextureCallbackFun(this.mTextureCallbackObj, i, inp.video, false, 3, 1, inp.video.currentTime, this.mID);
					}
				}
				if (inp.loaded === true) { 
					times[i] = inp.video.currentTime;
					texID[i] = inp.globject;
					texIsLoaded[i] = 1;

					if (inp.video.mPaused === false) {
						this.mRenderer.UpdateTextureFromImage(inp.globject, inp.video);
						if (inp.mInfo.mSampler.filter === "mipmap")this.mRenderer.CreateMipmaps(inp.globject);
					}
					resos[3*i+0] = inp.video.videoWidth;
					resos[3*i+1] = inp.video.videoHeight;
					resos[3*i+2] = 1;
				}
			} else if (inp.mInfo.mType === "music" || inp.mInfo.mType === "musicstream") {
				if (inp.audio.mPaused === false && inp.audio.mForceMuted === false && inp.loaded === true) {
					if (wa !== null) {
						inp.audio.mSound.mAnalyser.getByteFrequencyData(inp.audio.mSound.mFreqData);
						inp.audio.mSound.mAnalyser.getByteTimeDomainData(inp.audio.mSound.mWaveData);
					}
					if (this.mTextureCallbackFun !== null) {
						if (inp.mInfo.mType === "music") this.mTextureCallbackFun(this.mTextureCallbackObj, i, (wa === null) ? null : { wave : inp.audio.mSound.mFreqData }, false, 4, 1, inp.audio.currentTime, this.mID);
						else if(inp.mInfo.mType === "musicstream") this.mTextureCallbackFun(this.mTextureCallbackObj, i, (wa === null) ? null : { wave : inp.audio.mSound.mFreqData, info : inp.audio.soundcloudInfo}, false, 8, 1, inp.audio.currentTime, this.mID);
					}
				}
				if (inp.loaded === true) {
					times[i] = inp.audio.currentTime;
					texID[i] = inp.globject;
					texIsLoaded[i] = 1;

					if (inp.audio.mForceMuted === true) {
						times[i] = 10.0 + time;
						let num = inp.audio.mSound.mFreqData.length;
						for (let j=0; j<num; j++) {
							let x = j / num;
							let f =  (0.75 + 0.25*Math.sin( 10.0*j + 13.0*time )) * Math.exp( -3.0*x );
							if(j < 3) f = Math.pow( 0.50 + 0.5*Math.sin( 6.2831*time ), 4.0 ) * (1.0-j/3.0);
							inp.audio.mSound.mFreqData[j] = Math.floor(255.0*f) | 0;
						}
						for (let j=0; j<num; j++) {
							let f = 0.5 + 0.15*Math.sin( 17.0*time + 10.0*6.2831*j/num ) * Math.sin( 23.0*time + 1.9*j/num );
							inp.audio.mSound.mWaveData[j] = Math.floor(255.0*f) | 0;
						}
					}
					if (inp.audio.mPaused === false) {
						let waveLen = Math.min(inp.audio.mSound.mWaveData.length, 512);
						this.mRenderer.UpdateTexture(inp.globject, 0, 0, 512, 1, inp.audio.mSound.mFreqData);
						this.mRenderer.UpdateTexture(inp.globject, 0, 1, 512, 1, inp.audio.mSound.mWaveData);
					}
					resos[3*i+0] = 512;
					resos[3*i+1] = 2;
					resos[3*i+2] = 1;
				}
			} else if (inp.mInfo.mType === "mic") {
				if (inp.loaded === false || inp.mForceMuted || wa === null || inp.mAnalyser == null) {
						times[i] = 10.0 + time;
						let num = inp.mFreqData.length;
						for (let j=0; j<num; j++) {
							let x = j / num;
							let f =  (0.75 + 0.25*Math.sin( 10.0*j + 13.0*time )) * Math.exp( -3.0*x );
							if (j < 3) f = Math.pow( 0.50 + 0.5*Math.sin( 6.2831*time ), 4.0 ) * (1.0-j/3.0);
							inp.mFreqData[j] = Math.floor(255.0*f) | 0;
						}
						for(let j=0; j<num; j++) {
							let f = 0.5 + 0.15*Math.sin( 17.0*time + 10.0*6.2831*j/num ) * Math.sin( 23.0*time + 1.9*j/num );
							inp.mWaveData[j] = Math.floor(255.0*f) | 0;
						}
				} else {
					inp.mAnalyser.getByteFrequencyData(inp.mFreqData);
					inp.mAnalyser.getByteTimeDomainData(inp.mWaveData);
				}
				if (this.mTextureCallbackFun !== null) {
					this.mTextureCallbackFun(this.mTextureCallbackObj, i, {wave:inp.mFreqData}, false, 5, 1, -1, this.mID);
				}
				if (inp.loaded === true) {
					texID[i] = inp.globject;
					texIsLoaded[i] = 1;
					let waveLen = Math.min(inp.mWaveData.length, 512);
					this.mRenderer.UpdateTexture(inp.globject, 0, 0, 512, 1, inp.mFreqData);
					this.mRenderer.UpdateTexture(inp.globject, 0, 1, waveLen, 1, inp.mWaveData);
					resos[3*i+0] = 512;
					resos[3*i+1] = 2;
					resos[3*i+2] = 1;
				}
			} else if (inp.mInfo.mType === "buffer") {
				let id = inp.id;
				if (inp.loaded === true) {
					texID[i] = buffers[id].mTexture[buffers[id].mLastRenderDone];
					texIsLoaded[i] = 1;
					resos[3*i+0] = xres;
					resos[3*i+1] = yres;
					resos[3*i+2] = 1;
					// hack. in webgl2.0 we have samplers, so we don't need this crap here
					let filter = this.mRenderer.FILTER.NONE;
					if (inp.mInfo.mSampler.filter === "linear") filter = this.mRenderer.FILTER.LINEAR;
					else if (inp.mInfo.mSampler.filter === "mipmap") filter = this.mRenderer.FILTER.MIPMAP;
					this.mRenderer.SetSamplerFilter( texID[i], filter, false);
				}
				if (this.mTextureCallbackFun !== null) {
					this.mTextureCallbackFun(this.mTextureCallbackObj, i, {texture:inp.image, data:buffers[id].mThumbnailBuffer}, false, 9, 1, -1, this.mID);
				}
			}
		}
		this.mRenderer.AttachTextures(4, texID[0], texID[1], texID[2], texID[3]);
		//-----------------------------------
		let prog = this.mProgram;
		this.mRenderer.AttachShader(prog);

		this.mRenderer.SetShaderConstant1F("iTime", time);
		this.mRenderer.SetShaderConstant3F("iResolution", xres, yres, 1.0);
		this.mRenderer.SetShaderConstant4FV("iMouse", mouse);
		this.mRenderer.SetShaderConstant1FV("iChannelTime", times);
		this.mRenderer.SetShaderConstant4FV("iDate", dates);
		this.mRenderer.SetShaderConstant3FV("iChannelResolution", resos);
		this.mRenderer.SetShaderConstant1F("iSampleRate", this.mSampleRate);
		this.mRenderer.SetShaderTextureUnit("iChannel0", 0);
		this.mRenderer.SetShaderTextureUnit("iChannel1", 1);
		this.mRenderer.SetShaderTextureUnit("iChannel2", 2);
		this.mRenderer.SetShaderTextureUnit("iChannel3", 3);
		this.mRenderer.SetShaderConstant1I("iFrame", this.mFrame);
		this.mRenderer.SetShaderConstant1F("iTimeDelta", dtime);
		this.mRenderer.SetShaderConstant1F("iFrameRate", fps);

		this.mRenderer.SetShaderConstant1F("iCh0.time", times[0]);
		this.mRenderer.SetShaderConstant1F("iCh1.time", times[1]);
		this.mRenderer.SetShaderConstant1F("iCh2.time", times[2]);
		this.mRenderer.SetShaderConstant1F("iCh3.time", times[3]);
		this.mRenderer.SetShaderConstant3F("iCh0.size", resos[0], resos[ 1], resos[ 2]);
		this.mRenderer.SetShaderConstant3F("iCh1.size", resos[3], resos[ 4], resos[ 5]);
		this.mRenderer.SetShaderConstant3F("iCh2.size", resos[6], resos[ 7], resos[ 8]);
		this.mRenderer.SetShaderConstant3F("iCh3.size", resos[9], resos[10], resos[11]);
		this.mRenderer.SetShaderConstant1I("iCh0.loaded", texIsLoaded[0]);
		this.mRenderer.SetShaderConstant1I("iCh1.loaded", texIsLoaded[1]);
		this.mRenderer.SetShaderConstant1I("iCh2.loaded", texIsLoaded[2]);
		this.mRenderer.SetShaderConstant1I("iCh3.loaded", texIsLoaded[3]);

		let l1 = this.mRenderer.GetAttribLocation(this.mProgram, "pos");

		if (vrData !== null && this.mSupportsVR) {
			for (let i=0; i<2; i++) {
				let ei = (i === 0) ? vrData.mLeftEye : vrData.mRightEye;
				let vp = [i * xres / 2, 0, xres / 2, yres];

				this.mRenderer.SetViewport(vp);

				let fov = ei.mProjection;
				let corA = [ -fov[2], -fov[1], -1.0 ];
				let corB = [  fov[3], -fov[1], -1.0 ];
				let corC = [  fov[3],  fov[0], -1.0 ];
				let corD = [ -fov[2],  fov[0], -1.0 ];
				let apex = [ 0.0, 0.0, 0.0 ];
				let ma = invertFast( ei.mCamera );

				corA = matMulpoint(ma, corA); 
				corB = matMulpoint(ma, corB); 
				corC = matMulpoint(ma, corC); 
				corD = matMulpoint(ma, corD); 
				apex = matMulpoint(ma, apex); 

				let corners = [ corA[0], corA[1], corA[2], 
								corB[0], corB[1], corB[2], 
								corC[0], corC[1], corC[2], 
								corD[0], corD[1], corD[2],
								apex[0], apex[1], apex[2]];

				this.mRenderer.SetShaderConstant3FV("unCorners", corners);
				this.mRenderer.SetShaderConstant4FV("unViewport", vp);
				this.mRenderer.DrawUnitQuad_XY(l1);
			}
		} else {
			this.mRenderer.SetViewport([0, 0, xres, yres]);
			this.mRenderer.DrawFullScreenTriangle_XY(l1);
		}
		this.mRenderer.DettachTextures();
	}

	iRenderSound(d, callback) {
		let dates = [d.getFullYear(), d.getMonth(), d.getDate(),
					 d.getHours() * 60 * 60 + d.getMinutes() * 60 + d.getSeconds()];
		let resos = [0.0,0.0,0.0, 0.0,0.0,0.0, 0.0,0.0,0.0, 0.0,0.0,0.0];

		this.mRenderer.SetRenderTarget(this.mRenderFBO);
		this.mRenderer.SetViewport([0, 0, this.mTextureDimensions, this.mTextureDimensions]);
		this.mRenderer.AttachShader(this.mProgram);
		this.mRenderer.SetBlend(false);

		let texID = [null, null, null, null];
		for (let i=0; i<this.mInputs.length; i++) {
			let inp = this.mInputs[i];

			if (inp === null) {
				// ---
			} else if (inp.mInfo.mType === "texture") {
				if (inp.loaded === true) {
					texID[i] = inp.globject;
					resos[3*i+0] = inp.image.width;
					resos[3*i+1] = inp.image.height;
					resos[3*i+2] = 1;
				}
			} else if (inp.mInfo.mType === "volume") {
				if (inp.loaded === true) {
					texID[i] = inp.globject;
					resos[3*i+0] = inp.mImage.mXres;
					resos[3*i+1] = inp.mImage.mYres;
					resos[3*i+2] = inp.mImage.mZres;
				}
			}
		}

		this.mRenderer.AttachTextures(4, texID[0], texID[1], texID[2], texID[3]);

		let l2 = this.mRenderer.SetShaderConstantLocation(this.mProgram, "iTimeOffset");
		let l3 = this.mRenderer.SetShaderConstantLocation(this.mProgram, "iSampleOffset");
		
		this.mRenderer.SetShaderConstant4FV("iDate", dates);
		this.mRenderer.SetShaderConstant3FV("iChannelResolution", resos);
		this.mRenderer.SetShaderConstant1F("iSampleRate", this.mSampleRate);
		this.mRenderer.SetShaderTextureUnit("iChannel0", 0);
		this.mRenderer.SetShaderTextureUnit("iChannel1", 1);
		this.mRenderer.SetShaderTextureUnit("iChannel2", 2);
		this.mRenderer.SetShaderTextureUnit("iChannel3", 3);

		let l1 = this.mRenderer.GetAttribLocation(this.mProgram, "pos");

		//--------------------------------
		let numSamples = this.mTmpBufferSamples;
		let numBlocks = this.mPlaySamples / numSamples;
		for (let j=0; j<numBlocks; j++) {
			let off = j * numSamples;
			this.mRenderer.SetShaderConstant1F_Pos(l2, off / this.mSampleRate);
			this.mRenderer.SetShaderConstant1I_Pos(l3, off);
			this.mRenderer.DrawUnitQuad_XY(l1);
			this.mRenderer.GetPixelData(this.mData, 0, this.mTextureDimensions, this.mTextureDimensions);
			callback(off, this.mData, numSamples);
		}

		this.mRenderer.DetachShader();
		this.mRenderer.DettachTextures();
		this.mRenderer.SetRenderTarget(null);
	}

	PaintSound(wa, d) {
		let bufL = this.mBuffer.getChannelData(0);
		let bufR = this.mBuffer.getChannelData(1);
		this.iRenderSound(d, (off, data, numSamples) => {
								for (let i=0; i<numSamples; i++) {
									bufL[off+i] = -1.0 + 2.0*(data[4*i+0]+256.0*data[4*i+1])/65535.0;
									bufR[off+i] = -1.0 + 2.0*(data[4*i+2]+256.0*data[4*i+3])/65535.0;
								}
							});
	}

	SetUniforms(vrData, wa, d, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, buffers, cubeBuffers, keyboard) {
		let times = [0.0, 0.0, 0.0, 0.0];
		let dates = [d.getFullYear(), d.getMonth(), d.getDate(),
					 d.getHours() * 60 * 60 + d.getMinutes() * 60 + d.getSeconds()  + d.getMilliseconds() / 1000];
		let mouse = [mousePosX, mousePosY, mouseOriX, mouseOriY];
		let resos = [0.0,0.0,0.0, 0.0,0.0,0.0, 0.0,0.0,0.0, 0.0,0.0,0.0];
		let texID = [null, null, null, null];

		for (let i=0; i<this.mInputs.length; i++) {
			let inp = this.mInputs[i];

			if (inp === null) {
				// ---
			} else {
				switch (inp.mInfo.mType) {
					case "texture":
						if (inp.loaded === true) {
							texID[i] = inp.globject;
							resos[3*i+0] = inp.image.width;
							resos[3*i+1] = inp.image.height;
							resos[3*i+2] = 1;
						}
						break;
					case "volume":
						if (inp.loaded === true) {
							texID[i] = inp.globject;
							resos[3*i+0] = inp.mImage.mXres;
							resos[3*i+1] = inp.mImage.mYres;
							resos[3*i+2] = inp.mImage.mZres;
						}
						break;
					case "keyboard":
						texID[i] = keyboard.mTexture;
						break;
					case "cubemap":
						if (inp.loaded === true) {
							let id = assetID_to_cubemapBuferID(inp.mInfo.mID);
							if (id !== -1) {
								texID[i] = cubeBuffers[id].mTexture[cubeBuffers[id].mLastRenderDone];
								resos[3*i+0] = cubeBuffers[id].mResolution[0];
								resos[3*i+1] = cubeBuffers[id].mResolution[1];
								resos[3*i+2] = 1;
								// hack. in webgl2.0 we have samplers, so we don't need this crap here
								let filter = this.mRenderer.FILTER.NONE;
								if (inp.mInfo.mSampler.filter === "linear") filter = this.mRenderer.FILTER.LINEAR;
								else if (inp.mInfo.mSampler.filter === "mipmap") filter = this.mRenderer.FILTER.MIPMAP;
								this.mRenderer.SetSamplerFilter( texID[i], filter, false);
							} else {
								texID[i] = inp.globject;
							}
						}
						break;
					case "webcam":
						if (inp.loaded === true) {
							if (inp.mImage !== null) {
								texID[i] = inp.globject;
								resos[3*i+0] = inp.mImage.width;
								resos[3*i+1] = inp.mImage.height;
								resos[3*i+2] = 1;
							} else if (inp.video.readyState === inp.video.HAVE_ENOUGH_DATA) {
								texID[i] = inp.globject;
								resos[3*i+0] = inp.video.videoWidth;
								resos[3*i+1] = inp.video.videoHeight;
								resos[3*i+2] = 1;
							}
						} else {
							texID[i] = null;
							resos[3*i+0] = inp.video.width;
							resos[3*i+1] = inp.video.height;
							resos[3*i+2] = 1;
						}
						break;
					case "video":
						if (inp.loaded === true) { 
							times[i] = inp.video.currentTime;
							texID[i] = inp.globject;
							resos[3*i+0] = inp.video.videoWidth;
							resos[3*i+1] = inp.video.videoHeight;
							resos[3*i+2] = 1;
						}
						break;
					case "music":
					case "musicstream":
						if (inp.loaded === true) {
							times[i] = inp.audio.currentTime;
							texID[i] = inp.globject;
							if (inp.audio.mForceMuted === true) times[i] = 10.0 + time;
							resos[3*i+0] = 512;
							resos[3*i+1] = 2;
							resos[3*i+2] = 1;
						}
						break;
					case "mic":
						if (inp.loaded === false || inp.mForceMuted || wa === null || inp.mAnalyser == null) {
							times[i] = 10.0 + time;
						}
						if (inp.loaded === true) {
							texID[i] = inp.globject;
							resos[3*i+0] = 512;
							resos[3*i+1] = 2;
							resos[3*i+2] = 1;
						}
						break;
					case "buffer":
						if (inp.loaded === true) {
							texID[i] = buffers[inp.id].mTexture[ buffers[inp.id].mLastRenderDone ];
							resos[3*i+0] = buffers[inp.id].mResolution[0];
							resos[3*i+1] = buffers[inp.id].mResolution[1];
							resos[3*i+2] = 1;
						}
						break;
				}
			}
		}
		this.mRenderer.AttachTextures(4, texID[0], texID[1], texID[2], texID[3]);
		this.mRenderer.AttachShader(this.mProgram);

		this.mRenderer.SetShaderConstant1F("iTime", time);
		this.mRenderer.SetShaderConstant3F("iResolution", xres, yres, 1.0);
		this.mRenderer.SetShaderConstant4FV("iMouse", mouse);
		this.mRenderer.SetShaderConstant1FV("iChannelTime", times);
		this.mRenderer.SetShaderConstant4FV("iDate", dates);
		this.mRenderer.SetShaderConstant3FV("iChannelResolution", resos);
		this.mRenderer.SetShaderConstant1F("iSampleRate", this.mSampleRate);
		this.mRenderer.SetShaderTextureUnit("iChannel0", 0);
		this.mRenderer.SetShaderTextureUnit("iChannel1", 1);
		this.mRenderer.SetShaderTextureUnit("iChannel2", 2);
		this.mRenderer.SetShaderTextureUnit("iChannel3", 3);
		this.mRenderer.SetShaderConstant1I("iFrame", this.mFrame);
		this.mRenderer.SetShaderConstant1F("iTimeDelta", dtime);
		this.mRenderer.SetShaderConstant1F("iFrameRate", fps);

		this.mRenderer.SetShaderConstant1F("iChannel[0].time", times[0]);
		this.mRenderer.SetShaderConstant1F("iChannel[1].time", times[1]);
		this.mRenderer.SetShaderConstant1F("iChannel[2].time", times[2]);
		this.mRenderer.SetShaderConstant1F("iChannel[3].time", times[3]);
		this.mRenderer.SetShaderConstant3F("iChannel[0].resolution", resos[0], resos[ 1], resos[ 2]);
		this.mRenderer.SetShaderConstant3F("iChannel[1].resolution", resos[3], resos[ 4], resos[ 5]);
		this.mRenderer.SetShaderConstant3F("iChannel[2].resolution", resos[6], resos[ 7], resos[ 8]);
		this.mRenderer.SetShaderConstant3F("iChannel[3].resolution", resos[9], resos[10], resos[11]);
	}

	ProcessInputs(vrData, wa, d, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, buffers, cubeBuffers, keyboard) {
		for (let i=0; i<this.mInputs.length; i++) {
			let inp = this.mInputs[i];

			if (inp === null) {
				// ---
			} else {
				switch (inp.mInfo.mType) {
					case "texture": break;
					case "volume": break;
					case "keyboard": break;
					case "cubemap": break;
					case "webcam":
						if (inp.loaded === true) {
							if (inp.mImage !== null) {
								if (this.mTextureCallbackFun !== null) {
									this.mTextureCallbackFun(this.mTextureCallbackObj, i, inp.mImage, false, 7, 1, -1, this.mID);
								}
							} else if (inp.video.readyState === inp.video.HAVE_ENOUGH_DATA) {
								if (this.mTextureCallbackFun !== null) {
									this.mTextureCallbackFun(this.mTextureCallbackObj, i, inp.video, false, 7, 1, -1, this.mID);
								}
								this.mRenderer.UpdateTextureFromImage(inp.globject, inp.video);
								if (inp.mInfo.mSampler.filter === "mipmap") {
									this.mRenderer.CreateMipmaps(inp.globject);
								}
							}
						}
						break;
					case "video":
						if (inp.video.mPaused === false) {
							if (this.mTextureCallbackFun !== null) {
								this.mTextureCallbackFun(this.mTextureCallbackObj, i, inp.video, false, 3, 1, inp.video.currentTime, this.mID);
							}
						}
						if (inp.loaded === true) { 
							if (inp.video.mPaused === false) {
								this.mRenderer.UpdateTextureFromImage(inp.globject, inp.video);
								if (inp.mInfo.mSampler.filter === "mipmap") {
									this.mRenderer.CreateMipmaps(inp.globject);
								}
							}
						}
						break;
					case "music":
					case "musicstream":
						if (inp.audio.mPaused === false && inp.audio.mForceMuted === false && inp.loaded === true) {
							if (wa !== null) {
								inp.audio.mSound.mAnalyser.getByteFrequencyData(inp.audio.mSound.mFreqData);
								inp.audio.mSound.mAnalyser.getByteTimeDomainData(inp.audio.mSound.mWaveData);
							}
							if (this.mTextureCallbackFun !== null) {
								if (inp.mInfo.mType === "music") this.mTextureCallbackFun(this.mTextureCallbackObj, i, (wa === null) ? null : { wave : inp.audio.mSound.mFreqData }, false, 4, 1, inp.audio.currentTime, this.mID);
								else if (inp.mInfo.mType === "musicstream") this.mTextureCallbackFun(this.mTextureCallbackObj, i, (wa === null) ? null : { wave : inp.audio.mSound.mFreqData, info : inp.audio.soundcloudInfo}, false, 8, 1, inp.audio.currentTime, this.mID);
							}
						}
						if (inp.loaded === true) {
							if (inp.audio.mForceMuted === true) {
								let num = inp.audio.mSound.mFreqData.length;
								for (let j=0; j<num; j++) {
									let x = j / num;
									let f = (0.75 + 0.25*Math.sin( 10.0*j + 13.0*time)) * Math.exp( -3.0*x);
									if (j < 3) f = Math.pow(0.50 + 0.5*Math.sin( 6.2831*time), 4.0) * (1.0-j/3.0);
									inp.audio.mSound.mFreqData[j] = Math.floor(255.0*f) | 0;
								}
								for (let j=0; j<num; j++) {
									let f = 0.5 + 0.15*Math.sin(17.0*time + 10.0*6.2831*j/num) * Math.sin( 23.0*time + 1.9*j/num);
									inp.audio.mSound.mWaveData[j] = Math.floor(255.0*f) | 0;
								}
							}
							if (inp.audio.mPaused === false) {
								let waveLen = Math.min(inp.audio.mSound.mWaveData.length, 512);
								this.mRenderer.UpdateTexture(inp.globject, 0, 0, 512, 1, inp.audio.mSound.mFreqData);
								this.mRenderer.UpdateTexture(inp.globject, 0, 1, 512, 1, inp.audio.mSound.mWaveData);
							}
						}
						break;
					case "mic":
						if (inp.loaded === false || inp.mForceMuted || wa === null || inp.mAnalyser === null) {
							let num = inp.mFreqData.length;
							for (let j=0; j<num; j++) {
								let x = j / num;
								let f = (0.75 + 0.25*Math.sin(10.0*j + 13.0*time)) * Math.exp( -3.0*x);
								if (j<3) f = Math.pow(0.50 + 0.5*Math.sin(6.2831*time), 4.0) * (1.0-j/3.0);
								inp.mFreqData[j] = Math.floor(255.0*f) | 0;
							}
							for( let j=0; j<num; j++) {
								let f = 0.5 + 0.15*Math.sin( 17.0*time + 10.0*6.2831*j/num) * Math.sin( 23.0*time + 1.9*j/num);
								inp.mWaveData[j] = Math.floor(255.0*f) | 0;
							}
						} else {
							inp.mAnalyser.getByteFrequencyData(inp.mFreqData);
							inp.mAnalyser.getByteTimeDomainData(inp.mWaveData);
						}
						if (this.mTextureCallbackFun !== null) {
							this.mTextureCallbackFun(this.mTextureCallbackObj, i, {wave: inp.mFreqData}, false, 5, 1, -1, this.mID);
						}
						if (inp.loaded === true) {
							let waveLen = Math.min(inp.mWaveData.length, 512);
							this.mRenderer.UpdateTexture(inp.globject, 0, 0, 512, 1, inp.mFreqData);
							this.mRenderer.UpdateTexture(inp.globject, 0, 1, waveLen, 1, inp.mWaveData);
						}
						break;
					case "buffer":
						if (inp.loaded===true) {
							let id = inp.id;
							let texID = buffers[id].mTexture[buffers[id].mLastRenderDone];
							// hack. in webgl2.0 we have samplers, so we don't need this crap here
							let filter = this.mRenderer.FILTER.NONE;
							if (inp.mInfo.mSampler.filter === "linear") filter = this.mRenderer.FILTER.LINEAR;
							else if (inp.mInfo.mSampler.filter === "mipmap") filter = this.mRenderer.FILTER.MIPMAP;
							this.mRenderer.SetSamplerFilter( texID, filter, false);
						}
						if (this.mTextureCallbackFun!==null) {
							let id = inp.id;
							this.mTextureCallbackFun(this.mTextureCallbackObj, i, {texture:inp.image, data:buffers[id].mThumbnailBuffer}, false, 9, 1, -1, this.mID);
						}
						break;
				}
			}
		}
	}

	PaintCubemap(vrData, wa, d, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, buffers, cubeBuffers, keyboard, face) {
		this.ProcessInputs(vrData, wa, d, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, buffers, cubeBuffers, keyboard, face );
		this.SetUniforms(vrData, wa, d, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, buffers, cubeBuffers, keyboard );

		let l1 = this.mRenderer.GetAttribLocation(this.mProgram, "pos");
		let vp = [0, 0, xres, yres];

		this.mRenderer.SetViewport(vp);

		let corA = [ -1.0, -1.0, -1.0 ];
		let corB = [  1.0, -1.0, -1.0 ];
		let corC = [  1.0,  1.0, -1.0 ];
		let corD = [ -1.0,  1.0, -1.0 ];
		let apex = [  0.0,  0.0,  0.0 ];

		if (face === 0) {
			corA = [  1.0,  1.0,  1.0 ];
			corB = [  1.0,  1.0, -1.0 ];
			corC = [  1.0, -1.0, -1.0 ];
			corD = [  1.0, -1.0,  1.0 ];
		} else if (face === 1) {
			// -X
			corA = [ -1.0,  1.0, -1.0 ];
			corB = [ -1.0,  1.0,  1.0 ];
			corC = [ -1.0, -1.0,  1.0 ];
			corD = [ -1.0, -1.0, -1.0 ];
		} else if (face === 2) {
			// +Y
			corA = [ -1.0,  1.0, -1.0 ];
			corB = [  1.0,  1.0, -1.0 ];
			corC = [  1.0,  1.0,  1.0 ];
			corD = [ -1.0,  1.0,  1.0 ];
		} else if (face === 3) {
			// -Y
			corA = [ -1.0, -1.0,  1.0 ];
			corB = [  1.0, -1.0,  1.0 ];
			corC = [  1.0, -1.0, -1.0 ];
			corD = [ -1.0, -1.0, -1.0 ];
		} else if (face === 4) {
			// +Z
			corA = [ -1.0,  1.0,  1.0 ];
			corB = [  1.0,  1.0,  1.0 ];
			corC = [  1.0, -1.0,  1.0 ];
			corD = [ -1.0, -1.0,  1.0 ];
		} else { //if (face === 5) 
			// -Z
			corA = [  1.0,  1.0, -1.0 ];
			corB = [ -1.0,  1.0, -1.0 ];
			corC = [ -1.0, -1.0, -1.0 ];
			corD = [  1.0, -1.0, -1.0 ];
		}

		let corners = [ corA[0], corA[1], corA[2], 
						corB[0], corB[1], corB[2], 
						corC[0], corC[1], corC[2], 
						corD[0], corD[1], corD[2],
						apex[0], apex[1], apex[2]];
		this.mRenderer.SetShaderConstant3FV("unCorners", corners);
		this.mRenderer.SetShaderConstant4FV("unViewport", vp);
		this.mRenderer.DrawUnitQuad_XY(l1);
		this.mRenderer.DettachTextures();
	}

	Paint(vrData, wa, da, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, isPaused, bufferID, bufferNeedsMimaps, buffers, cubeBuffers, keyboard, effect) {
		let buffer,
			dstID;
		switch (this.mType) {
			case "sound":
				if (this.mSoundShaderCompiled === true) {
					// make sure all textures are loaded
					for (let i=0; i<this.mInputs.length; i++) {
						let inp = this.mInputs[i];
						if (inp === null) continue;
						if (inp.mInfo.mType === "texture" && !inp.loaded) return;
						if (inp.mInfo.mType === "cubemap" && !inp.loaded) return;
					}
					this.PaintSound(wa, da);
					this.mSoundShaderCompiled = false;
				}
				if (this.mFrame === 0) {
					if (this.mPlaying === true) {
						this.mPlayNode.disconnect();
						this.mPlayNode.stop();
						this.mPlayNode = null;
					}
					this.mPlaying = true;
					this.mPlayNode = wa.createBufferSource();
					this.mPlayNode.buffer = this.mBuffer;
					this.mPlayNode.connect(this.mGainNode);
					this.mPlayNode.start(0);
				}
				this.mFrame++;
				break;
			case "image":
				this.mRenderer.SetRenderTarget(null);
				this.PaintImage(vrData, wa, da, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, buffers, cubeBuffers, keyboard);
				this.mFrame++;
				break;
			case "common":
				//console.log("rendering common");
				break;
			case "buffer":
				this.mEffect.ResizeBuffer(bufferID, this.mEffect.mXres, this.mEffect.mYres, false);
				buffer = buffers[bufferID];
				dstID = 1 - buffer.mLastRenderDone;
				this.mRenderer.SetRenderTarget(buffer.mTarget[dstID]);
				this.PaintImage(vrData, wa, da, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, buffers, cubeBuffers, keyboard);
				// compute mipmaps if needd
				if (bufferNeedsMimaps) {
					this.mRenderer.CreateMipmaps(buffer.mTexture[dstID]);
				}
				buffers[bufferID].mLastRenderDone = 1 - buffers[bufferID].mLastRenderDone;
				this.mFrame++;
				break;
			case "cubemap":
				this.mEffect.ResizeCubemapBuffer(bufferID, 1024, 1024, false);
				buffer = cubeBuffers[bufferID];
				xres = buffer.mResolution[0];
				yres = buffer.mResolution[1];
				dstID = 1 - buffer.mLastRenderDone;
				for (let face=0; face<6; face++) {
					this.mRenderer.SetRenderTargetCubeMap(buffer.mTarget[dstID], face);
					this.PaintCubemap(vrData, wa, da, time, dtime, fps, mouseOriX, mouseOriY, mousePosX, mousePosY, xres, yres, buffers, cubeBuffers, keyboard, face);
				}
				this.mRenderer.SetRenderTargetCubeMap(null, 0);
				// compute mipmaps if needd
				if (bufferNeedsMimaps) {
					this.mRenderer.CreateMipmaps(buffer.mTexture[dstID]);
				}
				cubeBuffers[bufferID].mLastRenderDone = 1 - cubeBuffers[bufferID].mLastRenderDone;
				this.mFrame++;
				break;
		}
	}

	StopOutputSound(wa) {
		if (this.mPlayNode === null) return;
		this.mPlayNode.disconnect();
	}

	ResumeOutputSound(wa) {
		if (this.mPlayNode === null) return;
		wa.resume()
		this.mPlayNode.connect(this.mGainNode);
	}

	StopOutputImage(wa) {
		// empty
	}

	ResumeOutputImage(wa) {
		// empty
	}

	StopOutput(wa) {
		for (let j=0; j<this.mInputs.length; j++) {
			this.StopInput(j);
		}
		if (this.mType === "sound") this.StopOutputSound(wa);
		else this.StopOutputImage(wa);
	}

	ResumeOutput(wa) {
		for (let j=0; j<this.mInputs.length; j++) {
			this.ResumeInput(j);
		}
		if (this.mType === "sound") this.ResumeOutputSound(wa);
		else this.ResumeOutputImage(wa);
	}

	GetCompilationTime() {
		return this.mCompilationTime;
	}

}


