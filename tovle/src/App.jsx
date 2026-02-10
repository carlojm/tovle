import { useState, useEffect } from 'react'
import Footer from './components/Footer'
import Notification from './components/Notification'
import Dateline from './components/Dateline'

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
  const myImage = cld.image('my_test'); 

  // Resize to 250 x 250 pixels using the 'fill' crop mode.
  myImage.resize(fill().width(250));

  // Render the image in a React component.
  return (
    <div>
      <h1>Tovle</h1>
      <Dateline />
      <Notification message={errorMessage} />

      <AdvancedImage cldImg={myImage} />

      <Footer />
    </div>
  )
}
export default App