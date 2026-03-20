import {getAuth, signInAnonymously, onAuthStateChanged} from "firebase/auth"
import app from "./config"

const auth = getAuth(app)

export function initAuth(onReady) {
  //-use onauthstatechanged so signinanonymously only runs if there's no user at all.
  //-players keep the same uid across refreshes/revisits automatically bc firebase auto persists
  //the anonymous session across page refreshes.
  onAuthStateChanged(auth, (user) => {
    if (user) {
      //user alrdy signed in, either anonymous account or a linked account
      onReady(user)
    } else {
      //no user exists yet, create anonymous account
      signInAnonymously(auth).catch((err) => {
        console.error("Anonymous sign in failed:", err)
      })
    }
  })
}

export {auth}