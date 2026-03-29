import {getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken} from "firebase/auth"
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

export async function restoreWithUid(uid) {
  //we can use uid to restore data

  //call backend to vierfy uid exists
  const res = await fetch('api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({uid})
  })

  if (!res.ok) {
    const {error} = await res.json()
    throw new Error(error)
  }

  //custom token created by backend api/auth/token call
  //sign into firebase as this uid using the token.
  //after this line, firebase considers this device to be that uid/player
  const {token} = await res.json()
  await signInWithCustomToken(auth, token)
  //onauthstatechanged in playercontext fires automatically after this
}

export {auth}