import MultiplayerPage from './fight/MultiplayerPage.jsx';
import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Flag, Swords, Zap } from 'lucide-react';
import App from './App.jsx';
import TypeFightPage from './fight/TypeFightPage.jsx';
export default function GameRouter() {
  const [route, setRoute] = useState(() => location.hash);
  useEffect(() => {
    const change = () => setRoute(location.hash);
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  if (route === '#/fight/friend') return <MultiplayerPage />;
  if (route === '#/fight') return <TypeFightPage />;
  if (route === '#/games')
    return (
      <div className="game-selection">
        <a className="fight-brand" href="#/games">
          <Zap /> type<span>arcade</span>
        </a>
        <span className="fight-kicker">ONE KEYBOARD. TWO WAYS TO WIN.</span>
        <h1>
          Choose your
          <br />
          <em>kind of fast.</em>
        </h1>
        <p>Find your rhythm on the road. Or make every word hit harder.</p>
        <div className="game-cards">
          <a href="#/race">
            <Flag size={42} />
            <span>01 / RACING</span>
            <h2>TypeRush</h2>
            <p>
              Four lanes. One finish line.
              <br />
              Turn your typing speed into horsepower.
            </p>
            <b>
              Hit the road <ArrowUpRight />
            </b>
          </a>
          <a href="#/fight">
            <Swords size={42} />
            <span>02 / FIGHTING</span>
            <h2>TypeFight</h2>
            <p>
              Fast words. Heavy hits.
              <br />
              Chain attacks in the neon rooftop arena.
            </p>
            <b>
              Enter the arena <ArrowUpRight />
            </b>
          </a>
        </div>
      </div>
    );
  return <App />;
}
