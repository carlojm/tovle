import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore"
import app from "./config"

const db = getFirestore(app) //gets a reference to the firestore database

export function getPlayerDocRef(uid) {
  //builds a reference to a specific document in firestore.
  //"players" is the collection and uid is the document id.
  //ex. uid abc123, this points to players/abc123
  return doc(db, "players", uid)
}

export async function loadPlayerData(uid) {
  //getDoc fetches document from firestore
  //it returns a snapshot, an object with the result of the fetch
  //if something is there, return the data
  //if nothing is there, return null so we know to create a fresh save
  const ref = getPlayerDocRef(uid)
  const snapshot = await getDoc(ref)
  if (snapshot.exists()) {
    return snapshot.data()
  }
  return null //new player, no document yet
}

export async function savePlayerData(uid, data) {
  //write data to document
  //merge:true = only update the fields we included and leave everything else untouched.
  const ref = getPlayerDocRef(uid)
  await setDoc(ref, data, {merge:true})
}

