import { useState, useEffect } from 'react';
import { APP_CONFIG } from '../config';
import { songService } from '../lib/db';
import { parserService } from '../lib/parser';
import { deserializeSong } from '../lib/backup';

export const useSongs = () => {
    const [songs, setSongs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadSongs();
    }, []);

    const loadSongs = async () => {
        try {
            setLoading(true);
            const data = await songService.getAll();
            setSongs(data.sort((a, b) => b.updatedAt - a.updatedAt));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const importFile = async (file) => {
        if (APP_CONFIG.IS_DEMO && songs.length >= APP_CONFIG.DEMO_LIMIT) {
            throw new Error("DEMO_LIMIT_REACHED");
        }

        try {
            const { title, content, originalName } = await parserService.parseFile(file);
            const newSong = {
                id: crypto.randomUUID(),
                title,
                content,
                originalName,
                scrollData: [],
            };
            await songService.save(newSong);
            await loadSongs();
            return newSong;
        } catch (err) {
            console.error(err);
            throw err;
        }
    };

    const updateSong = async (song) => {
        await songService.save(song);
        await loadSongs();
    };

    const deleteSong = async (id) => {
        await songService.delete(id);
        await loadSongs();
    };

    const importBackup = async (backupData) => {
        try {
            const data = JSON.parse(backupData);
            if (!Array.isArray(data)) throw new Error("Formato inválido");

            for (const song of data) {
                await songService.save(deserializeSong(song));
            }
            await loadSongs();
        } catch (err) {
            console.error("Error importando backup:", err);
            throw err;
        }
    };

    return { songs, loading, importFile, updateSong, deleteSong, importBackup };
};
