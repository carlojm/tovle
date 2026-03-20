import {getAuth, signInAnonymously, onAuthStateChanged} from "firebase/auth"
import app from "./config"

const auth = getAuth(app)

export function initAuth(onReady) {
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