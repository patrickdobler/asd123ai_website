// Encode mono Float32 PCM samples to an MP3 Blob, entirely in the browser.
//
// Uses a self-hosted lamejs build (vendor/lamejs.min.js) so MP3 export works
// offline and without sending any audio off the device.

let lamejsPromise = null;

function loadLamejs() {
    if (!lamejsPromise) {
        lamejsPromise = import('../vendor/lamejs.min.js').catch(error => {
            lamejsPromise = null;
            throw error;
        });
    }
    return lamejsPromise;
}

/**
 * Encode Float32 PCM (range -1..1) to an MP3 Blob.
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {number} [kbps=192]
 * @returns {Promise<Blob>}
 */
async function encodeMp3(samples, sampleRate, kbps = 192) {
    if (!(samples instanceof Float32Array) || !samples.length) {
        throw new Error('No audio samples available to encode.');
    }

    const lamejs = await loadLamejs();
    const Mp3Encoder = lamejs.Mp3Encoder || (lamejs.default && lamejs.default.Mp3Encoder);
    if (!Mp3Encoder) {
        throw new Error('MP3 encoder failed to load.');
    }

    const encoder = new Mp3Encoder(1, sampleRate, kbps);

    // Convert Float32 [-1, 1] to signed 16-bit PCM.
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }

    const chunks = [];
    const blockSize = 1152;
    for (let i = 0; i < pcm.length; i += blockSize) {
        const block = pcm.subarray(i, i + blockSize);
        const encoded = encoder.encodeBuffer(block);
        if (encoded.length) chunks.push(new Uint8Array(encoded));
    }
    const flushed = encoder.flush();
    if (flushed.length) chunks.push(new Uint8Array(flushed));

    return new Blob(chunks, { type: 'audio/mpeg' });
}

export { encodeMp3 };
