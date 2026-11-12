// Backups are plain JSON files. Audio files (Blob/File) can't be stored in JSON
// directly, so they are embedded as base64 data URLs and rebuilt on restore.

const AUDIO_MARKER = 'audio-data-url';

const blobToDataUrl = (blob) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });

const dataUrlToBlob = (dataUrl, type) => {
    const [header, base64] = dataUrl.split(',');
    const mime = type || header.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
};

export const serializeSongs = async (songs) =>
    Promise.all(
        songs.map(async (song) => {
            if (!(song.audio instanceof Blob)) {
                const { audio, ...rest } = song;
                return rest;
            }
            return {
                ...song,
                audio: {
                    __type: AUDIO_MARKER,
                    name: song.audio.name || 'audio',
                    type: song.audio.type,
                    data: await blobToDataUrl(song.audio),
                },
            };
        })
    );

export const deserializeSong = (song) => {
    const audio = song.audio;
    if (audio && audio.__type === AUDIO_MARKER && typeof audio.data === 'string') {
        const blob = dataUrlToBlob(audio.data, audio.type);
        return { ...song, audio: new File([blob], audio.name, { type: blob.type }) };
    }
    // Older backups stored audio as an empty object: drop it
    if (audio && !(audio instanceof Blob)) {
        const { audio: _ignored, ...rest } = song;
        return rest;
    }
    return song;
};
