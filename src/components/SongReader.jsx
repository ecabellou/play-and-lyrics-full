import { useRef, useEffect, useState } from 'react';
import { ArrowLeft, Play, Pause, Circle, ZoomIn, ZoomOut, Edit3, Lock, Maximize, Minimize, Music } from 'lucide-react';
import { Layout } from './Layout';
import { useScrollEngine } from '../hooks/useScrollEngine';
import clsx from 'clsx';

export const SongReader = ({ song, onBack, onUpdate }) => {
    // Layout updated to full width
    const contentRef = useRef(null);
    const [localSong, setLocalSong] = useState(song);
    // Initialize fontSize from persistent storage if available, otherwise default (will be auto-calced)
    const [fontSize, setFontSize] = useState(song.fontSize || 32);
    const [isEditing, setIsEditing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const audioRef = useRef(null);
    const fileInputRef = useRef(null);

    const [recordingReady, setRecordingReady] = useState(false);

    const [audioUrl, setAudioUrl] = useState(null);

    const handleEngineUpdate = (updatedSong) => {
        setLocalSong(updatedSong);
        onUpdate(updatedSong);
    };

    const { status, toggleRecord, togglePlay, handleScroll, gestureStart, gestureMove, gestureEnd } = useScrollEngine(
        contentRef,
        localSong,
        handleEngineUpdate
    );

    useEffect(() => {
        // Restored backups can carry an empty object instead of a real audio file
        if (song.audio instanceof Blob) {
            const url = URL.createObjectURL(song.audio);
            setAudioUrl(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [song.audio]);

    const handleAudioUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const updated = { ...localSong, audio: file };
            setLocalSong(updated);
            onUpdate(updated);
        }
    };

    const handleSyncPlay = () => {
        if (status === 'PLAYING') {
            audioRef.current?.pause();
        } else {
            audioRef.current?.play();
        }
        togglePlay();
    };

    const handleSyncRecord = () => {
        if (status === 'RECORDING') {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
            setRecordingReady(false); // Exit recording mode on completion
        } else {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.error(e));
            }
        }
        toggleRecord();
    };

    const handleContentBlur = (e) => {
        const newContent = e.target.innerHTML;
        if (newContent !== localSong.content) {
            const updated = { ...localSong, content: newContent };
            setLocalSong(updated);
            onUpdate(updated);
        }
    };

    const adjustFontSize = (delta) => {
        const newSize = Math.max(12, Math.min(200, fontSize + delta));
        setFontSize(newSize);
        // Persist the new font size preference
        const updated = { ...localSong, fontSize: newSize };
        setLocalSong(updated);
        onUpdate(updated);
    };

    // Auto-calculate font size if not set manually
    useEffect(() => {
        if (song.fontSize) {
            setFontSize(song.fontSize);
            return;
        }

        const calculateAutoFontSize = () => {
            const container = contentRef.current;
            if (!container) return;

            // Available width minus approximate padding (px-2 + safety buffer)
            const availableWidth = container.clientWidth - 40;

            const tempDiv = document.createElement('div');
            tempDiv.style.position = 'absolute';
            tempDiv.style.visibility = 'hidden';
            tempDiv.style.height = 'auto';
            tempDiv.style.width = 'max-content';
            tempDiv.style.fontSize = '100px';
            tempDiv.style.fontFamily = 'ui-sans-serif, system-ui, sans-serif';
            tempDiv.innerHTML = song.content || '';

            document.body.appendChild(tempDiv);
            const contentWidth = tempDiv.getBoundingClientRect().width;
            document.body.removeChild(tempDiv);

            if (contentWidth > 0) {
                // Calculate scale factor: 100px gives contentWidth, we want availableWidth
                const scale = availableWidth / contentWidth;
                const newSize = Math.floor(100 * scale * 0.95); // 0.95 factor for safety
                setFontSize(Math.max(12, Math.min(200, newSize)));
            }
        };

        // Run calculation
        calculateAutoFontSize();

        // Recalculate on resize if no manual size is set
        window.addEventListener('resize', calculateAutoFontSize);
        return () => window.removeEventListener('resize', calculateAutoFontSize);
    }, [song.id, song.fontSize, song.content]);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const onFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, []);

    // --- ENHANCED GESTURE ENGINE (MOUSE + TOUCH) ---
    useEffect(() => {
        const slider = contentRef.current;
        if (!slider) return;

        let isDragging = false;
        let startY;
        let startScroll;

        const startDragging = (pageY) => {
            if (isEditing || status === 'PLAYING') return;
            isDragging = true;
            startY = pageY;
            startScroll = slider.scrollTop;
            gestureStart(slider.scrollTop);
            document.body.classList.add('no-select');
        };

        const stopDragging = () => {
            if (isDragging) gestureEnd(slider.scrollTop);
            isDragging = false;
            document.body.classList.remove('no-select');
        };

        const moveDragging = (pageY, e) => {
            if (!isDragging) return;
            if (e.cancelable) e.preventDefault();
            const currentY = pageY;
            const diff = (startY - currentY) * 1.5;
            const before = slider.scrollTop;
            slider.scrollTop = startScroll + diff;
            if (slider.scrollTop !== before) gestureMove();
        };

        const onMouseDown = (e) => startDragging(e.pageY);
        const onMouseMove = (e) => moveDragging(e.pageY, e);
        const onMouseUp = () => stopDragging();

        const onTouchStart = (e) => {
            if (e.touches.length > 0) startDragging(e.touches[0].pageY);
        };
        const onTouchMove = (e) => {
            if (e.touches.length > 0) moveDragging(e.touches[0].pageY, e);
        };
        const onTouchEnd = () => stopDragging();

        slider.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        slider.addEventListener('touchstart', onTouchStart, { passive: false });
        slider.addEventListener('touchmove', onTouchMove, { passive: false });
        slider.addEventListener('touchend', onTouchEnd);

        return () => {
            slider.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            slider.removeEventListener('touchstart', onTouchStart);
            slider.removeEventListener('touchmove', onTouchMove);
            slider.removeEventListener('touchend', onTouchEnd);
        };
    }, [isEditing, status, gestureStart, gestureMove, gestureEnd]);

    return (
        <Layout className="bg-black">
            {/* Nav Toolbar - Optimized for Mobile Overcrowding */}
            <header className="flex-none min-h-[4rem] sm:h-20 px-2 sm:px-4 bg-zinc-950/90 backdrop-blur-md border-b border-white/5 flex flex-wrap items-center justify-between gap-y-2 py-2 z-50">
                <div className="flex items-center gap-1 sm:gap-2">
                    <button onClick={onBack} className="p-2 sm:p-3 hover:bg-white/5 rounded-full text-white/70">
                        <ArrowLeft size={24} />
                    </button>

                    {/* Compact Zoom Controls */}
                    <div className="flex bg-zinc-900 border border-white/10 rounded-lg p-0.5">
                        <button onClick={() => adjustFontSize(-6)} className="p-1.5 sm:p-2 hover:bg-white/5 rounded-md text-white/60">
                            <ZoomOut size={18} />
                        </button>
                        <button onClick={() => adjustFontSize(6)} className="p-1.5 sm:p-2 hover:bg-white/5 rounded-md text-white/60">
                            <ZoomIn size={18} />
                        </button>
                    </div>

                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className={clsx(
                            "flex items-center justify-center p-2 sm:px-4 sm:py-2 rounded-lg text-xs font-bold border transition-all",
                            isEditing
                                ? "bg-primary border-primary text-white"
                                : "bg-zinc-800 border-white/10 text-white/60"
                        )}
                    >
                        {isEditing ? <Lock size={16} /> : <Edit3 size={16} />}
                        <span className="hidden sm:inline ml-2">{isEditing ? 'Listo' : 'Editar'}</span>
                    </button>
                </div>

                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="audio/*"
                    onChange={handleAudioUpload}
                />

                {/* Audio Controls */}
                <div className="flex items-center gap-1.5 sm:gap-3">
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className={clsx(
                            "p-2 sm:p-2 rounded-lg text-xs font-bold border transition-all",
                            localSong.audio instanceof Blob
                                ? "bg-green-600/20 border-green-600/50 text-green-400"
                                : "bg-zinc-800 border-white/10 text-white/40"
                        )}
                        title={localSong.audio instanceof Blob ? "Cambiar Audio" : "Adjuntar Audio"}
                    >
                        <Music size={16} />
                    </button>
                    {/* Mode Toggle: GRABAR (Activates/Deactivates Recording Ready Mode) */}
                    <button
                        onClick={() => setRecordingReady(!recordingReady)}
                        disabled={status === 'RECORDING' || status === 'PLAYING' || isEditing}
                        className={clsx(
                            "flex items-center gap-1.5 px-3 py-2 sm:px-5 sm:py-2.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-widest transition-all",
                            recordingReady
                                ? "bg-zinc-700 text-white ring-2 ring-red-500/50" // Active mode state
                                : "bg-zinc-800 text-white/50 disabled:opacity-20 hover:bg-zinc-700"
                        )}
                    >
                        <Circle size={12} fill={recordingReady ? "red" : "none"} className={recordingReady ? "text-red-500" : ""} />
                        <span className="whitespace-nowrap">{recordingReady ? 'CANCELAR' : 'GRABAR'}</span>
                    </button>

                    {/* Contextual Action Button */}
                    {recordingReady || status === 'RECORDING' ? (
                        /* Special Recording Play Button */
                        <button
                            onClick={handleSyncRecord}
                            disabled={isEditing}
                            className={clsx(
                                "flex items-center gap-1.5 px-5 py-2 sm:px-8 sm:py-2.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-widest transition-all shadow-xl",
                                status === 'RECORDING'
                                    ? "bg-red-600 text-white animate-pulse"
                                    : "bg-red-500 hover:bg-red-400 text-white scale-105"
                            )}
                        >
                            {status === 'RECORDING' ? <div className="w-3 h-3 bg-white rounded-sm" /> : <Play size={14} fill="currentColor" />}
                            <span className="whitespace-nowrap">{status === 'RECORDING' ? 'DETENER' : 'REC PLAY'}</span>
                        </button>
                    ) : (
                        /* Standard Playback Button */
                        <button
                            onClick={handleSyncPlay}
                            disabled={status === 'RECORDING' || isEditing}
                            className={clsx(
                                "flex items-center gap-1.5 px-5 py-2 sm:px-8 sm:py-2.5 rounded-full text-[9px] sm:text-[10px] font-black tracking-widest transition-all",
                                status === 'PLAYING'
                                    ? "bg-white text-black"
                                    : "bg-primary text-white shadow-lg shadow-primary/30 disabled:opacity-20"
                            )}
                        >
                            {status === 'PLAYING' ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                            <span className="whitespace-nowrap">{status === 'PLAYING' ? 'PAUSAR' : 'PLAY'}</span>
                        </button>
                    )}
                </div>
            </header>

            {/* Reading Guide Line */}
            <div className="fixed top-1/2 left-0 w-full h-[1px] bg-white z-40 pointer-events-none transform -translate-y-1/2 opacity-70" />

            {/* Scroll Container */}
            <div
                ref={contentRef}
                onScroll={handleScroll}
                className={clsx(
                    "flex-1 overflow-y-auto bg-black relative",
                    isEditing ? "cursor-text" : "cursor-grab"
                )}
                style={{
                    scrollBehavior: 'auto',
                    touchAction: isEditing ? 'auto' : 'none'
                }}
            >
                <div className="min-h-full px-2 py-10 w-full mx-auto">
                    <div
                        contentEditable={isEditing}
                        onBlur={handleContentBlur}
                        suppressContentEditableWarning={true}
                        className={clsx(
                            "song-content focus:outline-none w-full select-none",
                            isEditing && "select-text"
                        )}
                        style={{ fontSize: `${fontSize}px` }}
                        dangerouslySetInnerHTML={{ __html: localSong.content }}
                    />
                    <div className="h-[100vh]" />
                </div>
            </div>

            {/* Floating Action: Fullscreen Toggle (Discreet) */}
            <button
                onClick={toggleFullscreen}
                className="fixed bottom-6 left-6 p-3 bg-zinc-900/50 backdrop-blur-md border border-white/10 rounded-full text-white/40 hover:text-white hover:bg-zinc-800 transition-all z-50 shadow-xl"
                title="Pantalla Completa"
            >
                {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>

            {/* Floating Status */}
            {status !== 'IDLE' && (
                <div className={clsx(
                    "fixed bottom-6 right-6 px-4 py-2 sm:px-6 sm:py-3 rounded-xl shadow-2xl z-40 flex items-center gap-3 border backdrop-blur-md",
                    status === 'RECORDING' ? "bg-red-600/20 border-red-500/50 text-red-400" : "bg-primary/20 border-primary/50 text-indigo-400"
                )}>
                    <div className={clsx("w-2 h-2 rounded-full bg-current", status === 'RECORDING' && "animate-ping")} />
                    <span className="text-[9px] sm:text-[10px] font-black tracking-widest uppercase truncate max-w-[120px] sm:max-w-none">
                        {status === 'RECORDING' ? 'Grabando' : 'Auto-Scroll'}
                    </span>
                </div>
            )}
            {audioUrl && (
                <audio ref={audioRef} src={audioUrl} preload="auto" />
            )}
        </Layout>
    );
};
