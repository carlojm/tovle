import { useState, useEffect, useRef } from 'react'
import './Info.css'
import {Ship, DraftingCompass, Gift, NotebookPen, UserLock} from 'lucide-react'


const Info = () => {
  const [cats, setCats] = useState([])
  const catsRef = useRef([])
  const SIZE = 64

  const catRef = useRef(null)

  const spawnCat = () => {
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

	return (
    <div>
      
      <div className="info-box">
        <h1>Welcome to Tovle!</h1>
        <p>
          I am building this project to learn React and CSS. 
          Tovle is a fanmade site and not affiliated with Monumenta.
        </p>
        <p>
          For feedback or suggestions, message me @carlojm on Discord.
          Send in your own custom caches!
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
          className="info-cat"
          onClick={spawnCat}
          style={{ cursor: 'pointer' }}
        />

        <p>
          IMPORTANT! If you're reading this, you are playing pre-release.
          Expect user data to get randomly erased or corrupted.
          Actually if it gets corrupted that's weird and you should tell me.
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
              This data is tied to a randomly generated uid and contains no personal info.
              Erasing your browser cache will erase your player data. To prevent losing data,
              consider linking a Google account to your uid.
            </p>
          </div>

          <div className="info-row">
            <UserLock size={20} color="var(--color-text)" />
            <p>
              Important: Linking a Google account ties your email address to your uid in the app's Firestore database.
              Consider using an email address that does not reveal personal info so I'm not up in your business like that.
              Your data is never shared, sold, or used for any purpose outside of saving game data.
              You can play without linking an account at any time.
            </p>
          </div>

          <p style={{textAlign:"center"}}>(Login button here)</p>

      </div>
    </div>
	);
}

export default Info