import { useState, useEffect } from 'react'
import Footer from './components/Footer'
import Notification from './components/Notification'
import Dateline from './components/Dateline'

const App = () => {
  const [notes, setNotes] = useState([{"id": 0, "content":"hello"}])
  const [newNote, setNewNote] = useState('a new note...') 
  const [showAll, setShowAll] = useState(true)
  const [errorMessage, setErrorMessage] = useState(null)

  // useEffect(() => {
  //   noteService.getAll().then(initialNotes => {
  //     setNotes(initialNotes)
  //   })
  // }, [])
  
  return (
    <div>
      <h1>Tovle</h1>
      <Dateline />
      <Notification message={errorMessage} />

      <Footer />
    </div>
  )
}
export default App