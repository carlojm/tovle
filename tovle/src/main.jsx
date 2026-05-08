import ReactDOM from "react-dom/client";
import App from "./App";
import './index.css'
import './assets/spritesheets/_itemsheet.css'
import './assets/spritesheets/_minecraft.css'

import { PlayerProvider } from "./context/PlayerContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <PlayerProvider>
    <App />
  </PlayerProvider>
);