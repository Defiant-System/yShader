
class Renderer {
	constructor(mGL) {
		this.mGL = mGL;
		this.mBindedShader = null;
		this.debug = false;
		this.mIs20 = true;
		this.mFloat32Textures = true;
		this.mFloat32Filter = mGL.getExtension("OES_texture_float_linear");
		this.mFloat16Textures = true;
		this.mDrawBuffers = true;
		this.mDepthTextures = true;
		this.mDerivatives = true;
		this.mShaderTextureLOD = true;
		this.mFloat16Filter = mGL.getExtension("OES_texture_half_float_linear");
		this.mAnisotropic = mGL.getExtension("EXT_texture_filter_anisotropic");
		this.mRenderToFloat32F = mGL.getExtension("EXT_color_buffer_float");
		this.mDebugShader = mGL.getExtension("WEBGL_debug_shaders");
		this.mAsynchCompile = mGL.getExtension("KHR_parallel_shader_compile");
		this.mShaderHeader = [
			`#version 300 es
			#ifdef GL_ES
			precision highp float;
			precision highp int;
			precision mediump sampler3D;
			#endif\n`,

			`#version 300 es
			#ifdef GL_ES
			precision highp float;
			precision highp int;
			precision mediump sampler3D;
			#endif\n`,
		];
		this.mShaderHeaderLines = [6, 6];

		this.CLEAR      = { Color: 1, Zbuffer : 2, Stencil : 4 };
		this.TEXFMT     = { C4I8 : 0, C1I8 : 1, C1F16 : 2, C4F16 : 3, C1F32 : 4, C4F32 : 5, Z16 : 6, Z24 : 7, Z32 : 8, C3F32:9 };
		this.TEXWRP     = { CLAMP : 0, REPEAT : 1 };
		this.BUFTYPE    = { STATIC : 0, DYNAMIC : 1 };
		this.PRIMTYPE   = { POINTS : 0, LINES : 1, LINE_LOOP : 2, LINE_STRIP : 3, TRIANGLES : 4, TRIANGLE_STRIP : 5 };
		this.RENDSTGATE = { WIREFRAME : 0, FRONT_FACE : 1, CULL_FACE : 2, DEPTH_TEST : 3, ALPHA_TO_COVERAGE : 4 };
		this.TEXTYPE    = { T2D : 0, T3D : 1, CUBEMAP : 2 };
		this.FILTER     = { NONE : 0, LINEAR : 1, MIPMAP : 2, NONE_MIPMAP : 3 };
		this.TYPE       = { UINT8 : 0, UINT16 : 1, UINT32 : 2, FLOAT16: 3, FLOAT32 : 4, FLOAT64: 5 };

		mGL.hint(mGL.FRAGMENT_SHADER_DERIVATIVE_HINT, mGL.NICEST);

		if (this.debug) {
			console.table({
					"WebGL 2.0": this.mIs20 ? "yes" : "no",
					"Asynch Compile": this.mAsynchCompile !== null ? "yes" : "no",
					"Textures F32": this.mFloat32Textures !== null ? "yes" : "no",
					"Textures F16": this.mFloat16Textures !== null ? "yes" : "no",
					"Depth": this.mDepthTextures !== null ? "yes" : "no",
					"LOD": this.mShaderTextureLOD!== null ? "yes" : "no",
					"Aniso": this.mAnisotropic !== null ? "yes" : "no",
					"Units": mGL.getParameter(mGL.MAX_TEXTURE_IMAGE_UNITS),
					"Max Size": mGL.getParameter(mGL.MAX_TEXTURE_SIZE),
					"Cube Max Size": mGL.getParameter(mGL.MAX_CUBE_MAP_TEXTURE_SIZE),
					"Targets: MRT": this.mDrawBuffers !== null ? "yes" : "no",
					"F32": this.mRenderToFloat32F !== null ? "yes" : "no",
					"Max Size": mGL.getParameter(mGL.MAX_RENDERBUFFER_SIZE),
				});
		}

		// create a 2D quad Vertex Buffer
		let vertices = new Float32Array([-1.0, -1.0,   1.0, -1.0,    -1.0,  1.0,     1.0, -1.0,    1.0,  1.0,    -1.0,  1.0]);
		this.mVBO_Quad = mGL.createBuffer();
		mGL.bindBuffer(mGL.ARRAY_BUFFER, this.mVBO_Quad);
		mGL.bufferData(mGL.ARRAY_BUFFER, vertices, mGL.STATIC_DRAW);
		mGL.bindBuffer(mGL.ARRAY_BUFFER, null);

		// create a 2D triangle Vertex Buffer
		this.mVBO_Tri = mGL.createBuffer();
		mGL.bindBuffer(mGL.ARRAY_BUFFER, this.mVBO_Tri);
		mGL.bufferData(mGL.ARRAY_BUFFER, new Float32Array([-1.0, -1.0,   3.0, -1.0,    -1.0,  3.0]), mGL.STATIC_DRAW);
		mGL.bindBuffer(mGL.ARRAY_BUFFER, null);

		// create a 3D cube Vertex Buffer
		this.mVBO_CubePosNor = mGL.createBuffer();
		mGL.bindBuffer(mGL.ARRAY_BUFFER, this.mVBO_CubePosNor);
		mGL.bufferData(mGL.ARRAY_BUFFER, new Float32Array([-1.0, -1.0, -1.0,  -1.0,  0.0,  0.0,
															-1.0, -1.0,  1.0,  -1.0,  0.0,  0.0,
															-1.0,  1.0, -1.0,  -1.0,  0.0,  0.0,
															-1.0,  1.0,  1.0,  -1.0,  0.0,  0.0,
															 1.0,  1.0, -1.0,   1.0,  0.0,  0.0,
															 1.0,  1.0,  1.0,   1.0,  0.0,  0.0,
															 1.0, -1.0, -1.0,   1.0,  0.0,  0.0,
															 1.0, -1.0,  1.0,   1.0,  0.0,  0.0,
															 1.0,  1.0,  1.0,   0.0,  1.0,  0.0,
															 1.0,  1.0, -1.0,   0.0,  1.0,  0.0,
															-1.0,  1.0,  1.0,   0.0,  1.0,  0.0,
															-1.0,  1.0, -1.0,   0.0,  1.0,  0.0,
															 1.0, -1.0, -1.0,   0.0, -1.0,  0.0,
															 1.0, -1.0,  1.0,   0.0, -1.0,  0.0,
															-1.0, -1.0, -1.0,   0.0, -1.0,  0.0,
															-1.0, -1.0,  1.0,   0.0, -1.0,  0.0,
															-1.0,  1.0,  1.0,   0.0,  0.0,  1.0,
															-1.0, -1.0,  1.0,   0.0,  0.0,  1.0,
															 1.0,  1.0,  1.0,   0.0,  0.0,  1.0,
															 1.0, -1.0,  1.0,   0.0,  0.0,  1.0,
															-1.0, -1.0, -1.0,   0.0,  0.0, -1.0,
															-1.0,  1.0, -1.0,   0.0,  0.0, -1.0,
															 1.0, -1.0, -1.0,   0.0,  0.0, -1.0,
															 1.0,  1.0, -1.0,   0.0,  0.0, -1.0]), mGL.STATIC_DRAW);
		mGL.bindBuffer(mGL.ARRAY_BUFFER, null);

		// create a 3D cube Vertex Buffer
		this.mVBO_CubePos = mGL.createBuffer();
		mGL.bindBuffer(mGL.ARRAY_BUFFER, this.mVBO_CubePos);
		mGL.bufferData(mGL.ARRAY_BUFFER, new Float32Array([ -1.0, -1.0, -1.0,
															-1.0, -1.0,  1.0,
															-1.0,  1.0, -1.0,
															-1.0,  1.0,  1.0,
															 1.0,  1.0, -1.0,
															 1.0,  1.0,  1.0,
															 1.0, -1.0, -1.0,
															 1.0, -1.0,  1.0,
															 1.0,  1.0,  1.0,
															 1.0,  1.0, -1.0,
															-1.0,  1.0,  1.0,
															-1.0,  1.0, -1.0,
															 1.0, -1.0, -1.0,
															 1.0, -1.0,  1.0,
															-1.0, -1.0, -1.0,
															-1.0, -1.0,  1.0,
															-1.0,  1.0,  1.0,
															-1.0, -1.0,  1.0,
															 1.0,  1.0,  1.0,
															 1.0, -1.0,  1.0,
															-1.0, -1.0, -1.0,
															-1.0,  1.0, -1.0,
															 1.0, -1.0, -1.0,
															 1.0,  1.0, -1.0]), mGL.STATIC_DRAW);
		mGL.bindBuffer(mGL.ARRAY_BUFFER, null);
	}

	iFormatPI2GL(format) {
		switch (format) {
			case this.TEXFMT.C4I8:  return { mGLFormat: this.mGL.RGBA8,              mGLExternal: this.mGL.RGBA,             mGLType: this.mGL.UNSIGNED_BYTE };
			case this.TEXFMT.C1I8:  return { mGLFormat: this.mGL.R8,                 mGLExternal: this.mGL.RED,              mGLType: this.mGL.UNSIGNED_BYTE };
			case this.TEXFMT.C1F16: return { mGLFormat: this.mGL.R16F,               mGLExternal: this.mGL.RED,              mGLType: this.mGL.FLOAT };
			case this.TEXFMT.C4F16: return { mGLFormat: this.mGL.RGBA16F,            mGLExternal: this.mGL.RGBA,             mGLType: this.mGL.FLOAT };
			case this.TEXFMT.C1F32: return { mGLFormat: this.mGL.R32F,               mGLExternal: this.mGL.RED,              mGLType: this.mGL.FLOAT };
			case this.TEXFMT.C4F32: return { mGLFormat: this.mGL.RGBA32F,            mGLExternal: this.mGL.RGBA,             mGLType: this.mGL.FLOAT };
			case this.TEXFMT.C3F32: return { mGLFormat: this.mGL.RGB32F,             mGLExternal: this.mGL.RGB,              mGLType: this.mGL.FLOAT };
			case this.TEXFMT.Z16:   return { mGLFormat: this.mGL.DEPTH_COMPONENT16,  mGLExternal: this.mGL.DEPTH_COMPONENT,  mGLType: this.mGL.UNSIGNED_SHORT };
			case this.TEXFMT.Z24:   return { mGLFormat: this.mGL.DEPTH_COMPONENT24,  mGLExternal: this.mGL.DEPTH_COMPONENT,  mGLType: this.mGL.UNSIGNED_SHORT };
			case this.TEXFMT.Z32:   return { mGLFormat: this.mGL.DEPTH_COMPONENT32F, mGLExternal: this.mGL.DEPTH_COMPONENT,  mGLType: this.mGL.UNSIGNED_SHORT };
		}
		return null;
	}

	GetCaps() {
		return {
			mIsGL20 : this.mIs20,
			mFloat32Textures: this.mFloat32Textures != null,
			mFloat16Textures: this.mFloat16Textures != null,
			mDrawBuffers: this.mDrawBuffers != null,
			mDepthTextures: this.mDepthTextures != null,
			mDerivatives: this.mDerivatives != null,
			mShaderTextureLOD: this.mShaderTextureLOD != null,
		}
	}

	GetShaderHeaderLines(shaderType) {
		return this.mShaderHeaderLines[shaderType];
	}

	CheckErrors() {
		let error = this.mGL.getError();
		if (error != this.mGL.NO_ERROR) { 
			for (let prop in this.mGL) {
				if (typeof this.mGL[prop] == 'number') {
					if (this.mGL[prop] == error) {
						console.log("GL Error " + error + ": " + prop);
						break;
					}
				}
			}
		}
	}

	Clear(flags, ccolor, cdepth, cstencil) {
		let mode = 0;
		if (flags & 1) {
			mode |= this.mGL.COLOR_BUFFER_BIT;
			this.mGL.clearColor(ccolor[0], ccolor[1], ccolor[2], ccolor[3]);
		}
		if (flags & 2) {
			mode |= this.mGL.DEPTH_BUFFER_BIT;
			this.mGL.clearDepth(cdepth);
		}
		if (flags & 4) {
			mode |= this.mGL.STENCIL_BUFFER_BIT;
			this.mGL.clearStencil(cstencil);
		}
		this.mGL.clear(mode);
	}

	CreateTexture(type, xres, yres, format, filter, wrap, buffer) {
		if (this.mGL === null) return null;

		let mGL = this.mGL,
			id = mGL.createTexture(),
			glFoTy = this.iFormatPI2GL(format),
			glWrap = mGL.REPEAT;
		if (wrap === this.TEXWRP.CLAMP) glWrap = mGL.CLAMP_TO_EDGE;

		if (type === this.TEXTYPE.T2D) {
			mGL.bindTexture(mGL.TEXTURE_2D, id);
			mGL.texImage2D(mGL.TEXTURE_2D, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer);
			mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_WRAP_S, glWrap);
			mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_WRAP_T, glWrap);

			if (filter === this.FILTER.NONE) {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST);
			} else if (filter === this.FILTER.LINEAR) {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR);
			} else if (filter === this.FILTER.MIPMAP) {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR_MIPMAP_LINEAR);
				mGL.generateMipmap(mGL.TEXTURE_2D);
			} else {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST_MIPMAP_LINEAR);
				mGL.generateMipmap(mGL.TEXTURE_2D);
			}
			mGL.bindTexture(mGL.TEXTURE_2D, null);
		} else if (type === this.TEXTYPE.T3D) {
			if (this.mIs20) {
				mGL.bindTexture(mGL.TEXTURE_3D, id);
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_BASE_LEVEL, 0);
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MAX_LEVEL, Math.log2(xres));
				if (filter === this.FILTER.NONE) {
					mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
					mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST);
				} else if (filter === this.FILTER.LINEAR) {
					mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
					mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR);
				} else if (filter === this.FILTER.MIPMAP) {
					mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
					mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR_MIPMAP_LINEAR);
				} else {
					mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
					mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST_MIPMAP_LINEAR);
					mGL.generateMipmap(mGL.TEXTURE_3D);
				}
				mGL.texImage3D(mGL.TEXTURE_3D, 0, glFoTy.mGLFormat, xres, yres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer);
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_WRAP_R, glWrap);
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_WRAP_S, glWrap);
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_WRAP_T, glWrap);

				if (filter === this.FILTER.MIPMAP) mGL.generateMipmap(mGL.TEXTURE_3D);
				mGL.bindTexture(mGL.TEXTURE_3D, null);
			} else {
				return null;
			}
		} else {
			mGL.bindTexture(mGL.TEXTURE_CUBE_MAP, id);
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_POSITIVE_X, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer);
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer);
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer);
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer);
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer);
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, glFoTy.mGLFormat, xres, yres, 0, glFoTy.mGLExternal, glFoTy.mGLType, buffer);

			if (filter === this.FILTER.NONE) {
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST);
			} else if (filter === this.FILTER.LINEAR) {
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR);
			} else if (filter === this.FILTER.MIPMAP) {
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR_MIPMAP_LINEAR);
			}
			if (filter === this.FILTER.MIPMAP) mGL.generateMipmap(mGL.TEXTURE_CUBE_MAP);
			mGL.bindTexture(mGL.TEXTURE_CUBE_MAP, null);
		}
		return {
			mObjectID: id,
			mXres: xres,
			mYres: yres,
			mFormat: format,
			mType: type,
			mFilter: filter,
			mWrap: wrap,
			mVFlip: false
		};
	}

	CreateTextureFromImage(type, image, format, filter, wrap, flipY) {
		if (this.mGL === null) return null;

		let mGL = this.mGL,
			id = mGL.createTexture(),
			glFoTy = this.iFormatPI2GL(format),
			glWrap = mGL.REPEAT;
		if (wrap === this.TEXWRP.CLAMP) glWrap = mGL.CLAMP_TO_EDGE;

		if (type === this.TEXTYPE.T2D) {
			mGL.bindTexture(mGL.TEXTURE_2D, id);
			mGL.pixelStorei(mGL.UNPACK_FLIP_Y_WEBGL, flipY);
			mGL.pixelStorei(mGL.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			if (this.mIs20) mGL.pixelStorei(mGL.UNPACK_COLORSPACE_CONVERSION_WEBGL, mGL.NONE);

			mGL.texImage2D(mGL.TEXTURE_2D, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, image);
			mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_WRAP_S, glWrap);
			mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_WRAP_T, glWrap);

			if (filter === this.FILTER.NONE) {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST);
			} else if (filter === this.FILTER.LINEAR) {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR);
			} else if (filter === this.FILTER.MIPMAP) {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR_MIPMAP_LINEAR);
				mGL.generateMipmap(mGL.TEXTURE_2D);
			} else {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST_MIPMAP_LINEAR);
				mGL.generateMipmap(mGL.TEXTURE_2D);
			}
			mGL.pixelStorei(mGL.UNPACK_FLIP_Y_WEBGL, false);
			mGL.bindTexture(mGL.TEXTURE_2D, null);
		} else if (type === this.TEXTYPE.T3D) {
			return null;
		} else  {
			mGL.bindTexture(mGL.TEXTURE_CUBE_MAP, id);
			mGL.pixelStorei(mGL.UNPACK_FLIP_Y_WEBGL, flipY);
			mGL.activeTexture(mGL.TEXTURE0);
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_POSITIVE_X, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, image[0]);
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, image[1]);
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, (flipY ? image[3] : image[2]));
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, (flipY ? image[2] : image[3]));
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, image[4]);
			mGL.texImage2D(mGL.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, image[5]);

			if (filter === this.FILTER.NONE) {
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST);
			} else if (filter === this.FILTER.LINEAR) {
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR);
			} else if (filter === this.FILTER.MIPMAP) {
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR_MIPMAP_LINEAR);
				mGL.generateMipmap(mGL.TEXTURE_CUBE_MAP);
			}
			mGL.pixelStorei(mGL.UNPACK_FLIP_Y_WEBGL, false);
			mGL.bindTexture(mGL.TEXTURE_CUBE_MAP, null);
		}
		return {
			mObjectID: id,
			mXres: image.width,
			mYres: image.height,
			mFormat: format,
			mType: type,
			mFilter: filter,
			mWrap: wrap,
			mVFlip: flipY
		};
	}

	SetSamplerFilter(te, filter, doGenerateMipsIfNeeded) {
		let mGL = this.mGL;

		if (te.mFilter === filter) return;
		if (te.mType === this.TEXTYPE.T2D) {
			mGL.bindTexture(mGL.TEXTURE_2D, te.mObjectID);

			if (filter === this.FILTER.NONE) {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST);
			} else if (filter === this.FILTER.LINEAR) {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR);
			} else if (filter === this.FILTER.MIPMAP) {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR_MIPMAP_LINEAR);
				if (doGenerateMipsIfNeeded) mGL.generateMipmap(mGL.TEXTURE_2D);
			} else {
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
				mGL.texParameteri(mGL.TEXTURE_2D, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST_MIPMAP_LINEAR);
				if (doGenerateMipsIfNeeded) mGL.generateMipmap(mGL.TEXTURE_2D);
			}
			mGL.bindTexture(mGL.TEXTURE_2D, null);
		} else if (te.mType === this.TEXTYPE.T3D) {
			mGL.bindTexture(mGL.TEXTURE_3D, te.mObjectID);

			if (filter === this.FILTER.NONE) {
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST);
			} else if (filter === this.FILTER.LINEAR) {
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR);
			} else if (filter === this.FILTER.MIPMAP) {
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR_MIPMAP_LINEAR);
				if (doGenerateMipsIfNeeded) mGL.generateMipmap(mGL.TEXTURE_3D);
			} else {
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
				mGL.texParameteri(mGL.TEXTURE_3D, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST_MIPMAP_LINEAR);
				if (doGenerateMipsIfNeeded) mGL.generateMipmap(mGL.TEXTURE_3D);
			}
			mGL.bindTexture(mGL.TEXTURE_3D, null);
		} else {
			mGL.bindTexture(mGL.TEXTURE_CUBE_MAP, te.mObjectID);

			if (filter === this.FILTER.NONE) {
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST);
			} else if (filter === this.FILTER.LINEAR) {
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR);
			} else if (filter === this.FILTER.MIPMAP) {
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MAG_FILTER, mGL.LINEAR);
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MIN_FILTER, mGL.LINEAR_MIPMAP_LINEAR);
				if (doGenerateMipsIfNeeded) mGL.generateMipmap(mGL.TEXTURE_CUBE_MAP);
			} else {
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MAG_FILTER, mGL.NEAREST);
				mGL.texParameteri(mGL.TEXTURE_CUBE_MAP, mGL.TEXTURE_MIN_FILTER, mGL.NEAREST_MIPMAP_LINEAR);
				if (doGenerateMipsIfNeeded) mGL.generateMipmap(mGL.TEXTURE_CUBE_MAP);
			}
			mGL.bindTexture(mGL.TEXTURE_CUBE_MAP, null);
		}
		te.mFilter = filter;
	}

	SetSamplerWrap(te, wrap) {
		if (te.mWrap === wrap) return;

		let glWrap = this.mGL.REPEAT;

		if (wrap === this.TEXWRP.CLAMP) glWrap = this.mGL.CLAMP_TO_EDGE;

		if (te.mType === this.TEXTYPE.T2D) {
			this.mGL.bindTexture(this.mGL.TEXTURE_2D, te.mObjectID);
			this.mGL.texParameteri(this.mGL.TEXTURE_2D, this.mGL.TEXTURE_WRAP_S, glWrap);
			this.mGL.texParameteri(this.mGL.TEXTURE_2D, this.mGL.TEXTURE_WRAP_T, glWrap);
			this.mGL.bindTexture(this.mGL.TEXTURE_2D, null);
		} else if (te.mType === this.TEXTYPE.T3D) {
			this.mGL.bindTexture(this.mGL.TEXTURE_3D, te.mObjectID);
			this.mGL.texParameteri(this.mGL.TEXTURE_3D, this.mGL.TEXTURE_WRAP_R, glWrap);
			this.mGL.texParameteri(this.mGL.TEXTURE_3D, this.mGL.TEXTURE_WRAP_S, glWrap);
			this.mGL.texParameteri(this.mGL.TEXTURE_3D, this.mGL.TEXTURE_WRAP_T, glWrap);
			this.mGL.bindTexture(this.mGL.TEXTURE_3D, null);
		}
		te.mWrap = wrap;
	}

	SetSamplerVFlip(te, vflip, image) {
		if (te.mVFlip === vflip) return;
		if (te.mType === this.TEXTYPE.T2D) {
			if (image != null) {
				this.mGL.activeTexture(this.mGL.TEXTURE0);
				this.mGL.bindTexture(this.mGL.TEXTURE_2D, te.mObjectID);
				this.mGL.pixelStorei(this.mGL.UNPACK_FLIP_Y_WEBGL, vflip);
				let glFoTy = this.iFormatPI2GL(te.mFormat);
				this.mGL.texImage2D(this.mGL.TEXTURE_2D, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, image);
				this.mGL.bindTexture(this.mGL.TEXTURE_2D, null);
				this.mGL.pixelStorei(this.mGL.UNPACK_FLIP_Y_WEBGL, false);
			}
		} else if (te.mType === this.TEXTYPE.CUBEMAP) {
			if (image != null) {
				let glFoTy = this.iFormatPI2GL(te.mFormat);
				this.mGL.activeTexture(this.mGL.TEXTURE0);
				this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, te.mObjectID);
				this.mGL.pixelStorei(this.mGL.UNPACK_FLIP_Y_WEBGL, vflip);
				this.mGL.texImage2D(this.mGL.TEXTURE_CUBE_MAP_POSITIVE_X, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, image[0]);
				this.mGL.texImage2D(this.mGL.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, image[1]);
				this.mGL.texImage2D(this.mGL.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, (vflip ? image[3] : image[2]));
				this.mGL.texImage2D(this.mGL.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, (vflip ? image[2] : image[3]));
				this.mGL.texImage2D(this.mGL.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, image[4]);
				this.mGL.texImage2D(this.mGL.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, image[5]);
				this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, null);
				this.mGL.pixelStorei(this.mGL.UNPACK_FLIP_Y_WEBGL, false);
			}
		}
		te.mVFlip = vflip;
	}

	CreateMipmaps(te) {
		if (te.mType === this.TEXTYPE.T2D) {
			this.mGL.activeTexture(this.mGL.TEXTURE0);
			this.mGL.bindTexture(this.mGL.TEXTURE_2D, te.mObjectID);
			this.mGL.generateMipmap(this.mGL.TEXTURE_2D);
			this.mGL.bindTexture(this.mGL.TEXTURE_2D, null);
		} else if (te.mType===this.TEXTYPE.CUBEMAP) {
			this.mGL.activeTexture(this.mGL.TEXTURE0);
			this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, te.mObjectID);
			this.mGL.generateMipmap(this.mGL.TEXTURE_CUBE_MAP);
			this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, null);
		}
	}

	UpdateTexture(tex, x0, y0, xres, yres, buffer) {
		let glFoTy = this.iFormatPI2GL(tex.mFormat);
		if (tex.mType === this.TEXTYPE.T2D) {
			this.mGL.activeTexture(this.mGL.TEXTURE0);
			this.mGL.bindTexture(this.mGL.TEXTURE_2D, tex.mObjectID);
			this.mGL.pixelStorei(this.mGL.UNPACK_FLIP_Y_WEBGL, tex.mVFlip);
			this.mGL.texSubImage2D(this.mGL.TEXTURE_2D, 0, x0, y0, xres, yres, glFoTy.mGLExternal, glFoTy.mGLType, buffer);
			this.mGL.bindTexture(this.mGL.TEXTURE_2D, null);
			this.mGL.pixelStorei(this.mGL.UNPACK_FLIP_Y_WEBGL, false);
		}
	}

	UpdateTextureFromImage(tex, image) {
		let glFoTy = this.iFormatPI2GL(tex.mFormat);
		if (tex.mType === this.TEXTYPE.T2D) {
			this.mGL.activeTexture(this.mGL.TEXTURE0);
			this.mGL.bindTexture(this.mGL.TEXTURE_2D, tex.mObjectID);
			this.mGL.pixelStorei(this.mGL.UNPACK_FLIP_Y_WEBGL, tex.mVFlip);
			this.mGL.texImage2D(this.mGL.TEXTURE_2D, 0, glFoTy.mGLFormat, glFoTy.mGLExternal, glFoTy.mGLType, image);
			this.mGL.bindTexture(this.mGL.TEXTURE_2D, null);
			this.mGL.pixelStorei(this.mGL.UNPACK_FLIP_Y_WEBGL, false);
		}
	}

	DestroyTexture(te) {
		this.mGL.deleteTexture(te.mObjectID);
	}

	AttachTextures(num, t0, t1, t2, t3) {
		if (num > 0 && t0 != null) {
			this.mGL.activeTexture(this.mGL.TEXTURE0);
			if (t0.mType === this.TEXTYPE.T2D) this.mGL.bindTexture(this.mGL.TEXTURE_2D, t0.mObjectID);
			else if (t0.mType === this.TEXTYPE.T3D) this.mGL.bindTexture(this.mGL.TEXTURE_3D, t0.mObjectID);
			else if (t0.mType === this.TEXTYPE.CUBEMAP) this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, t0.mObjectID);
		}
		if (num > 1 && t1 != null) {
			this.mGL.activeTexture(this.mGL.TEXTURE1);
			if (t1.mType === this.TEXTYPE.T2D) this.mGL.bindTexture(this.mGL.TEXTURE_2D, t1.mObjectID);
			else if (t1.mType === this.TEXTYPE.T3D) this.mGL.bindTexture(this.mGL.TEXTURE_3D, t1.mObjectID);
			else if (t1.mType === this.TEXTYPE.CUBEMAP) this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, t1.mObjectID);
		}
		if (num > 2 && t2 != null) {
			this.mGL.activeTexture(this.mGL.TEXTURE2);
			if (t2.mType === this.TEXTYPE.T2D) this.mGL.bindTexture(this.mGL.TEXTURE_2D, t2.mObjectID);
			else if (t2.mType === this.TEXTYPE.T3D) this.mGL.bindTexture(this.mGL.TEXTURE_3D, t2.mObjectID);
			else if (t2.mType === this.TEXTYPE.CUBEMAP) this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, t2.mObjectID);
		}
		if (num > 3 && t3 != null) {
			this.mGL.activeTexture(this.mGL.TEXTURE3);
			if (t3.mType === this.TEXTYPE.T2D) this.mGL.bindTexture(this.mGL.TEXTURE_2D, t3.mObjectID);
			else if (t3.mType === this.TEXTYPE.T3D) this.mGL.bindTexture(this.mGL.TEXTURE_3D, t3.mObjectID);
			else if (t3.mType === this.TEXTYPE.CUBEMAP) this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, t3.mObjectID);
		}
	}

	DettachTextures() {
		this.mGL.activeTexture(this.mGL.TEXTURE0);
		this.mGL.bindTexture(this.mGL.TEXTURE_2D, null);
		this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, null);

		this.mGL.activeTexture(this.mGL.TEXTURE1);
		this.mGL.bindTexture(this.mGL.TEXTURE_2D, null);
		this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, null);

		this.mGL.activeTexture(this.mGL.TEXTURE2);
		this.mGL.bindTexture(this.mGL.TEXTURE_2D, null);
		this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, null);

		this.mGL.activeTexture(this.mGL.TEXTURE3);
		this.mGL.bindTexture(this.mGL.TEXTURE_2D, null);
		this.mGL.bindTexture(this.mGL.TEXTURE_CUBE_MAP, null);
	}

	CreateRenderTarget(color0, color1, color2, color3, depth, wantZbuffer) {
		let id =  this.mGL.createFramebuffer();
		this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, id);

		if (depth === null) {
			if (wantZbuffer === true) {
				let zb = this.mGL.createRenderbuffer();
				this.mGL.bindRenderbuffer(this.mGL.RENDERBUFFER, zb);
				this.mGL.renderbufferStorage(this.mGL.RENDERBUFFER, this.mGL.DEPTH_COMPONENT16, color0.mXres, color0.mYres);
				this.mGL.framebufferRenderbuffer(this.mGL.FRAMEBUFFER, this.mGL.DEPTH_ATTACHMENT, this.mGL.RENDERBUFFER, zb);
			}
		} else {
			this.mGL.framebufferTexture2D(this.mGL.FRAMEBUFFER, this.mGL.DEPTH_ATTACHMENT, this.mGL.TEXTURE_2D, depth.mObjectID, 0);
		}
		if (color0 != null) {
			this.mGL.framebufferTexture2D(this.mGL.FRAMEBUFFER, this.mGL.COLOR_ATTACHMENT0, this.mGL.TEXTURE_2D, color0.mObjectID, 0);
		}
		if (this.mGL.checkFramebufferStatus(this.mGL.FRAMEBUFFER) != this.mGL.FRAMEBUFFER_COMPLETE) {
			return null;
		}
		this.mGL.bindRenderbuffer(this.mGL.RENDERBUFFER, null);
		this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, null);

		return {
			mObjectID: id,
			mTex0: color0
		};
	}

	DestroyRenderTarget(tex) {
		this.mGL.deleteFramebuffer(tex.mObjectID);
	}

	SetRenderTarget(tex) {
		if (tex === null) this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, null);
		else this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, tex.mObjectID);
	}

	CreateRenderTargetNew(wantColor0, wantZbuffer, xres, yres, samples) {
		let id =  this.mGL.createFramebuffer();
		this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, id);

		if (wantZbuffer === true) {
			let zb = this.mGL.createRenderbuffer();
			this.mGL.bindRenderbuffer(this.mGL.RENDERBUFFER, zb);
			if (samples == 1) this.mGL.renderbufferStorage(this.mGL.RENDERBUFFER, this.mGL.DEPTH_COMPONENT16, xres, yres);
			else this.mGL.renderbufferStorageMultisample(this.mGL.RENDERBUFFER, samples, this.mGL.DEPTH_COMPONENT16, xres, yres);
			this.mGL.framebufferRenderbuffer(this.mGL.FRAMEBUFFER, this.mGL.DEPTH_ATTACHMENT, this.mGL.RENDERBUFFER, zb);
		}
		if (wantColor0) {
			let cb = this.mGL.createRenderbuffer();
			this.mGL.bindRenderbuffer(this.mGL.RENDERBUFFER, cb);
			if (samples == 1) this.mGL.renderbufferStorage(this.mGL.RENDERBUFFER, this.mGL.RGBA8, xres, yres);
			else this.mGL.renderbufferStorageMultisample(this.mGL.RENDERBUFFER, samples, this.mGL.RGBA8, xres, yres);
			this.mGL.framebufferRenderbuffer(this.mGL.FRAMEBUFFER, this.mGL.COLOR_ATTACHMENT0, this.mGL.RENDERBUFFER, cb);
		}
		if (this.mGL.checkFramebufferStatus(this.mGL.FRAMEBUFFER) != this.mGL.FRAMEBUFFER_COMPLETE) {
			return null;
		}
		this.mGL.bindRenderbuffer(this.mGL.RENDERBUFFER, null);
		this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, null);

		return {
			mObjectID: id,
			mXres: xres,
			mYres:yres,
			mTex0: color0
		};
	}

	CreateRenderTargetCubeMap(color0, depth, wantZbuffer) {
		let id = this.mGL.createFramebuffer();
		this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, id);

		if (depth === null)  {
			if (wantZbuffer === true) {
				let zb = this.mGL.createRenderbuffer();
				this.mGL.bindRenderbuffer(this.mGL.RENDERBUFFER, zb);
				this.mGL.renderbufferStorage(this.mGL.RENDERBUFFER, this.mGL.DEPTH_COMPONENT16, color0.mXres, color0.mYres);
				this.mGL.framebufferRenderbuffer(this.mGL.FRAMEBUFFER, this.mGL.DEPTH_ATTACHMENT, this.mGL.RENDERBUFFER, zb);
			}
		} else {
			this.mGL.framebufferTexture2D(this.mGL.FRAMEBUFFER, this.mGL.DEPTH_ATTACHMENT, this.mGL.TEXTURE_2D, depth.mObjectID, 0);
		}
		if (color0 != null) this.mGL.framebufferTexture2D(this.mGL.FRAMEBUFFER, this.mGL.COLOR_ATTACHMENT0, this.mGL.TEXTURE_CUBE_MAP_POSITIVE_X, color0.mObjectID, 0);
		if (this.mGL.checkFramebufferStatus(this.mGL.FRAMEBUFFER) != this.mGL.FRAMEBUFFER_COMPLETE) return null;

		this.mGL.bindRenderbuffer(this.mGL.RENDERBUFFER, null);
		this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, null);

		return {
			mObjectID: id,
			mTex0: color0
		};
	}

	SetRenderTargetCubeMap(fbo, face) {
		if (fbo ===null) {
			this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, null);
		} else {
			this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, fbo.mObjectID);
			this.mGL.framebufferTexture2D(this.mGL.FRAMEBUFFER, this.mGL.COLOR_ATTACHMENT0, this.mGL.TEXTURE_CUBE_MAP_POSITIVE_X+face, fbo.mTex0.mObjectID, 0);
		}
	}

	BlitRenderTarget(dst, src) {
		this.mGL.bindFramebuffer(this.mGL.READ_FRAMEBUFFER, src.mObjectID);
		this.mGL.bindFramebuffer(this.mGL.DRAW_FRAMEBUFFER, dst.mObjectID);
		this.mGL.clearBufferfv(this.mGL.COLOR, 0, [0.0, 0.0, 0.0, 1.0]);
		this.mGL.blitFramebuffer(0, 0, src.mXres, src.mYres,
								 0, 0, src.mXres, src.mYres,
								 this.mGL.COLOR_BUFFER_BIT, this.mGL.LINEAR);
	}

	SetViewport(vp) {
		this.mGL.viewport(vp[0], vp[1], vp[2], vp[3]);
	}

	SetWriteMask(c0, c1, c2, c3, z) {
		this.mGL.depthMask(z);
		this.mGL.colorMask(c0, c0, c0, c0);
	}

	SetState(stateName, stateValue) {
		switch (stateName) {
			case this.RENDSTGATE.WIREFRAME:
				stateValue ? this.mGL.polygonMode(this.mGL.FRONT_AND_BACK, this.mGL.LINE)
							: this.mGL.polygonMode(this.mGL.FRONT_AND_BACK, this.mGL.FILL);
				break;
			case this.RENDSTGATE.FRONT_FACE:
				stateValue ? this.mGL.cullFace(this.mGL.BACK)
							: this.mGL.cullFace(this.mGL.FRONT);
				break;
			case this.RENDSTGATE.CULL_FACE:
				stateValue ? this.mGL.enable(this.mGL.CULL_FACE)
							: this.mGL.disable(this.mGL.CULL_FACE);
				break;
			case this.RENDSTGATE.DEPTH_TEST:
				stateValue ? this.mGL.enable(this.mGL.DEPTH_TEST)
							: this.mGL.disable(this.mGL.DEPTH_TEST);
				break;
			case this.RENDSTGATE.ALPHA_TO_COVERAGE:
				stateValue ? this.mGL.enable(this.mGL.SAMPLE_ALPHA_TO_COVERAGE)
							: this.mGL.disable(this.mGL.SAMPLE_ALPHA_TO_COVERAGE);
				break;
		}
	}

	SetMultisample(v) {
		if (v === true) {
			this.mGL.enable(this.mGL.SAMPLE_COVERAGE);
			this.mGL.sampleCoverage(1.0, false);
		} else {
			this.mGL.disable(this.mGL.SAMPLE_COVERAGE);
		}
	}

	GetTranslatedShaderSource(shader) {
		if (this.mGL === null) return null;
		if (this.mDebugShader === null) return null;
		let vfs = this.mGL.getAttachedShaders(shader.mProgram),
			str = this.mDebugShader.getTranslatedShaderSource(vfs[1]),
			parts = str.split("GLSL END");
		str = (parts.length < 2) ? str : parts[1];
		return str;
	}

	CreateShader(vsSource, fsSource, preventCache, forceSynch, onResolve) {
		if (this.mGL === null) return;

		let vs = this.mGL.createShader(this.mGL.VERTEX_SHADER),
			fs = this.mGL.createShader(this.mGL.FRAGMENT_SHADER);
		vsSource = this.mShaderHeader[0] + vsSource;
		fsSource = this.mShaderHeader[1] + fsSource;

		if (preventCache) {
			let vran = Math.random().toString(36).substring(7);
			let fran = Math.random().toString(36).substring(7);
			vsSource += "\n#define K" + vran + "\n";
			fsSource += "\n#define K" + fran + "\n";
		}

		let timeStart = Shader.getRealTime();
		this.mGL.shaderSource(vs, vsSource);
		this.mGL.shaderSource(fs, fsSource);
		this.mGL.compileShader(vs);
		this.mGL.compileShader(fs);

		let pr = this.mGL.createProgram();
		this.mGL.attachShader(pr, vs);
		this.mGL.attachShader(pr, fs);
		this.mGL.linkProgram(pr);

		//-------------
		let checkErrors = () => {
			if (!this.mGL.getProgramParameter(pr, this.mGL.LINK_STATUS)) {
				// vs error
				if (!this.mGL.getShaderParameter(vs, this.mGL.COMPILE_STATUS)) {
					let vsLog = this.mGL.getShaderInfoLog(vs);
					onResolve(false, { mErrorType: 0, mErrorStr: vsLog });
					this.mGL.deleteProgram(pr);
				} else if (!this.mGL.getShaderParameter(fs, this.mGL.COMPILE_STATUS)) {
					// fs error
					let fsLog = this.mGL.getShaderInfoLog(fs);
					onResolve(false, { mErrorType: 1, mErrorStr: fsLog });
					this.mGL.deleteProgram(pr);
				} else {
					// link error
					let infoLog = this.mGL.getProgramInfoLog(pr);
					onResolve(false, { mErrorType: 2, mErrorStr: infoLog });
					this.mGL.deleteProgram(pr);
				}
			} else {
				// no errors
				let compilationTime = Shader.getRealTime() - timeStart;
				onResolve(true, { mProgram: pr, mTime: compilationTime });
			}
		};

		// check compilation
		if (this.mAsynchCompile === null || forceSynch === true) {
			checkErrors();
		} else {
			let loopCheckCompletion = () => {
				if (this.mGL.getProgramParameter(pr, this.mAsynchCompile.COMPLETION_STATUS_KHR) === true) checkErrors();
				else setTimeout(loopCheckCompletion, 10);
			};
			setTimeout(loopCheckCompletion, 10);
		}
	}

	AttachShader(shader) {
		if (shader === null) {
			this.mBindedShader = null;
			this.mGL.useProgram(null);
		} else {
			this.mBindedShader = shader;
			this.mGL.useProgram(shader.mProgram);
		}
	}

	DetachShader() {
		this.mGL.useProgram(null);
	}

	DestroyShader(tex) {
		this.mGL.deleteProgram(tex.mProgram);
	}

	GetAttribLocation(shader, name) {
		return this.mGL.getAttribLocation(shader.mProgram, name);
	}

	SetShaderConstantLocation(shader, name) {
		return this.mGL.getUniformLocation(shader.mProgram, name);
	}

	SetShaderConstantMat4F(uname, params, istranspose) {
		let program = this.mBindedShader,
			pos = this.mGL.getUniformLocation(program.mProgram, uname);
		if (pos === null) return false;
		if (istranspose === false) {
			let tmp = new Float32Array([params[0], params[4], params[ 8], params[12],
										params[1], params[5], params[ 9], params[13],
										params[2], params[6], params[10], params[14],
										params[3], params[7], params[11], params[15]]);
			this.mGL.uniformMatrix4fv(pos, false, tmp);
		} else {
			this.mGL.uniformMatrix4fv(pos, false, new Float32Array(params));
		}
		return true;
	}

	SetShaderConstant1F_Pos(pos, x) {
		this.mGL.uniform1f(pos, x);
		return true;
	}

	SetShaderConstant1FV_Pos(pos, x) {
		this.mGL.uniform1fv(pos, x);
		return true;
	}

	SetShaderConstant1F(uname, x) {
		let pos = this.mGL.getUniformLocation(this.mBindedShader.mProgram, uname);
		if (pos === null) return false;
		this.mGL.uniform1f(pos, x);
		return true;
	}

	SetShaderConstant1I(uname, x) {
		let pos = this.mGL.getUniformLocation(this.mBindedShader.mProgram, uname);
		if (pos === null) return false;
		this.mGL.uniform1i(pos, x);
		return true;
	}
	SetShaderConstant1I_Pos(pos, x) {
		this.mGL.uniform1i(pos, x);
		return true;
	}

	SetShaderConstant2F(uname, x) {
		let pos = this.mGL.getUniformLocation(this.mBindedShader.mProgram, uname);
		if (pos === null) return false;
		this.mGL.uniform2fv(pos, x);
		return true;
	}

	SetShaderConstant3F(uname, x, y, z) {
		let pos = this.mGL.getUniformLocation(this.mBindedShader.mProgram, uname);
		if (pos === null) return false;
		this.mGL.uniform3f(pos, x, y, z);
		return true;
	}

	SetShaderConstant1FV(uname, x) {
		let pos = this.mGL.getUniformLocation(this.mBindedShader.mProgram, uname);
		if (pos === null) return false;
		this.mGL.uniform1fv(pos, new Float32Array(x));
		return true;
	}

	SetShaderConstant3FV(uname, x)  {
		let pos = this.mGL.getUniformLocation(this.mBindedShader.mProgram, uname);
		if (pos === null) return false;
		this.mGL.uniform3fv(pos, new Float32Array(x));
		return true;
	}

	SetShaderConstant4FV(uname, x)  {
		let pos = this.mGL.getUniformLocation(this.mBindedShader.mProgram, uname);
		if (pos === null) return false;
		this.mGL.uniform4fv(pos, new Float32Array(x));
		return true;
	}

	SetShaderTextureUnit(uname, unit) {
		let program = this.mBindedShader,
			pos = this.mGL.getUniformLocation(program.mProgram, uname);
		if (pos === null) return false;
		this.mGL.uniform1i(pos, unit);
		return true;
	}

	CreateVertexArray(data, mode) {
		let id = this.mGL.createBuffer();
		this.mGL.bindBuffer(this.mGL.ARRAY_BUFFER, id);
		if (mode === this.BUFTYPE.STATIC) this.mGL.bufferData(this.mGL.ARRAY_BUFFER, data, this.mGL.STATIC_DRAW);
		else this.mGL.bufferData(this.mGL.ARRAY_BUFFER, data, this.mGL.DYNAMIC_DRAW);
		return { mObject: id };
	}

	CreateIndexArray(data, mode) {
		let id = this.mGL.createBuffer();
		this.mGL.bindBuffer(this.mGL.ELEMENT_ARRAY_BUFFER, id);
		if (mode === this.BUFTYPE.STATIC) this.mGL.bufferData(this.mGL.ELEMENT_ARRAY_BUFFER, data, this.mGL.STATIC_DRAW);
		else this.mGL.bufferData(this.mGL.ELEMENT_ARRAY_BUFFER, data, this.mGL.DYNAMIC_DRAW);
		return { mObject: id };
	}

	DestroyArray(tex) {
		this.mGL.destroyBuffer(tex.mObject);
	}

	AttachVertexArray(tex, attribs, pos) {
		this.mGL.bindBuffer(this.mGL.ARRAY_BUFFER, tex.mObject);

		let shader = this.mBindedShader,
			num = attribs.mChannels.length,
			stride = attribs.mStride,
			offset = 0,
			i = 0;
		for (; i<num; i++) {
			let id = pos[i];
			let dtype = this.mGL.FLOAT;
			let dsize = 4;
			this.mGL.enableVertexAttribArray(id);

			if (attribs.mChannels[i].mType === this.TYPE.UINT8) {
				dtype = this.mGL.UNSIGNED_BYTE;
				dsize = 1;
			} else if (attribs.mChannels[i].mType === this.TYPE.UINT16) {
				dtype = this.mGL.UNSIGNED_SHORT;
				dsize = 2;
			} else if (attribs.mChannels[i].mType === this.TYPE.FLOAT32) {
				dtype = this.mGL.FLOAT;
				dsize = 4;
			}
			this.mGL.vertexAttribPointer(id, attribs.mChannels[i].mNumComponents, dtype, attribs.mChannels[i].mNormalize, stride, offset);
			offset += attribs.mChannels[i].mNumComponents * dsize;
		}
	}

	AttachIndexArray(tex) {
		this.mGL.bindBuffer(this.mGL.ELEMENT_ARRAY_BUFFER, tex.mObject);
	}

	DetachVertexArray (tex, attribs) {
		let num = attribs.mChannels.length,
			i = 0;
		for (; i<num; i++) {
			this.mGL.disableVertexAttribArray(i);
		}
		this.mGL.bindBuffer(this.mGL.ARRAY_BUFFER, null);
	}

	DetachIndexArray(tex) {
		this.mGL.bindBuffer(this.mGL.ELEMENT_ARRAY_BUFFER, null);
	}

	DrawPrimitive(typeOfPrimitive, num, useIndexArray, numInstances) {
		let glType = this.mGL.POINTS;
		if (typeOfPrimitive === this.PRIMTYPE.POINTS) glType = this.mGL.POINTS;
		if (typeOfPrimitive === this.PRIMTYPE.LINES) glType = this.mGL.LINES;
		if (typeOfPrimitive === this.PRIMTYPE.LINE_LOOP) glType = this.mGL.LINE_LOOP;
		if (typeOfPrimitive === this.PRIMTYPE.LINE_STRIP) glType = this.mGL.LINE_STRIP;
		if (typeOfPrimitive === this.PRIMTYPE.TRIANGLES) glType = this.mGL.TRIANGLES;
		if (typeOfPrimitive === this.PRIMTYPE.TRIANGLE_STRIP) glType = this.mGL.TRIANGLE_STRIP;

		if (numInstances <= 1) {
			if(useIndexArray) this.mGL.drawElements(glType, num, this.mGL.UNSIGNED_SHORT, 0);
			else this.mGL.drawArrays(glType, 0, num);
		} else {
			this.mGL.drawArraysInstanced(glType, 0, num, numInstances);
			this.mGL.drawElementsInstanced(glType, num, this.mGL.UNSIGNED_SHORT, 0, numInstances);
		}
	}

	DrawFullScreenTriangle_XY(vpos) {
		this.mGL.bindBuffer(this.mGL.ARRAY_BUFFER, this.mVBO_Tri);
		this.mGL.vertexAttribPointer(vpos, 2, this.mGL.FLOAT, false, 0, 0);
		this.mGL.enableVertexAttribArray(vpos);
		this.mGL.drawArrays(this.mGL.TRIANGLES, 0, 3);
		this.mGL.disableVertexAttribArray(vpos);
		this.mGL.bindBuffer(this.mGL.ARRAY_BUFFER, null);
	}

	DrawUnitQuad_XY(vpos) {
		this.mGL.bindBuffer(this.mGL.ARRAY_BUFFER, this.mVBO_Quad);
		this.mGL.vertexAttribPointer(vpos, 2, this.mGL.FLOAT, false, 0, 0);
		this.mGL.enableVertexAttribArray(vpos);
		this.mGL.drawArrays(this.mGL.TRIANGLES, 0, 6);
		this.mGL.disableVertexAttribArray(vpos);
		this.mGL.bindBuffer(this.mGL.ARRAY_BUFFER, null);
	}

	DrawUnitCube_XYZ_NOR(vpos) {
		this.mGL.bindBuffer(this.mGL.ARRAY_BUFFER, this.mVBO_CubePosNor);
		this.mGL.vertexAttribPointer(vpos[0], 3, this.mGL.FLOAT, false, 0, 0);
		this.mGL.vertexAttribPointer(vpos[1], 3, this.mGL.FLOAT, false, 0, 0);
		this.mGL.enableVertexAttribArray(vpos[0]);
		this.mGL.enableVertexAttribArray(vpos[1]);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 0, 4);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 4, 4);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 8, 4);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 12, 4);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 16, 4);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 20, 4);
		this.mGL.disableVertexAttribArray(vpos[0]);
		this.mGL.disableVertexAttribArray(vpos[1]);
		this.mGL.bindBuffer(this.mGL.ARRAY_BUFFER, null);
	}

	DrawUnitCube_XYZ(vpos) {
		this.mGL.bindBuffer(this.mGL.ARRAY_BUFFER, this.mVBO_CubePos);
		this.mGL.vertexAttribPointer(vpos, 3, this.mGL.FLOAT, false, 0, 0);
		this.mGL.enableVertexAttribArray(vpos);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 0, 4);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 4, 4);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 8, 4);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 12, 4);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 16, 4);
		this.mGL.drawArrays(this.mGL.TRIANGLE_STRIP, 20, 4);
		this.mGL.disableVertexAttribArray(vpos);
		this.mGL.bindBuffer(this.mGL.ARRAY_BUFFER, null);
	}

	SetBlend(enabled) {
		if (enabled) {
			this.mGL.enable(this.mGL.BLEND);
			this.mGL.blendEquationSeparate(this.mGL.FUNC_ADD, this.mGL.FUNC_ADD);
			this.mGL.blendFuncSeparate(this.mGL.SRC_ALPHA, this.mGL.ONE_MINUS_SRC_ALPHA, this.mGL.ONE, this.mGL.ONE_MINUS_SRC_ALPHA);
		} else {
			this.mGL.disable(this.mGL.BLEND);
		}
	}

	GetPixelData(data, offset, xres, yres) {
		this.mGL.readPixels(0, 0, xres, yres, this.mGL.RGBA, this.mGL.UNSIGNED_BYTE, data, offset);
	}

	GetPixelDataRenderTarget(obj, data, xres, yres) {
		this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, obj.mObjectID);
		this.mGL.readBuffer(this.mGL.COLOR_ATTACHMENT0);
		this.mGL.readPixels(0, 0, xres, yres, this.mGL.RGBA, this.mGL.FLOAT, data, 0);
		this.mGL.bindFramebuffer(this.mGL.FRAMEBUFFER, null);
	}
}
