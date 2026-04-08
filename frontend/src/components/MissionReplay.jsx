/**
 * MissionReplay — Timeline scrubber for replaying recorded positions/events.
 * Spec §4.11: Replay vehicle positions and events with timeline control.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';

export default function MissionReplay({ historyBuffer, onSeek, isRecording }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const playIntervalRef = useRef(null);

  const totalFrames = historyBuffer?.length || 0;
  const hasHistory = totalFrames > 1;

  // Get time range
  const startTime = hasHistory ? historyBuffer[0]?.timestamp : 0;
  const endTime = hasHistory ? historyBuffer[totalFrames - 1]?.timestamp : 0;
  const currentTime = hasHistory && historyBuffer[currentIndex]
    ? historyBuffer[currentIndex].timestamp
    : 0;

  const formatReplayTime = (ts) => {
    if (!ts) return '--:--:--';
    const d = new Date(ts * 1000);
    return d.toLocaleTimeString('en-GB', { hour12: false });
  };

  const elapsedSeconds = currentTime - startTime;
  const totalSeconds = endTime - startTime;

  // Playback logic
  useEffect(() => {
    if (isPlaying && isReplayMode) {
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const next = prev + 1;
          if (next >= totalFrames) {
            setIsPlaying(false);
            return prev;
          }
          return next;
        });
      }, 200 / playbackSpeed); // Base rate = 5 Hz (200ms)
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, isReplayMode, playbackSpeed, totalFrames]);

  // Seek to specific frame
  useEffect(() => {
    if (isReplayMode && onSeek && historyBuffer[currentIndex]) {
      onSeek(historyBuffer[currentIndex]);
    }
  }, [currentIndex, isReplayMode]);

  const handleSliderChange = (e) => {
    const idx = parseInt(e.target.value);
    setCurrentIndex(idx);
    setIsPlaying(false);
  };

  const toggleReplayMode = () => {
    if (isReplayMode) {
      // Exit replay → return to live
      setIsReplayMode(false);
      setIsPlaying(false);
      setCurrentIndex(totalFrames - 1);
      if (onSeek) onSeek(null); // null = return to live
    } else {
      // Enter replay
      setIsReplayMode(true);
      setCurrentIndex(0);
    }
  };

  if (!hasHistory) {
    return (
      <div className="mission-replay-mini">
        <span className="telemetry-label">
          {isRecording ? `Recording... (${totalFrames} frames)` : 'No history available'}
        </span>
      </div>
    );
  }

  return (
    <div className={`mission-replay ${isReplayMode ? 'replay-active' : ''}`}>
      <div className="replay-header">
        <button
          className={`btn btn-sm ${isReplayMode ? 'btn-accent' : ''}`}
          onClick={toggleReplayMode}
        >
          {isReplayMode ? '⏹ Live' : '⏮ Replay'}
        </button>

        {isReplayMode && (
          <>
            <button
              className="btn btn-sm"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>

            <select
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
              className="replay-speed-select"
            >
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={5}>5×</option>
              <option value={10}>10×</option>
            </select>
          </>
        )}

        <span className="telemetry-label replay-time">
          {isReplayMode
            ? `${formatReplayTime(currentTime)} (${elapsedSeconds.toFixed(0)}s / ${totalSeconds.toFixed(0)}s)`
            : `${totalFrames} frames recorded`
          }
        </span>
      </div>

      {isReplayMode && (
        <div className="replay-slider-container">
          <input
            type="range"
            min={0}
            max={Math.max(totalFrames - 1, 0)}
            value={currentIndex}
            onChange={handleSliderChange}
            className="replay-slider"
          />
          {/* Event markers on timeline */}
          <div className="replay-markers">
            {historyBuffer
              .filter(frame => frame.events && frame.events.length > 0)
              .map((frame, i) => {
                const pos = ((frame.timestamp - startTime) / Math.max(totalSeconds, 1)) * 100;
                return (
                  <div
                    key={i}
                    className="replay-marker"
                    style={{ left: `${pos}%` }}
                    title={frame.events.map(e => e.message).join(', ')}
                  />
                );
              })
            }
          </div>
        </div>
      )}
    </div>
  );
}
