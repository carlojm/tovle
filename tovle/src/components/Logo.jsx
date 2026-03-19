//this file written by claude because i didn't wanna

import { useState, useEffect } from 'react'
import './Logo.css'

export default function Logo() {
  // Read the current theme by checking if the <html> element has the 'light' class.
  // We initialise state from the DOM directly so it's correct on first render.
  const [isLight, setIsLight] = useState(
    () => document.documentElement.classList.contains('light')
  )

  useEffect(() => {
    // MutationObserver watches for class changes on <html>.
    // Whenever the theme toggles, we update state and the SVG color re-renders.
    const observer = new MutationObserver(() => {
      setIsLight(document.documentElement.classList.contains('light'))
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    // Clean up the observer when the component unmounts
    return () => observer.disconnect()
  }, [])

  // One color drives every fill and stroke in the SVG
  //const color = isLight ? '#000000' : '#ffffff'

  //ok i forgot i dont need theming it should always be white. but it's good to have this logic i guess
  const color = '#ffffff'

  return (
    <div className="logo">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        xmlnsXlink="http://www.w3.org/1999/xlink"
        viewBox="0 0 472.5 225"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <g />
          <clipPath id="logo-T-outer"><path d="M 0 0.117188 L 140 0.117188 L 140 224.878906 L 0 224.878906 Z" clipRule="nonzero" /></clipPath>
          <clipPath id="logo-T-inner"><rect x="0" width="140" y="0" height="225" /></clipPath>
          <clipPath id="logo-o-outer"><path d="M 153 0.117188 L 303 0.117188 L 303 214 L 153 214 Z" clipRule="nonzero" /></clipPath>
          <clipPath id="logo-o-inner"><rect x="0" width="150" y="0" height="214" /></clipPath>
          <clipPath id="logo-v-outer"><path d="M 256 0.117188 L 326 0.117188 L 326 196 L 256 196 Z" clipRule="nonzero" /></clipPath>
          <clipPath id="logo-v-inner"><rect x="0" width="70" y="0" height="196" /></clipPath>
          <clipPath id="logo-l-outer"><path d="M 313 0.117188 L 407 0.117188 L 407 194 L 313 194 Z" clipRule="nonzero" /></clipPath>
          <clipPath id="logo-l-inner"><rect x="0" width="94" y="0" height="194" /></clipPath>
          <clipPath id="logo-icon-box-outer"><path d="M 97.664062 90.84375 L 177.832031 90.84375 L 177.832031 175.503906 L 97.664062 175.503906 Z" clipRule="nonzero" /></clipPath>
          <clipPath id="logo-icon-box-inner">
            <path d="M 110.398438 90.84375 L 164.917969 90.84375 C 168.296875 90.84375 171.535156 92.1875 173.925781 94.574219 C 176.3125 96.964844 177.65625 100.203125 177.65625 103.582031 L 177.65625 162.976562 C 177.65625 166.355469 176.3125 169.59375 173.925781 171.980469 C 171.535156 174.371094 168.296875 175.710938 164.917969 175.710938 L 110.398438 175.710938 C 107.023438 175.710938 103.785156 174.371094 101.394531 171.980469 C 99.007812 169.59375 97.664062 166.355469 97.664062 162.976562 L 97.664062 103.582031 C 97.664062 100.203125 99.007812 96.964844 101.394531 94.574219 C 103.785156 92.1875 107.023438 90.84375 110.398438 90.84375 Z" clipRule="nonzero" />
          </clipPath>
          <clipPath id="logo-icon-pin-outer"><path d="M 129.375 116.378906 L 145.859375 116.378906 L 145.859375 142.597656 L 129.375 142.597656 Z" clipRule="nonzero" /></clipPath>
          <clipPath id="logo-icon-pin-inner">
            <path d="M 131.621094 116.378906 L 143.695312 116.378906 C 144.9375 116.378906 145.941406 117.382812 145.941406 118.625 L 145.941406 140.570312 C 145.941406 141.808594 144.9375 142.816406 143.695312 142.816406 L 131.621094 142.816406 C 130.382812 142.816406 129.375 141.808594 129.375 140.570312 L 129.375 118.625 C 129.375 117.382812 130.382812 116.378906 131.621094 116.378906 Z" clipRule="nonzero" />
          </clipPath>
          <clipPath id="logo-excl-outer"><path d="M 389 0.117188 L 472 0.117188 L 472 208 L 389 208 Z" clipRule="nonzero" /></clipPath>
          <clipPath id="logo-excl-inner"><rect x="0" width="83" y="0" height="208" /></clipPath>
          <clipPath id="logo-arc-all"><path d="M 0 129 L 472 129 L 472 224.878906 L 0 224.878906 Z" clipRule="nonzero" /></clipPath>
          <clipPath id="logo-arc-top-left"><path d="M 0 0.101562 L 332 0.101562 L 332 95.878906 L 0 95.878906 Z" clipRule="nonzero" /></clipPath>
          <clipPath id="logo-arc-top-right"><path d="M 136 0.101562 L 472 0.101562 L 472 95.878906 L 136 95.878906 Z" clipRule="nonzero" /></clipPath>
          <clipPath id="logo-arc-shared"><rect x="0" width="472" y="0" height="96" /></clipPath>
          <clipPath id="logo-arc-bot-left"><path d="M 0 135 L 298 135 L 298 224.878906 L 0 224.878906 Z" clipRule="nonzero" /></clipPath>
          <clipPath id="logo-arc-bot-right"><path d="M 168 125 L 472 125 L 472 224.878906 L 168 224.878906 Z" clipRule="nonzero" /></clipPath>
        </defs>

        {/* ── T ── */}
        <g clipPath="url(#logo-T-outer)">
          <g transform="matrix(1, 0, 0, 1, 0, 0)">
            <g clipPath="url(#logo-T-inner)">
              <g fill={color} fillOpacity="1">
                <g transform="translate(8.008938, 145.220856)">
                  <path d="M 111.84375 -96.65625 L 107.859375 -74.578125 L 77.875 -80 L 61.421875 11.09375 L 33.859375 6.109375 L 50.3125 -84.984375 L 20.328125 -90.390625 L 24.3125 -112.46875 Z" />
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* ── o ── */}
        <g clipPath="url(#logo-o-outer)">
          <g transform="matrix(1, 0, 0, 1, 153, 0)">
            <g clipPath="url(#logo-o-inner)">
              <g fill={color} fillOpacity="1">
                <g transform="translate(37.033608, 159.230552)">
                  <path d="M 39.796875 -33.765625 L 43.734375 -95.375 L 70.046875 -101.5625 L 60.40625 -14.203125 L 29.921875 -7.03125 L -17.65625 -80.9375 L 8.78125 -87.15625 Z" />
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* ── v ── */}
        <g clipPath="url(#logo-v-outer)">
          <g transform="matrix(1, 0, 0, 1, 256, 0)">
            <g clipPath="url(#logo-v-inner)">
              <g fill={color} fillOpacity="1">
                <g transform="translate(17.234047, 140.343846)">
                  <path d="M 22.703125 -112.90625 L 34.390625 -3.6875 L 9.15625 -0.984375 L -2.53125 -110.203125 Z" />
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* ── l ── */}
        <g clipPath="url(#logo-l-outer)">
          <g transform="matrix(1, 0, 0, 1, 313, 0)">
            <g clipPath="url(#logo-l-inner)">
              <g fill={color} fillOpacity="1">
                <g transform="translate(0.782093, 137.230233)">
                  <path d="M 87.28125 -42.75 C 87.28125 -40.375 87.132812 -37.898438 86.84375 -35.328125 L 29.390625 -35.328125 C 29.785156 -30.179688 31.441406 -26.25 34.359375 -23.53125 C 37.285156 -20.8125 40.875 -19.453125 45.125 -19.453125 C 51.457031 -19.453125 55.863281 -22.125 58.34375 -27.46875 L 85.359375 -27.46875 C 83.972656 -22.019531 81.472656 -17.117188 77.859375 -12.765625 C 74.242188 -8.410156 69.710938 -4.992188 64.265625 -2.515625 C 58.828125 -0.046875 52.742188 1.1875 46.015625 1.1875 C 37.898438 1.1875 30.675781 -0.539062 24.34375 -4 C 18.007812 -7.46875 13.0625 -12.414062 9.5 -18.84375 C 5.9375 -25.28125 4.15625 -32.804688 4.15625 -41.421875 C 4.15625 -50.023438 5.910156 -57.539062 9.421875 -63.96875 C 12.941406 -70.40625 17.867188 -75.351562 24.203125 -78.8125 C 30.535156 -82.28125 37.804688 -84.015625 46.015625 -84.015625 C 54.035156 -84.015625 61.160156 -82.332031 67.390625 -78.96875 C 73.628906 -75.601562 78.503906 -70.800781 82.015625 -64.5625 C 85.523438 -58.332031 87.28125 -51.0625 87.28125 -42.75 Z M 61.3125 -49.4375 C 61.3125 -53.789062 59.828125 -57.253906 56.859375 -59.828125 C 53.890625 -62.398438 50.175781 -63.6875 45.71875 -63.6875 C 41.46875 -63.6875 37.878906 -62.445312 34.953125 -59.96875 C 32.035156 -57.5 30.234375 -53.988281 29.546875 -49.4375 Z" />
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* ── map pin icon (the 'i' dot replacement) ── */}
        <g clipPath="url(#logo-icon-box-outer)">
          <g clipPath="url(#logo-icon-box-inner)">
            <path
              strokeLinecap="butt"
              transform="matrix(0.749207, 0, 0, 0.749207, 97.665123, 90.845629)"
              fill="none"
              strokeLinejoin="miter"
              d="M 16.995721 -0.00250784 L 89.76536 -0.00250784 C 94.275337 -0.00250784 98.597614 1.791055 101.788488 4.976714 C 104.974147 8.167588 106.76771 12.489866 106.76771 16.999842 L 106.76771 96.27636 C 106.76771 100.786337 104.974147 105.108614 101.788488 108.294274 C 98.597614 111.485147 94.275337 113.273496 89.76536 113.273496 L 16.995721 113.273496 C 12.490959 113.273496 8.168681 111.485147 4.977807 108.294274 C 1.792148 105.108614 -0.00141495 100.786337 -0.00141495 96.27636 L -0.00141495 16.999842 C -0.00141495 12.489866 1.792148 8.167588 4.977807 4.976714 C 8.168681 1.791055 12.490959 -0.00250784 16.995721 -0.00250784 Z"
              stroke={color}
              strokeWidth="34"
              strokeOpacity="1"
              strokeMiterlimit="4"
            />
          </g>
        </g>
        <path
          strokeLinecap="butt"
          transform="matrix(0.749207, 0, 0, 0.749207, 102.274422, 122.720375)"
          fill="none"
          strokeLinejoin="miter"
          d="M -0.00131463 5.498437 L 38.904397 5.498437"
          stroke={color}
          strokeWidth="11"
          strokeOpacity="1"
          strokeMiterlimit="4"
        />
        <path
          strokeLinecap="butt"
          transform="matrix(0.749207, 0, 0, 0.749207, 144.058386, 122.190713)"
          fill="none"
          strokeLinejoin="miter"
          d="M 0.000276687 5.501531 L 42.477472 5.501531"
          stroke={color}
          strokeWidth="11"
          strokeOpacity="1"
          strokeMiterlimit="4"
        />
        <g clipPath="url(#logo-icon-pin-outer)">
          <g clipPath="url(#logo-icon-pin-inner)">
            <path
              strokeLinecap="butt"
              transform="matrix(0.749207, 0, 0, 0.749207, 129.376794, 116.377336)"
              fill="none"
              strokeLinejoin="miter"
              d="M 2.995567 0.00209622 L 19.111563 0.00209622 C 20.769566 0.00209622 22.109524 1.342054 22.109524 3.000057 L 22.109524 32.29144 C 22.109524 33.944229 20.769566 35.289402 19.111563 35.289402 L 2.995567 35.289402 C 1.342778 35.289402 -0.00239392 33.944229 -0.00239392 32.29144 L -0.00239392 3.000057 C -0.00239392 1.342054 1.342778 0.00209622 2.995567 0.00209622 Z"
              stroke={color}
              strokeWidth="14"
              strokeOpacity="1"
              strokeMiterlimit="4"
            />
          </g>
        </g>

        {/* ── ! ── */}
        <g clipPath="url(#logo-excl-outer)">
          <g transform="matrix(1, 0, 0, 1, 389, 0)">
            <g clipPath="url(#logo-excl-inner)">
              <g fill={color} fillOpacity="1">
                <g transform="translate(6.899911, 142.086826)">
                  <path d="M 56.921875 -107.515625 L 45.59375 -33.78125 L 23.15625 -36.28125 L 28.3125 -110.703125 Z M 30.34375 4.640625 C 25.695312 4.128906 22.054688 2.34375 19.421875 -0.71875 C 16.785156 -3.78125 15.691406 -7.328125 16.140625 -11.359375 C 16.597656 -15.472656 18.453125 -18.757812 21.703125 -21.21875 C 24.953125 -23.675781 28.898438 -24.648438 33.546875 -24.140625 C 38.078125 -23.628906 41.660156 -21.816406 44.296875 -18.703125 C 46.929688 -15.585938 48.019531 -11.972656 47.5625 -7.859375 C 47.113281 -3.828125 45.265625 -0.609375 42.015625 1.796875 C 38.765625 4.203125 34.875 5.148438 30.34375 4.640625 Z" />
                </g>
              </g>
            </g>
          </g>
        </g>

        {/* ── decorative arcs (bottom) ── */}
        <g clipPath="url(#logo-arc-all)">
          <g transform="matrix(1, 0, 0, 1, 0, 129)">
            <g clipPath="url(#logo-arc-shared)">
              <g clipPath="url(#logo-arc-top-left)">
                <path
                  strokeLinecap="butt"
                  transform="matrix(1.088203, 0.0153943, -0.0153943, 1.088203, 17.064925, 36.802553)"
                  fill="none"
                  strokeLinejoin="miter"
                  d="M 2.224437 7.182069 C 68.319806 27.695113 135.528489 27.692005 203.84705 7.183562"
                  stroke={color}
                  strokeWidth="15"
                  strokeOpacity="1"
                  strokeMiterlimit="4"
                />
              </g>
              <g clipPath="url(#logo-arc-top-right)">
                <path
                  strokeLinecap="butt"
                  transform="matrix(-1.088245, -0.0120516, 0.0120516, -1.088245, 452.315205, 60.62718)"
                  fill="none"
                  strokeLinejoin="miter"
                  d="M 2.199861 7.185348 C 69.015685 27.691628 136.692039 27.692359 205.225296 7.183992"
                  stroke={color}
                  strokeWidth="15"
                  strokeOpacity="1"
                  strokeMiterlimit="4"
                />
              </g>
            </g>
          </g>
        </g>

        {/* ── decorative arcs (bottom row, second pair) ── */}
        <g clipPath="url(#logo-arc-bot-left)">
          <path
            strokeLinecap="butt"
            transform="matrix(0.749132, 0.0105976, -0.0105976, 0.749132, 16.801755, 189.525789)"
            fill="none"
            strokeLinejoin="miter"
            d="M 2.075005 6.704469 C 98.091453 36.496794 195.720055 36.497492 294.955598 6.706637"
            stroke={color}
            strokeWidth="14"
            strokeOpacity="1"
            strokeMiterlimit="4"
          />
        </g>
        <g clipPath="url(#logo-arc-bot-right)">
          <path
            strokeLinecap="butt"
            transform="matrix(-0.749161, -0.00829649, 0.00829649, -0.749161, 450.395268, 207.741576)"
            fill="none"
            strokeLinejoin="miter"
            d="M 2.051439 6.707952 C 99.109293 36.495739 197.417169 36.4968 296.97501 6.705924"
            stroke={color}
            strokeWidth="14"
            strokeOpacity="1"
            strokeMiterlimit="4"
          />
        </g>
      </svg>
    </div>
  )
}