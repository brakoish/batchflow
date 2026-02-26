'use client'

import { useState, ReactNode } from 'react'

interface TooltipProps {
  children: ReactNode
  text: string
  position?: 'top' | 'bottom' | 'left' | 'right'
}

export default function Tooltip({ children, text, position = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false)

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-zinc-800',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent border-b-zinc-800',
    left: 'left-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-l-4 border-t-transparent border-b-transparent border-l-zinc-800',
    right: 'right-full top-1/2 -translate-y-1/2 border-t-4 border-b-4 border-r-4 border-t-transparent border-b-transparent border-r-zinc-800',
  }

  return (
    <div 
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      {show && (
        <div className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}>
          <div className="px-2 py-1 rounded bg-zinc-800 text-zinc-200 text-xs whitespace-nowrap shadow-lg border border-zinc-700">
            {text}
            <div className={`absolute w-0 h-0 ${arrowClasses[position]}`} />
          </div>
        </div>
      )}
    </div>
  )
}
