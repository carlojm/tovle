import { useState, useEffect, useRef } from 'react'
import './Info.css'
import {Ship, DraftingCompass, Gift, NotebookPen, UserLock, BookCopy, Bot, Bug, Gem, Pointer} from 'lucide-react'
import Stats from './Stats'


const Info = ({onNavigate}) => {
  const [cats, setCats] = useState([])
  const catsRef = useRef([])
  const SIZE = 64

  const catRef = useRef(null)

  const spawnCat = () => {
    setShimmying(true)
    setTimeout(() => setShimmying(false), 400)

    const rect = catRef.current.getBoundingClientRect()
    const id = Date.now()
    const speed = 1.5 + Math.random() * 4
    const angle = Math.random() * 2 * Math.PI
    const cat = {
      id,
      pos: { x: rect.left, y: rect.top },
      vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }
    }

    catsRef.current = [...catsRef.current, cat]
    setCats([...catsRef.current])

    setTimeout(() => {
      catsRef.current = catsRef.current.filter(c => c.id !== id)
      setCats([...catsRef.current])
    }, 4000)
  }
  
  useEffect(() => {
    let animId
    const frame = () => {
      catsRef.current = catsRef.current.map(cat => {
        let { x, y } = cat.pos
        let { x: vx, y: vy } = cat.vel

        x += vx
        y += vy

        if (x <= 0 || x >= window.innerWidth - SIZE) vx = -vx
        if (y <= 0 || y >= window.innerHeight - SIZE) vy = -vy

        x = Math.max(0, Math.min(x, window.innerWidth - SIZE))
        y = Math.max(0, Math.min(y, window.innerHeight - SIZE))

        return { ...cat, pos: { x, y }, vel: { x: vx, y: vy } }
      })
      setCats([...catsRef.current])
      animId = requestAnimationFrame(frame) //calls itself again next frame
    }

    animId = requestAnimationFrame(frame) //loop
    return () => cancelAnimationFrame(animId) //cancel loop when we switch tabs
  }, [])


  const [shimmying, setShimmying] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setShimmying(true)
      setTimeout(() => setShimmying(false), 400)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

	return (
    <div className="info-page-layout">

      <div>
        <Stats />
      </div>

      <div className="info-box">
        <h1>Welcome to Tovle!</h1>
        <p>
          Tovle is a daily game based on Monumenta's{' '}
          <a
            href="https://monumenta.wiki.gg/wiki/Treasures_of_Viridia"
            target="_blank"
            rel="noopener noreferrer"
            className="wiki-link"
          >
            Treasures of Viridia
          </a>{' '} gamemode.
          I am building this project to learn React and CSS. 
          Tovle is a fanmade site and not affiliated with Monumenta.
        </p>
        <p>
          For feedback or suggestions, message me @carlojm on Discord.
          Send in your own custom caches! Submission guidelines at the bottom of this page.
        </p>

        {cats.map(cat => (
          <img
            key={cat.id}
            src="/otmcat.png"
            className="info-cat info-cat--bouncing"
            style={{ left: cat.pos.x, top: cat.pos.y }}
          />
        ))}

        <img
          ref={catRef}
          src="/otmcat.png"
          className={`info-cat ${shimmying ? 'info-cat--shimmy' : ''}`}
          onClick={spawnCat}
          style={{ cursor: 'pointer' }}
        />


        <div style={{ textAlign: 'center', marginBottom: '16px', marginTop: '12px' }}>
          <a
            href="https://ko-fi.com/carlojm"
            target="_blank"
            rel="noopener noreferrer"
            className="kofi-btn info-button"
          >
            Support Tovle on Ko-fi
          </a>
        </div>
        

        {/* <p>
          IMPORTANT! If you're reading this, you are playing pre-release.
          Expect user data to get randomly erased or corrupted.
          Actually if it gets corrupted that's weird and you should tell me.
        </p> */}

        <p>
          If you'd like to support the game's development and cover any server costs,
          I made a ko-fi page!
        </p>
        <p>
          Current planned features: Travel system, Equipment
        </p>

        <h1>Info</h1>

          <div className="info-row">
            <Ship size={20} color="var(--color-text)" />
            <p>
              Four new caches wash in with the tide every day at midnight EDT, UTC-04.
              Pinpoint each cache's coordinates based on the image. Each daily set typically consists of
              three standard caches and one custom cache unique to the day.
            </p>
          </div>

          <div className="info-row">
            <DraftingCompass size={20} color="var(--color-text)" />
            <p>
              Each guess will display info guiding you closer to the cache. Guess within 50 blocks to collect the cache.
            </p>
          </div>

          <div className="info-row">
            <Gift size={20} color="var(--color-text)" />
            <p>
              Open your caches in the Caches tab to obtain items at random.
              Caches found in less guesses may contain better loot!
              Use these items for various upgrades and bragging rights.
            </p>
          </div>

        <h1>Login</h1>
          <div className="info-row">
            <NotebookPen size={20} color="var(--color-text)" />
            <p>
              Tovle stores anonymous gameplay data: game stats, guess history, and inventory.
              This data is tied to a randomly generated user ID and contains no personal info.
              Erasing your browser cache will lose your player data.
            </p>
          </div>

          <div className="info-row">
            <UserLock size={20} color="var(--color-text)" />
            <p>
              To prevent losing data, copy your UID from the Data page and save it somewhere.
            </p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '16px'}}>
            {/* reuse button class from data tab lol */}
            <button className="info-button" onClick={() => onNavigate('data')}>
              Go to Data Page
            </button>
          </div>

      </div>
      

      <div className="info-box">
        <h1>Attribution</h1>

          <div className="info-row">
            <BookCopy size={20} color="var(--color-text)" />

            <p>Minecraft assets are the property of Mojang Studios / Microsoft and are used here for fan purposes only.</p>
            <p>Monumenta artwork, custom textures, and game content belong to the Monumenta development team and resource pack team.</p>
            <p>Game concept from the Treasures of Viridia gamemode on Monumenta.</p>
            <p>SVG Icons by Lucide.dev.</p>
          </div>

        <h1>AI Disclaimer</h1>


          <div className="info-row">
            <Bot size={20} color="var(--color-text)" />
            <p>
              I refuse to let an LLM have any creative input over any work I take part in. 
              I started this project to learn React and CSS and vibe coding would not achieve that goal or create an interesting game.
              All concepts and direction and ugly design elements orchestrated by ME!
            </p>

            <p>
              I am using LLMs in the development of this project, however.
              My main sources for learning web dev over the last six months have been FullStackOpen's React course, CSS videos on Youtube, and Claude to fill in the gaps.
              I use copilot to write boilerplate or refactor code on the backend.
              It can be hard to tow the line, so I want to be transparent when possible.
            </p>
            <p>
              There is no AI-generated artwork in this project.
              I don't even like letting it pick my CSS colors.
            </p>
          </div>

        <h1>Contributors</h1>

          <div className="info-row">
            <Bug size={20} color="var(--color-text)" />
            <p>
              Beta testers: BlissedYui, Endertective, Rushdog7, weekendtech, YezXD 
            </p>
            <Gem size={20} color="var(--color-text)" />
            <p>
              Custom cache contributors:
              weekendtech (4/1), CelicaWolf (4/2), Smolfox & Shining_Cat (4/3)
            </p>
            <Pointer size={20} color="var(--color-text)" />
            <p>
              Your name can be here! Send a custom cache image and its coordinates to @carlojm on Discord.
              Guidelines:
              The coords must be within the bounds of the isles map.
              The coords must directly point to a chest placed in the picture.
              Please turn FOV down to 50-60 before taking the picture.
              Otherwise, get as creative as you want!
            </p>
          </div>


      </div>
      
    </div>
	);
}

export default Info