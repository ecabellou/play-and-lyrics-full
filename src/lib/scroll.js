export class ScrollRecorder {
    constructor() {
        this.startTime = null;
        this.isRecording = false;
        this.checkpoints = [];
        this.resetGesture();
    }

    resetGesture() {
        this.gestureActive = false;
        this.gestureMoved = false;
        this.gestureStartY = 0;
    }

    start(initialY = 0) {
        this.isRecording = true;
        this.checkpoints = [];
        this.resetGesture();
        this.startTime = Date.now();
        // Record initial state
        this.checkpoints.push({ t: 0, y: initialY });
    }

    // Fallback for scrolls without a drag gesture (mouse wheel, keyboard).
    // Ignored while a drag gesture is active: drags only record start and end.
    recordCheckpoint(scrollY) {
        if (!this.isRecording || this.gestureActive) return;
        const last = this.checkpoints[this.checkpoints.length - 1];
        if (last && last.y === scrollY) return;
        this.checkpoints.push({ t: Date.now() - this.startTime, y: scrollY });
    }

    // Finger/mouse down: nothing is recorded yet, only the starting position.
    beginGesture(scrollY) {
        if (!this.isRecording) return;
        this.gestureActive = true;
        this.gestureMoved = false;
        this.gestureStartY = scrollY;
    }

    // First real movement of the gesture: record the start point.
    // Everything in between (pauses, speed changes) is ignored.
    moveGesture() {
        if (!this.isRecording || !this.gestureActive || this.gestureMoved) return;
        this.gestureMoved = true;
        this.checkpoints.push({ t: Date.now() - this.startTime, y: this.gestureStartY });
    }

    // Finger/mouse up: record the end point.
    endGesture(scrollY) {
        if (!this.isRecording || !this.gestureActive) return;
        if (this.gestureMoved) {
            this.checkpoints.push({ t: Date.now() - this.startTime, y: scrollY });
        }
        this.resetGesture();
    }

    stop(currentY) {
        if (this.gestureActive && currentY !== undefined) this.endGesture(currentY);
        this.isRecording = false;
        this.resetGesture();
        return this.checkpoints;
    }
}

export class ScrollPlayer {
    constructor(scrollerElement) {
        this.scroller = scrollerElement;
        this.checkpoints = [];
        this.isPlaying = false;
        this.animationFrame = null;
        this.startTime = null;
    }

    load(checkpoints) {
        this.checkpoints = checkpoints || [];
    }

    play(onComplete) {
        if (this.checkpoints.length === 0) return;

        this.isPlaying = true;
        // If we have a currentOffset, adjust startTime so that (Date.now() - startTime) equals currentOffset
        // elapsed = Date.now() - startTime
        // If we want elapsed to start at currentOffset:
        // currentOffset = Date.now() - startTime  => startTime = Date.now() - currentOffset
        this.currentOffset = this.currentOffset || 0;
        this.startTime = Date.now() - this.currentOffset;

        const animate = () => {
            if (!this.isPlaying) return;

            const elapsed = Date.now() - this.startTime;
            this.currentOffset = elapsed; // Track current position
            const targetY = this.interpolate(elapsed);

            if (targetY !== null) {
                this.scroller.scrollTop = targetY;
                this.animationFrame = requestAnimationFrame(animate);
            } else {
                // End of recording
                this.stop();
                if (onComplete) onComplete();
            }
        };

        this.animationFrame = requestAnimationFrame(animate);
    }

    pause() {
        this.isPlaying = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        // currentOffset is already up-to-date from the animation loop
        // but strictly speaking, we should update it one last time? 
        // The loop updates it, so it's close enough.
        // Actually, let's explicitly capture it to be safe if loop wasn't running
        if (this.startTime) {
            this.currentOffset = Date.now() - this.startTime;
        }
    }

    stop() {
        this.pause();
        this.startTime = null;
        this.currentOffset = 0;
    }

    interpolate(elapsed) {
        // Find the two checkpoints surrounding the current elapsed time
        // This is a simple linear interpolation. 
        // Optimization: Store last index to avoid searching from 0 every frame

        const maxTime = this.checkpoints[this.checkpoints.length - 1].t;
        if (elapsed > maxTime) return null; // Finished

        // Find instant match or range
        for (let i = 0; i < this.checkpoints.length - 1; i++) {
            const current = this.checkpoints[i];
            const next = this.checkpoints[i + 1];

            if (elapsed >= current.t && elapsed <= next.t) {
                // Interpolate
                const range = next.t - current.t;
                const progress = (elapsed - current.t) / range;
                const yRange = next.y - current.y;
                return current.y + (yRange * progress);
            }
        }

        return this.checkpoints[0].y; // Should rarely happen if elapsed < maxTime
    }
}
