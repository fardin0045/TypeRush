import React from 'react';
export const colors = ['#67efb4', '#a48bfa', '#ffbd65', '#5ecbff'];
export function RacingCar({ color, id }) {
  return (
    <svg viewBox="0 0 150 68" aria-hidden="true">
      <defs>
        <linearGradient id={'paint' + id} x2="0" y2="1">
          <stop stopColor="#fff" stopOpacity=".9" />
          <stop offset=".28" stopColor={color} />
          <stop offset=".65" stopColor={color} />
          <stop offset="1" stopColor="#14292c" />
        </linearGradient>
      </defs>
      <ellipse cx="75" cy="53" rx="65" ry="9" fill="#000" opacity=".5" />
      <path
        d="M17 33 38 29 57 13 96 15 115 31 136 36 142 47 132 52 15 51 9 44Z"
        fill={'url(#paint' + id + ')'}
        stroke={color}
      />
      <path
        d="m43 28 17-12 15 1v13Zm36-11 15 1 14 13-29-1Z"
        fill="#102532"
        stroke="#87bac1"
        strokeWidth=".6"
      />
      <path d="M14 34h22m75 1 23 5M44 35l57 1M64 37h8" stroke="#d9fff2" strokeOpacity=".7" />
      <path d="m16 44 118 1" stroke="#18323b" strokeWidth="3" />
      <path d="M11 35h9v5h-9" fill="#ff5462" />
      <path d="m130 36 8 3 1 4-12-2Z" fill="#e0ffff" />
      <path d="M18 29v-5h18v3" fill={color} />
      {[38, 114].map((x) => (
        <g key={x}>
          <circle cx={x} cy="49" r="12" fill="#090c12" stroke="#45505c" strokeWidth="2" />
          <circle cx={x} cy="49" r="7" fill="#9aabb6" />
          <g className="wheel" style={{ transformOrigin: `${x}px 49px` }}>
            <path
              d={`M${x - 6} 49h12m-6-6v12m-4-10 8 8m0-8-8 8`}
              stroke="#27343f"
              strokeWidth="2"
            />
          </g>
          <circle cx={x} cy="49" r="2" fill="#d6e4e9" />
        </g>
      ))}
    </svg>
  );
}
export default function RaceTrack({ race, count, reduced }) {
  const solo = ['Practice', 'Time trial'].includes(race.mode);
  const cars = [{ name: 'YOU', cursor: race.cursor }, ...(!solo ? race.bots : [])];
  return (
    <section
      className={`arena ${race.status === 'racing' ? 'moving' : ''} ${reduced ? 'reduced' : ''}`}
      aria-label="Live race circuit"
    >
      <div className="arena-top">
        <span>
          <i /> NIGHTFALL CIRCUIT
        </span>
        <span>
          24°C <b> · </b> DRY TRACK <b> · </b> 01 / 01
        </span>
      </div>
      <div className="skyline">
        {Array.from({ length: 32 }, (_, i) => (
          <i key={i} style={{ height: 18 + ((i * 37) % 66), width: 20 + ((i * 13) % 29) }} />
        ))}
      </div>
      <div className="track">
        <div className="finish">
          <span>FINISH</span>
        </div>
        {cars.map((car, i) => (
          <div className="lane" key={car.name}>
            <span className="lane-number">0{i + 1}</span>
            <div className="car-route">
              <div
                className="car"
                style={{
                  left: `${Math.min(100, (car.cursor / race.text.length) * 100)}%`,
                  '--car-color': colors[i],
                }}
              >
                <span className="driver">
                  {car.name}
                  {i === 0 && <small> YOU </small>}
                </span>
                <RacingCar color={colors[i]} id={i} />
                <div className="underglow" />
              </div>
            </div>
            <span className="lane-progress">
              {Math.floor((car.cursor / race.text.length) * 100)}%
            </span>
          </div>
        ))}
      </div>
      <div className="track-edge" />
      <div className="arena-bottom">
        <span>
          SECTOR 01 <b>━━━━━━━━━━</b> SECTOR 02 <b>━━━━━━━━━━</b> SECTOR 03
        </span>
        <span>
          TYPE TO ACCELERATE <span>→</span>
        </span>
      </div>
      {count !== null && (
        <div className="countdown" role="status">
          <span>GET IN THE ZONE</span>
          <strong key={count}>{count || 'GO!'}</strong>
          <p>Your next personal best starts here.</p>
        </div>
      )}
      {race.status === 'paused' && (
        <div className="countdown">
          <strong>Paused</strong>
          <p>Resume when you’re ready.</p>
        </div>
      )}
    </section>
  );
}
