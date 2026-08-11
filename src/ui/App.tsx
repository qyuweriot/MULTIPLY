import './App.css'
import { PLAYER_LABELS, ZONE_LABELS } from '../labels.ts'

export default function App() {
  return (
    <div className="app">
      <h1>Hello — MULTIPLY</h1>
      <p className="subtitle">Phase 0: セットアップ完了</p>
      <div className="zone-preview">
        {PLAYER_LABELS.map((player) =>
          (['z0', 'z1'] as const).map((z) => (
            <div key={`${player}-${z}`}>
              {player} / {ZONE_LABELS[z]}ゾーン
            </div>
          )),
        )}
      </div>
    </div>
  )
}
