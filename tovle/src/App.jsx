import { useState, useEffect } from 'react'
import Footer from './components/Footer'
import Notification from './components/Notification'
import Dateline from './components/Dateline'
import Map from './components/Map'

import {Cloudinary} from "@cloudinary/url-gen";
import {AdvancedImage} from '@cloudinary/react';
import {fill} from "@cloudinary/url-gen/actions/resize";

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

  // Create a Cloudinary instance and set your cloud name.
  const cld = new Cloudinary({
    cloud: {
      cloudName: 'carlojm'
    }
  });

  // Instantiate a CloudinaryImage object for the image with the public ID, 'docs/models'.
  const id = Math.floor(Math.random() * 14) + 1;
  const myImage = cld.image(`tov/${id}`);

  // Resize to 250 x 250 pixels using the 'fill' crop mode.
  myImage.resize(fill().width(1000));

  // Render the image in a React component.
  return (
    <div>
      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minHeight: '100vh'  // full viewport height
      }}>
        <h1>Tovle!</h1>
        <Dateline />
        <Notification message={errorMessage} />
        <AdvancedImage cldImg={myImage} style={{
          // maxHeight: '70vh',
          width: 'min(90vw, 1000px)',
          height: 'auto',
          objectFit: 'contain'
        }} />
        <Map />
      </div>

      <Footer />
    </div>
  )
}
export default App