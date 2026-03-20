import ReactDOM from "react-dom/client";
import App from "./App";
import './index.css'

//firebase auth script
import { initAuth } from "./firebase/auth"

initAuth((user) => {
    // console.log("Player UID:", user.uid)
    
    //render the app inside initAuth, so the app never mounts until
    //firebase confirms a uid exists. either a returning uid or a fresh anonymous one.
    //prevents any race condition where we try to read/write data before we have an identity for it
    ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})

