import { useRef, useState } from 'react';
import { Plus, Music, Trash2, Search, Download, Upload, ShieldCheck, X, Maximize } from 'lucide-react';
import { Layout } from './Layout';
import { APP_CONFIG } from '../config';
import { serializeSongs } from '../lib/backup';

export const SongList = ({ songs, onSelect, onImport, onDelete, onImportBackup }) => {
    const fileInputRef = useRef(null);
    const backupInputRef = useRef(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                await onImport(file);
            } catch (error) {
                if (error.message === 'DEMO_LIMIT_REACHED') {
                    alert(`⚠️ Versión DEMO\n\nSolo puedes agregar hasta ${APP_CONFIG.DEMO_LIMIT} canciones.\n\nPara desbloquear la versión ilimitada, contacta a:\nEduardo Cabello (ecabellou@gmail.com)`);
                } else {
                    console.error('Import error:', error);
                    alert('Error al importar la canción.');
                }
            }
            e.target.value = ''; // Reset input
        }
    };

    const [exporting, setExporting] = useState(false);

    const handleExportBackup = async () => {
        if (exporting) return;
        setExporting(true);
        try {
            // Includes lyrics, scroll recordings and the attached audio
            const dataStr = JSON.stringify(await serializeSongs(songs));
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `respaldo_lyrics_sync_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch (err) {
            console.error('Backup error:', err);
            alert('Error al crear la copia de seguridad');
        } finally {
            setExporting(false);
        }
    };

    const handleImportBackup = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    await onImportBackup(event.target.result);
                    alert('Copia de seguridad restaurada con éxito');
                } catch (err) {
                    alert('Error al restaurar el archivo');
                }
            };
            reader.readAsText(file);
        }
    };

    const filteredSongs = songs.filter(song =>
        song.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Layout className="p-6 overflow-y-auto">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12">
                <div className="flex items-center gap-4">
                    <img
                        src="/play-and-lyrics-logo.png"
                        alt="Logo"
                        className="w-20 h-20 sm:w-32 sm:h-32 object-contain"
                    />
                    <div>
                        <h1 className="text-2xl sm:text-4xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
                            Play & Lyrics
                        </h1>
                        <p className="font-sans font-medium tracking-wide bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60 text-[10px] sm:text-xs mt-1">
                            Desarrollado por Eduardo Cabello - ecabellou@gmail.com
                        </p>
                        {APP_CONFIG.IS_DEMO && (
                            <div className="mt-2 inline-block px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/50 text-red-300 text-[10px] font-bold tracking-wider uppercase shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                                Versión Demo ({songs.length}/{APP_CONFIG.DEMO_LIMIT})
                            </div>
                        )}
                    </div>
                </div>

                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="glass-button flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-primary/20 border-none"
                >
                    <Plus size={20} />
                    <span>Importar Canción</span>
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".txt,.docx"
                    onChange={handleFileChange}
                />
            </header>

            {/* Search - FIXED OVERLAP */}
            <div className="relative mb-8 group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors z-10">
                    <Search size={20} />
                </div>
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar canciones..."
                    className="glass-input w-full pl-14 pr-12 py-4 bg-zinc-900/50 border-white/5 focus:border-primary/50 text-lg transition-all"
                />
                {searchTerm && (
                    <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors z-10"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-20">
                {filteredSongs.map((song) => (
                    <div
                        key={song.id}
                        onClick={() => onSelect(song)}
                        className="glass-panel p-6 cursor-pointer hover:bg-white/10 transition-colors group relative border border-white/5"
                    >
                        <div className="flex items-start justify-between pr-12">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <Music size={24} />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-lg line-clamp-1">{song.title}</h3>
                                    <p className="text-xs text-white/40">
                                        {new Date(song.updatedAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`¿Eliminar "${song.title}"?\n\nSe borrarán la letra, el audio y la grabación del movimiento. No se puede deshacer.`)) onDelete(song.id);
                            }}
                            className="absolute top-1/2 -translate-y-1/2 right-3 p-3 text-white/40 hover:text-red-400 active:text-red-400 hover:bg-white/5 rounded-full transition-all"
                            title="Eliminar canción"
                            aria-label={`Eliminar ${song.title}`}
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>
                ))}

                {filteredSongs.length === 0 && (
                    <div className="col-span-full py-20 text-center text-white/20 border-2 border-dashed border-white/5 rounded-3xl">
                        <Music className="mx-auto mb-4 opacity-10" size={48} />
                        <p>{searchTerm ? 'No se encontraron canciones con ese nombre.' : 'No hay canciones. Importa un archivo para empezar.'}</p>
                    </div>
                )}
            </div>


            {/* Fullscreen Toggle for List View */}
            <button
                onClick={() => {
                    if (!document.fullscreenElement) {
                        document.documentElement.requestFullscreen().catch(e => console.error(e));
                    } else {
                        document.exitFullscreen();
                    }
                }}
                className="fixed bottom-6 left-6 p-3 bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-full text-white/40 hover:text-white hover:bg-zinc-800 transition-all z-50 shadow-xl"
                title="Pantalla Completa"
            >
                <Maximize size={20} />
            </button>

            {/* Backup Section */}
            <footer className="mt-auto pt-10 border-t border-white/5 flex flex-col items-center gap-6 pb-20">
                <div className="flex items-center gap-2 text-white/30 text-xs font-bold uppercase tracking-widest">
                    <ShieldCheck size={16} />
                    Centro de Seguridad de Datos
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                    <button
                        onClick={handleExportBackup}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-white/5 text-white/60 hover:text-white hover:bg-zinc-800 transition-all text-sm"
                    >
                        <Download size={18} />
                        {exporting ? 'Preparando copia...' : 'Descargar Copia de Seguridad'}
                    </button>
                    <button
                        onClick={() => backupInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-900 border border-white/5 text-white/60 hover:text-white hover:bg-zinc-800 transition-all text-sm"
                    >
                        <Upload size={18} />
                        Restaurar Copia
                    </button>
                    <input
                        type="file"
                        ref={backupInputRef}
                        className="hidden"
                        accept=".json"
                        onChange={handleImportBackup}
                    />
                </div>
                <p className="text-white/20 text-[10px] text-center max-w-xs leading-relaxed">
                    Tus canciones y movimientos se guardan en este dispositivo. Usa la copia de seguridad para pasar tus datos a otra tablet o PC.
                </p>
            </footer>
        </Layout >
    );
};
