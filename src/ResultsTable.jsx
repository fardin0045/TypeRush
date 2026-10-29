import React from 'react';
import { standings } from './engine.js';
export default function ResultsTable({ race }) {
  return (
    <table className="results-table">
      <caption>Final standings at the chequered flag</caption>
      <thead>
        <tr>
          <th>Driver</th>
          <th>Progress</th>
          <th>Net WPM</th>
          <th>Accuracy</th>
        </tr>
      </thead>
      <tbody>
        {standings(race).map((driver, i) => {
          const minutes = race.elapsed / 60;
          const net = minutes ? Math.max(0, (driver.total / 5 - driver.errors) / minutes) : 0;
          return (
            <tr key={driver.name}>
              <td>
                {i + 1}. {driver.name}
              </td>
              <td>{Math.round((driver.cursor / race.text.length) * 100)}%</td>
              <td>{Math.round(net)}</td>
              <td>
                {driver.total
                  ? Math.round(((driver.total - driver.errors) / driver.total) * 100)
                  : 100}
                %
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
