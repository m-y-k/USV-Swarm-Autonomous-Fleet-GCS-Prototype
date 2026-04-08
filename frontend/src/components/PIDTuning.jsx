/**
 * PIDTuning — Read/write ArduPilot PID parameters.
 * Spec §4.10: Sliders, presets, parameter display.
 */
import React, { useState } from 'react';
import { PID_PARAMS } from '../utils/constants';

const PRESETS = {
  conservative: {
    ATC_STR_RAT_P: 0.1, ATC_STR_RAT_I: 0.05, ATC_STR_RAT_D: 0.001,
    ATC_SPEED_P: 0.3, ATC_SPEED_I: 0.1, ATC_SPEED_D: 0.001,
    CRUISE_SPEED: 1.5, CRUISE_THROTTLE: 30, WP_RADIUS: 10, NAVL1_PERIOD: 20,
  },
  balanced: {
    ATC_STR_RAT_P: 0.3, ATC_STR_RAT_I: 0.1, ATC_STR_RAT_D: 0.005,
    ATC_SPEED_P: 0.7, ATC_SPEED_I: 0.3, ATC_SPEED_D: 0.005,
    CRUISE_SPEED: 3.0, CRUISE_THROTTLE: 50, WP_RADIUS: 5, NAVL1_PERIOD: 15,
  },
  aggressive: {
    ATC_STR_RAT_P: 0.8, ATC_STR_RAT_I: 0.4, ATC_STR_RAT_D: 0.02,
    ATC_SPEED_P: 1.5, ATC_SPEED_I: 0.8, ATC_SPEED_D: 0.02,
    CRUISE_SPEED: 5.0, CRUISE_THROTTLE: 75, WP_RADIUS: 3, NAVL1_PERIOD: 8,
  },
};

export default function PIDTuning({ sendCommand, vehicle }) {
  const [values, setValues] = useState(() => {
    const initial = {};
    PID_PARAMS.forEach(p => {
      initial[p.key] = PRESETS.balanced[p.key] || 0;
    });
    return initial;
  });

  const handleChange = (key, val) => {
    setValues(prev => ({ ...prev, [key]: parseFloat(val) }));
  };

  const handlePreset = (presetName) => {
    setValues(PRESETS[presetName]);
  };

  const handleWrite = (key) => {
    if (!vehicle) return;
    sendCommand({
      type: 'param_set',
      vehicle_id: vehicle.id,
      param: key,
      value: values[key],
    });
  };

  const handleWriteAll = () => {
    if (!vehicle) return;
    Object.entries(values).forEach(([key, value]) => {
      sendCommand({
        type: 'param_set',
        vehicle_id: vehicle.id,
        param: key,
        value,
      });
    });
  };

  return (
    <div className="pid-tuning">
      <div className="command-section">
        <div className="command-section-title">PID Tuning</div>

        {/* Presets */}
        <div className="command-row" style={{ marginBottom: 8 }}>
          <button className="btn btn-sm" onClick={() => handlePreset('conservative')}>🐢 Conservative</button>
          <button className="btn btn-accent btn-sm" onClick={() => handlePreset('balanced')}>⚖ Balanced</button>
          <button className="btn btn-danger btn-sm" onClick={() => handlePreset('aggressive')}>🔥 Aggressive</button>
        </div>

        {/* Parameter sliders */}
        <div className="pid-params-list">
          {PID_PARAMS.map(param => (
            <div key={param.key} className="pid-param-row">
              <div className="pid-param-header">
                <span className="telemetry-label">{param.label}</span>
                <span className="telemetry-value">{values[param.key]?.toFixed(param.step < 0.01 ? 3 : param.step < 1 ? 2 : 1)}</span>
              </div>
              <div className="pid-param-control">
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  value={values[param.key] || 0}
                  onChange={(e) => handleChange(param.key, e.target.value)}
                />
                <button className="btn btn-sm" onClick={() => handleWrite(param.key)} title="Write to vehicle">
                  ✎
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="command-row" style={{ marginTop: 8 }}>
          <button className="btn btn-accent btn-sm" onClick={handleWriteAll} style={{ width: '100%' }}>
            📝 Write All Parameters
          </button>
        </div>
      </div>
    </div>
  );
}
