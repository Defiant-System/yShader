
class Shader {
	constructor(canvas, quality=1, debug) {
		this.mAudioContext = new AudioContext();
		this.mCreated = false;
		this.mHttpReq = new XMLHttpRequest();
		this.mEffect = null;
		this.mTOffset = 0;
		this.mFPS = this.CreateFPSCounter();
		this.mIsPaused = false;
		this.mForceFrame = false;
		this.mPass = [];
		this.mVR = null;
		this.mState = 0;
		this.mActiveDoc = 0;

		this.mCanvas = canvas;
		// this.mCanvas.width = canvas.offsetWidth;
		// this.mCanvas.height = canvas.offsetHeight;

		this.mTo = Shader.getRealTime();
		this.mTf = 0;
		this.mRestarted = true;
		this.mFPS.Reset(this.mTo);
		this.mMouseIsDown = false;
		this.mMouseSignalDown = false;
		this.mMouseOriX = 0;
		this.mMouseOriY = 0;
		this.mMousePosX = 0;
		this.mMousePosY = 0;
		this.mIsRendering = false;

		let resizeCB = (xres, yres) => {
				this.mForceFrame = true;
				this.iSetResolution(xres, yres);
			},
			crashCB = () => {
				this.mIsPaused = true;
				alert(`Shader: ooops, your WebGL implementation has crashed!`);
			};
		this.mEffect = new Effect(this.mVR, this.mAudioContext, this.mCanvas, this.RefreshTexturThumbail, this, false, false, resizeCB, crashCB);
		
		this.mMediaRecorder = null;
		this.mCreated = true;

		this.resetQualities();
		this.mAutoQuality = quality === "auto";
		this.quality = quality === "auto" ? 1 : quality;
		this.fpsLog = [];
		this.mDebug = debug;
	}

	resetQualities() {
		this.mQualities = {
			1: 47,
			2: 47,
			4: 47,
			8: 47,
		};
	}

	static getRealTime() {
		return window.performance.now();
	}

	get quality() {
		return this.mQuality;
	}

	set quality(q) {
		// if (this.mQualities[q]) return;
		let xres = Math.round(this.mCanvas.offsetWidth / q),
			yres = Math.round(this.mCanvas.offsetHeight / q);
		this.mQuality = q;
		this.mCanvas.width = xres;
		this.mCanvas.height = yres;
		this.mEffect.mXres = xres;
		this.mEffect.mYres = yres;
		this.mEffect.ResizeBuffers(xres, yres);
	}

	CreateFPSCounter() {
		let mFrame,
			mTo,
			mFPS,
			GetFPS = () => mFPS,
			Reset = time => {
				mFrame = 0;
				mTo = time;
				mFPS = 60;
			},
			Count = time => {
				mFrame++;
				if ((time-mTo) > 500) {
					mFPS = 1000 * mFrame / (time - mTo);
					mFrame = 0;
					mTo = time;
					return true;
				}
				return false;
			};
		return { Reset, Count, GetFPS };
	}

	iSetResolution(xres, yres) {
		if (this.mDebug) APP.els.details.resolution.html(`${xres} x ${yres}`);
	}

	saveScreenshot() {
		this.mEffect.saveScreenshot(this.mActiveDoc);
	}

	startRendering() {
		this.mIsRendering = true;

		let renderLoop = () => {
			if (this.mIsPaused) return;
			this.mEffect.RequestAnimationFrame(renderLoop);

			if (this.mIsPaused && !this.mForceFrame) {
				this.mEffect.UpdateInputs(this.mActiveDoc, false);
				return;
			}
			this.mForceFrame = false;

			let time = Shader.getRealTime(),
				ltime = 0,
				dtime = 0;
			if (this.mIsPaused)  {
				ltime = this.mTf;
				dtime = 1000/60;
			} else {
				ltime = this.mTOffset + time - this.mTo;
				if (this.mRestarted) dtime = 1000/60;
				else dtime = ltime - this.mTf; 
				this.mTf = ltime;
			}
			this.mRestarted = false;

			let newFPS = this.mFPS.Count(time),
				mouseOriX = Math.abs(this.mMouseOriX),
				mouseOriY = Math.abs(this.mMouseOriY);

			if (!this.mMouseIsDown) mouseOriX = -mouseOriX;
			if (!this.mMouseSignalDown) mouseOriY = -mouseOriY;

			this.mMouseSignalDown = false;
			this.mEffect.Paint(ltime/1000, dtime/1000, this.mFPS.GetFPS(), mouseOriX, mouseOriY, this.mMousePosX, this.mMousePosY, this.mIsPaused);

			let fps = this.mFPS.GetFPS().toFixed(1),
				fpsLen = 60;
			if (this.mAutoQuality) {
				this.fpsLog.unshift(Math.round(+fps));
				this.fpsLog.splice(fpsLen, 1e3);

				if (this.fpsLog.length >= fpsLen) {
					let avg = this.fpsLog.reduce((a, b) => a + b, 0) / fpsLen,
						keys = Object.keys(this.mQualities).map(e => +e),
						qIndex = keys.findIndex(e => e === this.quality),
						next;
					
					if (avg < 37 && qIndex < keys.length-1 && this.mQualities[keys[qIndex+1]] >= 47) {
						next = keys[qIndex+1];
						if (this.mDebug) console.log( "Decrease quality: ", next );
					}
					if (avg > 59 && qIndex > 0 && this.mQualities[keys[qIndex-1]] >= 47) {
						next = keys[qIndex-1];
						if (this.mDebug) console.log( "Increase quality: ", next );
					}
					if (next !== undefined) {
						this.mQualities[this.quality] = avg;
						this.quality = +next;
						this.fpsLog = [];
					}
				}
			}

			if (this.mDebug) {
				APP.els.details.time.html((ltime/1000).toFixed(2));
				APP.els.details.quality.html(this.quality);
				if (!this.mIsPaused && newFPS) {
					APP.els.details.frameRate.html(fps);
				}
			}
		}
		if (!this.mIsPaused) renderLoop();
	}

	get paused() {
		return this.mIsPaused;
	}

	resetPlay() {
		if (this.mIsPaused) {
			return this.pauseTime();
		}
		this.startRendering();
		this.resetTime();
	}

	pauseTime(doFocusCanvas) {
		if (!this.mIsPaused) {
			// $("myPauseButton").style.background="url('res/img/play.png')";
			this.mIsPaused = true;
			this.mEffect.StopOutputs();
		} else {
			// $("myPauseButton").style.background="url('res/img/pause.png')";
			this.mTOffset = this.mTf;
			this.mTo = Shader.getRealTime();
			this.mIsPaused = false;
			this.mRestarted = true;
			this.mEffect.ResumeOutputs();
			this.startRendering();
			// if (doFocusCanvas) this.mCanvas.focus(); // put mouse/keyboard focus on canvas
		}
	}

	resetTime(doFocusOnCanvas) {
		this.mTOffset = 0;
		this.mTo = Shader.getRealTime();
		this.mTf = 0;
		this.mRestarted = true;
		this.mFpsTo = this.mTo;
		this.mFpsFrame = 0;
		this.mForceFrame = true;
		this.mEffect.ResetTime();
		// if (doFocusOnCanvas) this.mCanvas.focus(); // put mouse/keyboard focus on canvas
	}

	SetErrors(isError, errorStr, fromScript) {

	}

	AllowPublishing() {
		return this.mAreThereAnyErrors ? false : true;
	}

	GetTotalCompilationTime() {
		return this.mEffect.GetTotalCompilationTime();
	}

	SetErrorsGlobal(areThereAnyErrors, fromScript) {

	}

	PauseInput(id) {
		return this.mEffect.PauseInput(this.mActiveDoc, id);
	}

	ToggleMuteInput(id) {
		return this.mEffect.ToggleMuteInput( this.mActiveDoc, id );
	}

	RewindInput(id) {
		this.mEffect.RewindInput( this.mActiveDoc, id );
	}

	SetTexture(slot, url) {
		this.mNeedsSave = true;
		var res = this.mEffect.NewTexture( this.mActiveDoc, slot, url );
		if( res.mFailed===false )
		{
			this.mPass[this.mActiveDoc].mDirty = res.mNeedsShaderCompile;
		}
	}

	GetTexture(slot) {
		return this.mEffect.GetTexture( this.mActiveDoc, slot );
	}

	GetAcceptsLinear(slot) {
		return this.mEffect.GetAcceptsLinear(this.mActiveDoc, slot);
	}

	GetAcceptsMipmapping(slot) {
		return this.mEffect.GetAcceptsMipmapping(this.mActiveDoc, slot);
	}

	GetAcceptsWrapRepeat(slot) {
		return this.mEffect.GetAcceptsWrapRepeat(this.mActiveDoc, slot);
	}

	GetAcceptsVFlip(slot) {
		return this.mEffect.GetAcceptsVFlip(this.mActiveDoc, slot);
	}

	SetSamplerFilter(slot, str) {
		this.mEffect.SetSamplerFilter(this.mActiveDoc, slot, str);
		this.mForceFrame = true;
	}

	GetSamplerFilter(slot) {
		return this.mEffect.GetSamplerFilter(this.mActiveDoc, slot);
	}

	SetSamplerWrap(slot, str) {
		this.mEffect.SetSamplerWrap(this.mActiveDoc, slot, str);
		this.mForceFrame = true;
	}

	GetSamplerWrap(slot) {
		return this.mEffect.GetSamplerWrap(this.mActiveDoc, slot);
	}

	SetSamplerVFlip(slot, str) {
		this.mEffect.SetSamplerVFlip(this.mActiveDoc, slot, str);
		this.mForceFrame = true;
	}

	GetSamplerVFlip(slot) {
		return this.mEffect.GetSamplerVFlip(this.mActiveDoc, slot);
	}

	ShowTranslatedSource() {
		let str = this.mEffect.GetTranslatedShaderSource(this.mActiveDoc);
		console.error(str);
		// let ve = $("centerScreen" );
		// doAlert( piGetCoords(ve), { mX: 640, mY: 512 }, "Translated Shader Code", "<pre>"+str+"</pre>", false, null );
	}

	UIStartCompiling(affectsUI) {
		this.mState = 2;
		if (this.mDebug) APP.els.details.state.html("Compiling...");
		if (affectsUI) this.setActionsState(false);
	}

	UIEndCompiling(affectsUI) {
		if (affectsUI) this.setActionsState(true);

		let anyErrors = this.mEffect.GetErrorGlobal();
		this.setCompilationTime();
		this.setSaveOptions(anyErrors);
		this.SetErrors(this.mEffect.GetError(this.mActiveDoc),
						this.mEffect.GetErrorStr(this.mActiveDoc), false);
		this.SetErrorsGlobal(anyErrors, false);
		this.setChars();
		this.setFlags();

		if (!anyErrors) {
			if (!this.mIsRendering) {
				this.startRendering();
				this.resetTime();
			}
			this.mForceFrame = true;
		}
		this.mState = 1;
	}

	setActionsState(areEnabled) {

	}

	SetShaderFromEditor(forceall, affectsUI) {
		
	}

	RefreshTexturThumbail(myself, slot, img, forceFrame, guiID, renderID, time, passID) {
		if (passID !== myself.mActiveDoc) return;

		var canvas = APP.els.textures[`iChannel${slot}`];
		// var i0 = $("myPauseButton"+ slot);
		// var i1 = $("myRewindButton"+ slot);
		// var i2 = $("myMuteButton"+ slot);
		// var i3 = $("mySamplingButton"+ slot);
		// var i4 = $("myNoInput"+ slot);

		// if (guiID === 0) {
		// 	i3.style.visibility = "hidden";
		// 	i4.style.visibility = "hidden";
		// } else {
		// 	i3.style.visibility = "visible";
		// 	i4.style.visibility = "visible";
		// }

		// if (guiID === 0 || guiID === 1 || guiID===2 || guiID===5 || guiID===6 || guiID===9) {
		// 	i0.style.visibility = "hidden";
		// 	i1.style.visibility = "hidden";
		// 	i2.style.visibility = "hidden";
		// } else {
		// 	i0.style.visibility = "visible";
		// 	i1.style.visibility = "visible";
		// 	i2.style.visibility = "visible";
		// }

		var w = canvas.width;
		var h = canvas.height;
		var ctx = canvas.getContext('2d');
		
		ctx.fillStyle = "#000000";

		if (guiID === 0) {
			ctx.fillRect(0, 0, w, h);
		} else if (guiID === 1) {
			if (renderID===0) {
				ctx.fillRect(0, 0, w, h+4);
			} else {
				ctx.fillRect(0, 0, w, h);  
				ctx.drawImage(img, 0, 0, w, h);
			}
		} else if (guiID == 2) {
			if (renderID===0) ctx.fillRect(0, 0, w, h+4);
			else ctx.drawImage(img, 0, 0, w, h);
		} else if (guiID === 3) {
			if (renderID===0) ctx.fillRect(0, 0, w, h+4);
			else ctx.drawImage(img, 0, 0, w, h);
		} else if (guiID === 4 || guiID === 5 || guiID === 8) {
			if (renderID === 0) {
				ctx.fillRect(0, 0, w, h+4);
				ctx.strokeStyle = "#808080";
				ctx.lineWidth = 1;
				ctx.beginPath();

				for (let i=0, num = w/2; i<num; i++) {
					let y = Math.sin(64.0 * 6.2831 * i / num + time) * Math.sin(2.0 * 6.2831 * i / num + time);
					let ix = w * i / num;
					let iy = h * (0.5 + 0.4 * y);
					if (i === 0) ctx.moveTo(ix, iy);
					else ctx.lineTo(ix, iy);
				}
				ctx.stroke();

				let str = "Audio not loaded";
				ctx.font = "normal bold 20px Arial";
				ctx.lineWidth = 4;
				ctx.strokeStyle = "#000000";
				ctx.strokeText(str, 14, h / 2);
				ctx.fillStyle = "#ff0000";
				ctx.fillText(str, 14, h / 2);

				// $("myPauseButton"+ slot).src = "res/img/pause.png";
			} else  {
				var voff = 0;

				ctx.fillStyle = "#000000";
				ctx.fillRect(0, 0, w, h);
				ctx.fillStyle = "#ffffff";

				var numfft = img.wave.length;
				numfft /= 2;
				if (numfft > 512) numfft = 512;
				let num = 32;
				var numb = (numfft / num) | 0;
				var s = ((w - 8 * 2) / num);
				var k = 0;
				for (let i=0; i<num; i++) {
					let f = 0.0;
					for (let j=0; j<numb; j++) {
						f += img.wave[k++];
					}
					f /= numb;
					f /= 255.0;

					let fr = f;
					let fg = 4.0 * f * (1.0 - f);
					let fb = 1.0 - f;
					let rr = (255.0 * fr) | 0;
					let gg = (255.0 * fg) | 0;
					let bb = (255.0 * fb) | 0;
					var decColor = 0x1000000 + bb + 0x100 * gg + 0x10000 * rr;

					ctx.fillStyle = '#' + decColor.toString(16).substr(1);

					var a = Math.max(2, f * (h - 2 * 20));
					ctx.fillRect(8 + i * s, h - voff - a, 3 * s / 4, a);
				}
				// If it is a music stream then we want to show extra information
				if (guiID === 8) {
					let str = img.info.user.username + " - " + img.info.title;
					let x = w - 10.0 * (time % 45.0);
					ctx.font = "normal normal 10px Arial";
					ctx.strokeStyle = "#000000";
					ctx.lineWidth = 4;
					ctx.strokeText(str,x,32);
					ctx.fillStyle = "#ffffff";
					ctx.fillText(str,x,32);
					ctx.drawImage(myself.mSoundcloudImage, 45, 0);
				}
			}
		} else if (guiID === 6) {
			//kyeboard
			var thereskey = false;
			ctx.fillStyle = "#ffffff";
			for( let i=0; i<256; i++) {
				let x = (w*i/256) | 0;
				if (img.mData[i] > 0) {
					thereskey = true;
					break;
				}
			}
			ctx.drawImage(img.mImage, 0, 0, w, h);

			if (thereskey) {
				ctx.fillStyle = "#ff8040";
				ctx.globalAlpha = 0.4;
				ctx.fillRect(0,0,w,h);
				ctx.globalAlpha = 1.0;
			}
		} else if (guiID === 7) {
			ctx.fillStyle = "#000000";
			if (renderID === 0) ctx.fillRect(0, 0, w, h);
			else ctx.drawImage(img, 0, 0, w, h);
		} else if (guiID === 9) {
			if (renderID === 0) {
				ctx.fillStyle = "#808080";
				ctx.fillRect(0, 0, w, h);
			} else {
				ctx.drawImage(img.texture, 0, 0, w, h);
				if (img.data !== null) {
					ctx.putImageData(img.data, 0, 0,  0, 0, w, h);
				}
			}
		}
		if (time > 0.0) {
			let str = time.toFixed(2) + "s";
			ctx.font="normal normal 10px Arial";
			ctx.strokeStyle = "#000000";
			ctx.lineWidth = 4;
			ctx.strokeText(str,4,12);
			ctx.fillStyle = "#ffffff";
			ctx.fillText(str,4,12);
		}
		myself.mForceFrame = forceFrame;
	}

	setChars() {
		if (this.mPass.length === 1) {
			if (this.mPass[0].mCharCountDirty) {
				this.mPass[0].mCharCountDirty = false;
			}
		} else {
			var currentPassCount = 0;
			var globalCount = 0;
			for (let i=0; i<this.mPass.length; i++) {
				if (this.mPass[i].mCharCountDirty) {
					this.mPass[i].mCharCount = minify(this.mPass[i].mDocs.getValue()).length;
					this.mPass[i].mCharCountDirty = false;
				}
				if (i === this.mActiveDoc) currentPassCount = this.mPass[i].mCharCount;
				globalCount += this.mPass[i].mCharCount;
			}
		}
	}

	setCompilationTime() {
		let ti = this.mEffect.GetTotalCompilationTime();
		if (this.mDebug) APP.els.details.state.html(`Compiled in ${ti.toFixed(1)} secs`);
	}

	setFlags() {
		if (this.mEffect === null) return;
		var flags = this.mEffect.calcFlags();
	}

	Load(jsn, preventCache, doResolve) {
		let Self = this;
		if (!this.mEffect.Load(jsn)) return;

		this.resetQualities();
		this.UIStartCompiling(true);
		this.mEffect.Compile(true, worked => Self.UIEndCompiling(true));
	}

	CheckShaderCorrectness() {
		let numPasses = this.mEffect.GetNumPasses(),
			countImage = 0,
			countCommon = 0,
			countSound = 0,
			countCubemap = 0,
			countBuffer = 0;
		for (let j=0; j<numPasses; j++) {
			let passType = this.mEffect.GetPassType(j);
			if (passType === "image"  ) countImage++;
			if (passType === "common" ) countCommon++;
			if (passType === "sound"  ) countSound++;
			if (passType === "cubemap") countCubemap++;
			if (passType === "buffer" ) countBuffer++;
		}
		if (countImage !== 1) return false;
		if (countCommon  > 1) return false;
		if (countSound   > 1) return false;
		if (countCubemap > 1) return false;
		if (countBuffer  > 4) return false;
		return true;
	}

	setSaveOptions(areThereErrors) {}
	showChars() {}
	ChangeTabLeft() {}
	ChangeTabRight() {}
	ChangePass() {}
	KillPass(id) {}
	AddPass() {}
	AddPlusTabs() {}
	AddTab() {}
	BuildTabs() {}
	Save() {}

}
