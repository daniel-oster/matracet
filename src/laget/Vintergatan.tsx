import { useState } from 'react'

/** Menu → Vintergatan: one picture, for fun. The file is `public/laget/vintergatan.jpg`; until someone
 *  puts one there the page says how. */
export default function Vintergatan() {
  const [missing, setMissing] = useState(false)
  return (
    <>
      <h2 className="laget-h">Vintergatan</h2>
      {missing ? (
        <p className="laget-sub">Ingen bild än. Lägg en bild som <code>public/laget/vintergatan.jpg</code> i appens repo, så visas den här.</p>
      ) : (
        <img className="laget-milkyway" src={`${import.meta.env.BASE_URL}laget/vintergatan.jpg`} alt="Vintergatan" onError={() => setMissing(true)} />
      )}
    </>
  )
}
