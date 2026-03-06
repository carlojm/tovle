import { useState, useRef, useEffect } from 'react'
import './Toggle.css'

const Toggle = ({ tabs, activeTab, onChange }) => {
  /*
  tabs is an array of {id, label} objects
  activeTab is a string telling which tab is currently selected
  onChange is a function to call when the user taps a diff tab
  */

  const activeIndex = tabs.findIndex(t => t.id === activeTab)

  //css width and transform for the sliding bubble
  const [indicatorStyle, setIndicatorStyle] = useState({})

  //array of references to the actual DOM button elements
  //bc we need direct access to the elements to calculate where to move the indicator
  const tabRefs = useRef([])

  //when activeIndex changes, this triggers to move the indicator
  useEffect(() => {
    //grab the active element from the refs array
    const el = tabRefs.current[activeIndex]
    const group = el?.parentElement
    if (!el || !group) return

    //gets the exact pixel pos of each element relative to viewport
    //subtracting groupRect.left from elRect.left gives the button's relative position
    //using translateX to this calculated pos moves the indicator to the correct position.
    const elRect = el.getBoundingClientRect()
    const groupRect = group.getBoundingClientRect()

    //change CSS width and transform to move the indicator around
    setIndicatorStyle({
      width: el.offsetWidth,
      transform: `translateX(${elRect.left - groupRect.left}px)`,
    })
  }, [activeIndex])

  return (
    <div className="toggle-group">
      {/* sliding indicator */}
      <span className="toggle-indicator" style={indicatorStyle} />

      {/* loops over tabs array and renders a button for each one, very fancy */}
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          ref={el => tabRefs.current[i] = el} //this line populates the refs array
          className={`toggle-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default Toggle
