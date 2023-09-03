
class File {
	constructor(binaryDataArrayBuffer) {
		this.mDataView = binaryDataArrayBuffer;
		this.mOffset = 0;
	}

	Seek(offset) {
		this.mOffset = offset;
	}

	ReadUInt8 () {
		var res = (new Uint8Array(this.mDataView, this.mOffset))[0];
		this.mOffset += 1;
		return res;
	}

	ReadUInt16() {
		var res = (new Uint16Array(this.mDataView, this.mOffset))[0];
		this.mOffset += 2;
		return res;
	}

	ReadUInt32() {
		var res = (new Uint32Array(this.mDataView, this.mOffset))[0];
		this.mOffset += 4;
		return res;
	}

	ReadUInt64() {
		return me.ReadUInt32() + (me.ReadUInt32()<<32);
	}

	ReadFloat32() {
		var res = (new Float32Array(this.mDataView, this.mOffset))[0];
		this.mOffset += 4;
		return res;
	}

	ReadFloat32Array(n) {
		var src = new Float32Array(this.mDataView, this.mOffset);
		var res = [];
		for(var i=0; i<n; i++) {
			res[i] = src[i];
		}
		this.mOffset += 4*n;
		return res;
	}

	ReadFloat32ArrayNative(n) {
		var src = new Float32Array(this.mDataView, this.mOffset);
		this.mOffset += 4*n;
		return src;
	}
}
